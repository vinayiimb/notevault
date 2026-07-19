"use client";

import { useMemo, useState } from "react";
import { FileArchive, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { findOrCreateSubjectAction, uploadResourceAction } from "@/lib/actions";

type Term = { id: string; name: string; order: number };
type Program = { id: string; name: string; terms: Term[] };

type FileStatus = "pending" | "uploading" | "done" | "duplicate" | "error";

type FlatFile = {
  key: string;
  path: string;
  groupKey: string; // canonical (lowercased, punctuation-insensitive) — which bulk-map row this belongs to
  groupLabel: string; // display text for that same group
  subjectName: string; // editable — actual Subject name used on upload
  programId: string; // editable — which course this uploads under
  order: number | null; // editable — semester (1-6)
  year: string; // editable
  bytes: ArrayBuffer;
  status: FileStatus;
  message?: string;
};

const ORDER_TO_ROMAN = ["I", "II", "III", "IV", "V", "VI"];

// Normalized (lowercased, non-alphanumerics stripped) folder-name -> semester
// order. Covers "Semester_I", "Semester I", "SEM-1", "semester01", "SemVI",
// etc. so a well-organized zip's folder names don't depend on one exact
// naming convention.
const SEMESTER_LOOKUP: Record<string, number> = {};
for (let n = 1; n <= 6; n++) {
  const roman = ORDER_TO_ROMAN[n - 1].toLowerCase();
  const padded = String(n).padStart(2, "0");
  for (const key of [`semester${roman}`, `sem${roman}`, `semester${n}`, `sem${n}`, `semester${padded}`, `sem${padded}`]) {
    SEMESTER_LOOKUP[key] = n;
  }
}

// Ordinal/roman word -> semester order, for filenames that spell the
// semester out in text (e.g. "...-6th Semester-2019.pdf", "...VIth Semester
// 2023-2024.pdf") rather than putting it in the folder structure.
const SEM_WORD_TO_ORDER: Record<string, number> = {
  "1st": 1, first: 1, ist: 1, i: 1,
  "2nd": 2, second: 2, iind: 2, ii: 2,
  "3rd": 3, third: 3, iiird: 3, iii: 3,
  "4th": 4, fourth: 4, ivth: 4, iv: 4,
  "5th": 5, fifth: 5, vth: 5, v: 5,
  "6th": 6, sixth: 6, vith: 6, vi: 6,
};
const SEMESTER_PHRASE_RE = /([a-z0-9]+)\s*[-–—]?\s*semesters?\b|\bsemesters?\s*[-–—]?\s*([a-z0-9]+)/i;

// Best-guess Program name for a handful of well-known short folder/course
// names — matched case-insensitively against the real Program list at
// runtime. This is just a fast path; matchProgram() below does the real
// (fuzzy) work for everything else, e.g. "B.Sc.(H) Biochemistry" or
// "B. A. (Honours) Political Science" extracted straight from a filename.
const SUGGESTED_PROGRAM_NAME: Record<string, string> = {
  biochemistry: "B.Sc. (Hons.) Biochemistry",
  botany: "B.Sc. (Hons.) Botany",
  chemistry: "B.Sc. (Hons.) Chemistry",
  mathematics: "B.Sc. (Hons.) Mathematics",
  physics: "B.Sc. (Hons.) Physics",
  zoology: "B.Sc. (Hons.) Zoology",
  "b.a(h) economics": "B.A. (Hons.) Economics",
  "b.a(h) english": "B.A. (Hons.) English",
  "b.a(h) hindi": "B.A. (Hons.) Hindi",
  "b.a(h) history": "B.A. (Hons.) History",
  "b.a(h) political science": "B.A. (Hons.) Political Science",
  "b.a(h) sanskrit": "B.A. (Hons.) Sanskrit",
  "b.a(prog)": "B.A. (Programme)",
  "b.com(h)": "B.Com (Hons) — DU Official Syllabus",
  "b.sc(prog) life sciences": "B.Sc. (Programme) Life Science",
  "b.sc(hons & prog) sec": "Common Pool (VAC / AEC / SEC)",
  "b.sc(hons) generic elective": "GE Pool (Generic Electives)",
};

// Folder names too generic to use as a subject/group label on their own
// (a zip export's catch-all dump folder, not an actual subject).
const GENERIC_FOLDER_NAMES = new Set(["unsorted", "downloads", "download", "papers", "pdf", "pdfs", "files", "documents", "root", "misc", "other", "scans"]);

// Degree-level words to strip off a course guess ("B.Sc.(H) Biochemistry")
// to get the bare subject name ("Biochemistry") that matches how subjects
// are actually named in the database.
const DEGREE_NOISE = new Set(["b", "a", "sc", "com", "tech", "hons", "hon", "honours", "honors", "h", "prog", "programme", "program"]);

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function extractYearFromText(text: string): { year: string; span: [number, number] | null } {
  const rangeMatch = text.match(/(?:19|20)\d{2}\s*-\s*\d{2,4}/);
  if (rangeMatch && rangeMatch.index !== undefined) {
    return { year: rangeMatch[0].replace(/\s+/g, ""), span: [rangeMatch.index, rangeMatch.index + rangeMatch[0].length] };
  }
  const singleMatch = text.match(/(?:19|20)\d{2}/);
  if (singleMatch && singleMatch.index !== undefined) {
    const y = Number(singleMatch[0]);
    const currentYear = new Date().getFullYear();
    if (y >= 2000 && y <= currentYear + 1) {
      return { year: singleMatch[0], span: [singleMatch.index, singleMatch.index + singleMatch[0].length] };
    }
  }
  return { year: "", span: null };
}

function extractSemesterFromText(text: string): { order: number | null; span: [number, number] | null } {
  const m = text.match(SEMESTER_PHRASE_RE);
  if (!m || m.index === undefined) return { order: null, span: null };
  const token = (m[1] ?? m[2] ?? "").toLowerCase();
  return { order: SEM_WORD_TO_ORDER[token] ?? null, span: [m.index, m.index + m[0].length] };
}

// Strips leading degree-level words ("B.Sc.(H)", "B. A. (Honours)", ...)
// off a course guess, leaving the bare subject name.
function stripDegreePrefix(courseGuess: string): string {
  const words = courseGuess.match(/[A-Za-z]+/g) ?? [];
  let i = 0;
  while (i < words.length && DEGREE_NOISE.has(words[i].toLowerCase())) i++;
  const remaining = words.slice(i);
  return (remaining.length > 0 ? remaining : words).join(" ");
}

// Extracts year, semester, and the leftover course-name text straight from
// a filename like "B.Sc.(H) Biochemistry-6th Semester-2019.pdf" — the
// primary source of truth when the zip's folder structure doesn't carry
// this information (a flat dump, or inconsistent per-file folder naming).
function parseFileNameHints(fileName: string): { year: string; order: number | null; courseGuess: string; subjectGuess: string } {
  const base = fileName.replace(/\.pdf$/i, "");
  const { year, span: yearSpan } = extractYearFromText(base);
  const { order, span: semSpan } = extractSemesterFromText(base);

  const spans = [yearSpan, semSpan]
    .filter((s): s is [number, number] => s !== null)
    .sort((a, b) => a[0] - b[0]);
  let courseGuess = base;
  for (let i = spans.length - 1; i >= 0; i--) {
    const [s, e] = spans[i];
    courseGuess = courseGuess.slice(0, s) + " " + courseGuess.slice(e);
  }
  courseGuess = courseGuess.replace(/[-_.,]+/g, " ").replace(/\s{2,}/g, " ").trim();

  return { year, order, courseGuess, subjectGuess: stripDegreePrefix(courseGuess) };
}

// Only strips the near-meaningless "B"/"A" degree-letter tokens and common
// filler words, and canonicalizes spelling variants of the rest ("H" /
// "Hons" / "Honours" -> "hons", "Prog" / "Programme" -> "prog", "Pol" ->
// "political") instead of discarding them outright. Unlike a full noise
// strip, this keeps enough of a degree-only name ("B.Com" vs "B.Sc.
// Programme") intact to tell two different degree-only programs apart,
// while still letting differently-punctuated/abbreviated versions of the
// *same* course collapse to identical tokens.
const MINIMAL_NOISE = new Set(["b", "a", "of", "the", "and"]);
const WORD_SYNONYMS: Record<string, string> = {
  h: "hons", hon: "hons", hons: "hons", honours: "hons", honors: "hons",
  prog: "prog", programme: "prog", program: "prog",
  pol: "political",
};

function normalizeCourseWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .filter((w) => !MINIMAL_NOISE.has(w))
    .map((w) => WORD_SYNONYMS[w] ?? w);
}

// Fuzzy-matches a course guess (however it's punctuated/spaced/abbreviated)
// against the real Program list by significant-word overlap, e.g.
// "B. A. (Honours) Political Science" -> "B.A. (Hons.) Political Science".
function matchProgram(courseGuess: string, programs: Program[]): Program | null {
  const guessWords = new Set(normalizeCourseWords(courseGuess));
  if (guessWords.size === 0) return null;
  let best: { program: Program; score: number } | null = null;
  for (const p of programs) {
    const nameWords = normalizeCourseWords(p.name);
    const score = nameWords.filter((w) => guessWords.has(w)).length;
    if (score > 0 && (!best || score > best.score)) best = { program: p, score };
  }
  return best?.program ?? null;
}

function guessProgramId(groupKey: string, courseGuess: string, programs: Program[]): string {
  const suggestedName = SUGGESTED_PROGRAM_NAME[groupKey.trim().toLowerCase()];
  const exact = suggestedName ? programs.find((p) => p.name === suggestedName) : undefined;
  if (exact) return exact.id;
  return matchProgram(courseGuess || groupKey, programs)?.id ?? "";
}

// Canonical grouping key: same significant-word normalization used for
// program matching, so "B.A.(H) History-1st Semester-2017", "B. A.
// (Honours ) History IInd Semester 2024-2025", and
// "b.a(hons.)-history-3rd-semester-2022" all collapse into one "history"
// group instead of one group per differently-punctuated filename — the
// admin picks the course once per real subject, not once per file.
function canonicalKey(courseGuess: string): string {
  return normalizeCourseWords(courseGuess).join(" ");
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

type ParsedEntry = { groupKey: string; groupLabel: string; subjectName: string; courseGuess: string; order: number | null; year: string };

// Combines folder-based hints (for a well-organized Semester_X/Subject/Year
// zip) with filename-text hints (for a flat dump where everything is
// encoded in the filename instead) — whichever source is actually
// informative wins for each field, so both zip styles work without the
// admin needing to pick one convention.
function parseEntry(path: string): ParsedEntry | null {
  if (path.includes("__MACOSX")) return null;
  const parts = path.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1];
  if (!fileName || !/\.pdf$/i.test(fileName) || fileName.startsWith(".")) return null;

  let folderOrder: number | null = null;
  let semesterIdx = -1;
  for (let i = 0; i < parts.length - 1; i++) {
    const norm = parts[i].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (SEMESTER_LOOKUP[norm] !== undefined) {
      folderOrder = SEMESTER_LOOKUP[norm];
      semesterIdx = i;
      break;
    }
  }

  let folderSubject: string | null = null;
  if (semesterIdx !== -1 && semesterIdx + 1 <= parts.length - 2) {
    folderSubject = parts[semesterIdx + 1];
  } else if (parts.length >= 2) {
    folderSubject = parts[parts.length - 2];
  }
  const folderIsInformative = !!folderSubject && !GENERIC_FOLDER_NAMES.has(folderSubject.toLowerCase().replace(/[^a-z0-9]/g, ""));

  const hints = parseFileNameHints(fileName);
  const order = folderOrder ?? hints.order;
  const year = hints.year;

  if (folderIsInformative) {
    const subject = folderSubject as string;
    return { groupKey: subject.toLowerCase(), groupLabel: subject, subjectName: subject, courseGuess: subject, order, year };
  }
  if (hints.subjectGuess) {
    const key = canonicalKey(hints.courseGuess) || hints.subjectGuess.toLowerCase();
    return {
      groupKey: key,
      groupLabel: titleCase(key),
      subjectName: hints.subjectGuess,
      courseGuess: hints.courseGuess,
      order,
      year,
    };
  }
  const subject = folderSubject ?? "Unsorted";
  return { groupKey: subject.toLowerCase(), groupLabel: subject, subjectName: subject, courseGuess: subject, order, year };
}

export function ConsolidatedUploadClient({
  programs,
  existingHashes,
}: {
  programs: Program[];
  existingHashes: string[];
}) {
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [files, setFiles] = useState<FlatFile[]>([]);
  const [groupProgram, setGroupProgram] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const knownHashes = useMemo(() => new Set(existingHashes), [existingHashes]);

  // One row per distinct detected group (a folder name, or an extracted
  // course name when the zip is a flat dump) — mapping a group to a course
  // here applies to every file in it at once; each file can still be
  // fine-tuned individually in the table below.
  const groups = useMemo(() => {
    const labels = new Map<string, string>();
    for (const f of files) if (!labels.has(f.groupKey)) labels.set(f.groupKey, f.groupLabel);
    return Array.from(labels.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [files]);

  function setProgramForGroup(group: string, programId: string) {
    setGroupProgram((prev) => ({ ...prev, [group]: programId }));
    setFiles((prev) => prev.map((f) => (f.groupKey === group ? { ...f, programId } : f)));
  }

  async function handleZips(zipFiles: File[]) {
    setError(null);
    setNotice(null);
    setExtracting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const newEntries: { path: string; parsed: ParsedEntry; bytes: ArrayBuffer }[] = [];
      const seen = new Set<string>(files.map((f) => f.path));
      let nestedZipCount = 0;

      for (const zipFile of zipFiles) {
        const zip = await JSZip.loadAsync(zipFile);
        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          if (seen.has(path)) continue;
          if (/\.zip$/i.test(path)) {
            nestedZipCount++;
            continue;
          }
          const parsed = parseEntry(path);
          if (!parsed) continue;
          seen.add(path);
          const bytes = await entry.async("arraybuffer");
          newEntries.push({ path, parsed, bytes });
        }
      }

      if (newEntries.length === 0) {
        setError(
          nestedZipCount > 0
            ? `That zip contains ${nestedZipCount} other zip file${nestedZipCount === 1 ? "" : "s"}, not PDFs directly — open it and upload the inner zip(s) (or their extracted PDFs) instead.`
            : "No PDF files found inside that zip."
        );
        setExtracting(false);
        return;
      }

      // Resolve one course default per distinct group, from its first
      // entry's course guess, so every row in the group starts consistent.
      const resolvedGroupProgram = new Map<string, string>();
      for (const { parsed } of newEntries) {
        if (resolvedGroupProgram.has(parsed.groupKey)) continue;
        resolvedGroupProgram.set(parsed.groupKey, guessProgramId(parsed.groupKey, parsed.courseGuess, programs));
      }

      const newFiles: FlatFile[] = newEntries.map(({ path, parsed, bytes }) => ({
        key: path,
        path,
        groupKey: parsed.groupKey,
        groupLabel: parsed.groupLabel,
        subjectName: parsed.subjectName,
        programId: resolvedGroupProgram.get(parsed.groupKey) ?? "",
        order: parsed.order,
        year: parsed.year,
        bytes,
        status: "pending",
      }));

      const missingSemester = newFiles.filter((f) => f.order === null).length;
      if (missingSemester > 0) {
        setNotice(
          `Couldn't detect a semester for ${missingSemester} file${missingSemester === 1 ? "" : "s"} — set it manually in the Semester column before uploading those rows.`
        );
      }

      setGroupProgram((prev) => {
        const next = { ...prev };
        for (const [group, id] of resolvedGroupProgram) {
          if (next[group] === undefined) next[group] = id;
        }
        return next;
      });

      setFiles((prev) => [...prev, ...newFiles]);
    } catch (err) {
      setError(`Could not read that zip: ${err instanceof Error ? err.message : err}`);
    } finally {
      setExtracting(false);
    }
  }

  function updateFile(key: string, patch: Partial<FlatFile>) {
    setFiles((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }

  function resolveTermId(program: Program, order: number | null): string | null {
    // A program with only one "All Semesters" term (GE Pool) or one that
    // also happens to carry it (Common Pool) uses that single bucket
    // regardless of which semester the file came from.
    const allSemesters = program.terms.find((t) => t.name === "All Semesters");
    if (allSemesters && program.terms.length === 1) return allSemesters.id;
    if (order === null) return null;

    const specific = program.terms.find((t) => t.order === order);
    if (specific) return specific.id;
    return allSemesters?.id ?? null;
  }

  async function uploadAll() {
    setUploading(true);
    // One subject per (term, subject name) combo, reused across every file
    // that maps to it, instead of re-resolving the subject id per file.
    const subjectCache = new Map<string, string>();
    const seenThisRun = new Set<string>();

    for (const file of files) {
      if (file.status === "done" || file.status === "duplicate") continue;
      const program = programs.find((p) => p.id === file.programId);
      if (!program) {
        updateFile(file.key, { status: "error", message: "No course chosen for this row" });
        continue;
      }
      const termId = resolveTermId(program, file.order);
      if (!termId) {
        updateFile(file.key, {
          status: "error",
          message: file.order === null ? "Pick a semester for this row first" : `${program.name} has no matching semester`,
        });
        continue;
      }
      if (!file.subjectName.trim()) {
        updateFile(file.key, { status: "error", message: "Subject name can't be empty" });
        continue;
      }

      updateFile(file.key, { status: "uploading" });
      try {
        const hash = await sha256Hex(file.bytes);
        if (knownHashes.has(hash) || seenThisRun.has(hash)) {
          updateFile(file.key, { status: "duplicate", message: "Already uploaded" });
          continue;
        }

        const cacheKey = `${termId}::${file.subjectName.trim().toLowerCase()}`;
        let subjectId = subjectCache.get(cacheKey);
        if (!subjectId) {
          const subjectForm = new FormData();
          subjectForm.set("termId", termId);
          subjectForm.set("name", file.subjectName.trim());
          const subject = await findOrCreateSubjectAction(subjectForm);
          subjectId = subject.id;
          subjectCache.set(cacheKey, subjectId);
        }

        const uploadForm = new FormData();
        uploadForm.set("subjectId", subjectId);
        uploadForm.set("type", "PYQ");
        uploadForm.set("title", file.year ? `${file.subjectName.trim()} — ${file.year}` : file.subjectName.trim());
        uploadForm.set("year", file.year.slice(0, 4));
        uploadForm.set("file", new File([file.bytes], `${file.year || "paper"}.pdf`, { type: "application/pdf" }));
        const result = await uploadResourceAction(uploadForm);
        if (result?.status === "duplicate") {
          updateFile(file.key, { status: "duplicate", message: "Already uploaded" });
        } else {
          updateFile(file.key, { status: "done", message: "Uploaded" });
        }
        seenThisRun.add(hash);
      } catch (err) {
        updateFile(file.key, {
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
    setUploading(false);
  }

  const doneCount = files.filter((f) => f.status === "done" || f.status === "duplicate").length;
  const allMapped = files.length > 0 && files.every((f) => f.programId);

  if (files.length === 0) {
    return (
      <div>
        <label
          className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-accent"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const dropped = Array.from(e.dataTransfer.files).filter((f) => /\.zip$/i.test(f.name));
            if (dropped.length > 0) handleZips(dropped);
          }}
        >
          <FileArchive size={32} weight="bold" className="text-muted" />
          <span className="text-sm font-medium">
            {extracting ? "Reading zip file..." : "Drop a zip containing PDFs here"}
          </span>
          <span className="text-xs text-muted">
            Any layout works — a Semester_X/Subject/Year.pdf structure, or a flat dump where the course/semester/year
            are just in the filename. Every PDF found gets an editable row either way.
          </span>
          <span className="text-xs text-muted">or click to browse</span>
          <input
            type="file"
            accept=".zip,application/zip"
            multiple
            className="hidden"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              if (picked.length > 0) handleZips(picked);
              e.target.value = "";
            }}
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-500">{error}</p>}
      {notice && <p className="text-sm text-amber-500">{notice}</p>}

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">Bulk-assign a course to each detected group ({groups.length} found)</p>
        <p className="mt-1 text-xs text-muted">
          Sets the course for every file in that group at once — you can still fine-tune Course, Subject, Semester, or
          Year on any individual row in the table below.
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {groups.map(([group, label]) => {
            const count = files.filter((f) => f.groupKey === group).length;
            return (
              <div key={group} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[240px] text-sm font-medium">{label}</span>
                <span className="text-xs text-muted">{count} file{count === 1 ? "" : "s"}</span>
                <select
                  value={groupProgram[group] ?? ""}
                  onChange={(e) => setProgramForGroup(group, e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
                >
                  <option value="">Select course — no match found</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={uploadAll}
          disabled={uploading || !allMapped}
          title={!allMapped ? "Every row needs a course selected first" : undefined}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <UploadSimple size={16} weight="bold" />
          {uploading ? "Uploading..." : `Upload all ${files.length} files`}
        </button>
        <span className="text-sm text-muted">
          {doneCount} of {files.length} done
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-2 text-left">File</th>
              <th className="px-4 py-2 text-left">Course</th>
              <th className="px-4 py-2 text-left">Subject</th>
              <th className="px-4 py-2 text-left">Semester</th>
              <th className="px-4 py-2 text-left">Year</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {files.map((f) => (
              <tr key={f.key}>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-muted" title={f.path}>
                  {f.path}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={f.programId}
                    onChange={(e) => updateFile(f.key, { programId: e.target.value })}
                    className={`min-w-[200px] rounded-lg border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none ${
                      f.programId ? "border-border" : "border-amber-500"
                    }`}
                  >
                    <option value="">Select course</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={f.subjectName}
                    onChange={(e) => updateFile(f.key, { subjectName: e.target.value })}
                    className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={f.order ?? ""}
                    onChange={(e) => updateFile(f.key, { order: e.target.value ? Number(e.target.value) : null })}
                    className={`rounded-lg border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none ${
                      f.order === null ? "border-amber-500" : "border-border"
                    }`}
                  >
                    <option value="">Set semester</option>
                    {ORDER_TO_ROMAN.map((roman, i) => (
                      <option key={roman} value={i + 1}>
                        {roman}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    type="text"
                    value={f.year}
                    onChange={(e) => updateFile(f.key, { year: e.target.value })}
                    placeholder="e.g. 2023-24"
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1 text-sm focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2">
                  {f.status === "pending" && <span className="text-muted">Waiting</span>}
                  {f.status === "uploading" && <span className="text-accent">Uploading...</span>}
                  {f.status === "done" && <span className="text-green-600">Uploaded</span>}
                  {f.status === "duplicate" && <span className="text-muted">{f.message}</span>}
                  {f.status === "error" && <span className="text-red-500">{f.message}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
