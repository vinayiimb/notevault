"use client";

import { useMemo, useState } from "react";
import { FileArchive, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { findOrCreateSubjectAction, uploadResourceAction } from "@/lib/actions";
import { guessYear } from "@/lib/subject-match";

type Term = { id: string; name: string; order: number };
type Program = { id: string; name: string; terms: Term[] };

type ParsedFile = {
  path: string;
  subjectFolder: string;
  order: number | null;
  year: string;
  bytes: ArrayBuffer;
};

type FileStatus = "pending" | "uploading" | "done" | "duplicate" | "error";

type FlatFile = ParsedFile & { key: string; status: FileStatus; message?: string };

const ORDER_TO_ROMAN = ["I", "II", "III", "IV", "V", "VI"];

// Normalized (lowercased, non-alphanumerics stripped) path segment -> semester
// order. Covers "Semester_I", "Semester I", "SEM-1", "semester01", "SemVI",
// etc. so the parser doesn't depend on one exact folder-naming convention.
const SEMESTER_LOOKUP: Record<string, number> = {};
for (let n = 1; n <= 6; n++) {
  const roman = ORDER_TO_ROMAN[n - 1].toLowerCase();
  const padded = String(n).padStart(2, "0");
  for (const key of [`semester${roman}`, `sem${roman}`, `semester${n}`, `sem${n}`, `semester${padded}`, `sem${padded}`]) {
    SEMESTER_LOOKUP[key] = n;
  }
}

// Best-guess Program name for each subject-folder name this workflow's
// input zips use — matched case-insensitively against the real Program
// list at runtime, so it still works if a program gets renamed slightly.
// Anything that doesn't resolve to a real program is left for the admin to
// pick by hand (e.g. a course that doesn't exist here yet).
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

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Pulls a "2017-18"-style range out of a filename if one is present
// (preserves the nicer range label); otherwise falls back to the
// single-year heuristic already used elsewhere (guessYear), so filenames
// like "Financial Accounting 2023.pdf" still get a year. Returns "" when
// nothing plausible is found — left for the admin to fill in.
function extractYearLabel(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "");
  const rangeMatch = base.match(/(?:19|20)\d{2}-\d{2,4}/);
  if (rangeMatch) return rangeMatch[0];
  const guessed = guessYear(fileName);
  return guessed ? String(guessed) : "";
}

// Tolerant PDF path parser: finds a semester folder anywhere in the path
// (not necessarily immediately at the root, and under many naming
// variants), takes the folder right after it as the subject, and falls
// back to the file's immediate parent folder when no semester folder is
// found at all (e.g. a zip of just one subject's papers, or an unrelated
// wrapping folder name). Every .pdf in the zip produces a row — nothing is
// silently dropped just because the folder layout isn't the exact expected
// shape.
function parseEntry(path: string): { subjectFolder: string; order: number | null; year: string } | null {
  if (path.includes("__MACOSX")) return null;
  const parts = path.split("/").filter(Boolean);
  const fileName = parts[parts.length - 1];
  if (!fileName || !/\.pdf$/i.test(fileName) || fileName.startsWith(".")) return null;

  let order: number | null = null;
  let semesterIdx = -1;
  for (let i = 0; i < parts.length - 1; i++) {
    const norm = parts[i].toLowerCase().replace(/[^a-z0-9]/g, "");
    if (SEMESTER_LOOKUP[norm] !== undefined) {
      order = SEMESTER_LOOKUP[norm];
      semesterIdx = i;
      break;
    }
  }

  let subjectFolder: string;
  if (semesterIdx !== -1 && semesterIdx + 1 <= parts.length - 2) {
    subjectFolder = parts[semesterIdx + 1];
  } else if (parts.length >= 2) {
    subjectFolder = parts[parts.length - 2];
  } else {
    subjectFolder = "Unsorted";
  }

  return { subjectFolder, order, year: extractYearLabel(fileName) };
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
  const [subjectProgram, setSubjectProgram] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const knownHashes = useMemo(() => new Set(existingHashes), [existingHashes]);

  // One row per distinct subject folder found across every zip dropped so
  // far — mapping a folder to a course here applies to every year/semester
  // file inside it at once.
  const subjectFolders = useMemo(() => {
    const set = new Set<string>();
    for (const f of files) set.add(f.subjectFolder);
    return Array.from(set).sort();
  }, [files]);

  async function handleZips(zipFiles: File[]) {
    setError(null);
    setNotice(null);
    setExtracting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const newFiles: FlatFile[] = [];
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
          newFiles.push({
            key: path,
            path,
            subjectFolder: parsed.subjectFolder,
            order: parsed.order,
            year: parsed.year,
            bytes,
            status: "pending",
          });
        }
      }

      if (newFiles.length === 0) {
        setError(
          nestedZipCount > 0
            ? `That zip contains ${nestedZipCount} other zip file${nestedZipCount === 1 ? "" : "s"}, not PDFs directly — open it and upload the inner zip(s) (or their extracted PDFs) instead.`
            : "No PDF files found inside that zip."
        );
      } else {
        const missingSemester = newFiles.filter((f) => f.order === null).length;
        if (missingSemester > 0) {
          setNotice(
            `Couldn't detect a semester folder for ${missingSemester} file${missingSemester === 1 ? "" : "s"} — set it manually in the Semester column before uploading those rows.`
          );
        }
      }

      // Pre-fill each newly-seen subject folder's suggested course mapping.
      setSubjectProgram((prev) => {
        const next = { ...prev };
        for (const f of newFiles) {
          if (next[f.subjectFolder] !== undefined) continue;
          const suggestedName = SUGGESTED_PROGRAM_NAME[f.subjectFolder.trim().toLowerCase()];
          const match = suggestedName ? programs.find((p) => p.name === suggestedName) : undefined;
          next[f.subjectFolder] = match?.id ?? "";
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
    // regardless of which semester folder the file came from.
    const allSemesters = program.terms.find((t) => t.name === "All Semesters");
    if (allSemesters && program.terms.length === 1) return allSemesters.id;
    if (order === null) return null;

    const specific = program.terms.find((t) => t.order === order);
    if (specific) return specific.id;
    return allSemesters?.id ?? null;
  }

  async function uploadAll() {
    setUploading(true);
    // One subject per (program, term, subjectFolder name) combo, reused
    // across every year file that maps to it, instead of re-resolving the
    // subject id per file.
    const subjectCache = new Map<string, string>();
    const seenThisRun = new Set<string>();

    for (const file of files) {
      if (file.status === "done" || file.status === "duplicate") continue;
      const programId = subjectProgram[file.subjectFolder];
      const program = programs.find((p) => p.id === programId);
      if (!program) {
        updateFile(file.key, { status: "error", message: "No course chosen for this subject folder" });
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

      updateFile(file.key, { status: "uploading" });
      try {
        const hash = await sha256Hex(file.bytes);
        if (knownHashes.has(hash) || seenThisRun.has(hash)) {
          updateFile(file.key, { status: "duplicate", message: "Already uploaded" });
          continue;
        }

        const cacheKey = `${termId}::${file.subjectFolder}`;
        let subjectId = subjectCache.get(cacheKey);
        if (!subjectId) {
          const subjectForm = new FormData();
          subjectForm.set("termId", termId);
          subjectForm.set("name", file.subjectFolder);
          const subject = await findOrCreateSubjectAction(subjectForm);
          subjectId = subject.id;
          subjectCache.set(cacheKey, subjectId);
        }

        const uploadForm = new FormData();
        uploadForm.set("subjectId", subjectId);
        uploadForm.set("type", "PYQ");
        uploadForm.set("title", file.year ? `${file.subjectFolder} — ${file.year}` : file.subjectFolder);
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
  const allMapped = subjectFolders.length > 0 && subjectFolders.every((s) => subjectProgram[s]);

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
            Any folder layout works — a Semester_X/Subject/Year.pdf structure is detected automatically, but every PDF found gets a row either way
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
        <p className="text-sm font-medium">
          Map each subject folder to a course ({subjectFolders.length} found)
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {subjectFolders.map((folder) => {
            const count = files.filter((f) => f.subjectFolder === folder).length;
            return (
              <div key={folder} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[240px] text-sm font-medium">{folder}</span>
                <span className="text-xs text-muted">{count} file{count === 1 ? "" : "s"}</span>
                <select
                  value={subjectProgram[folder] ?? ""}
                  onChange={(e) =>
                    setSubjectProgram((prev) => ({ ...prev, [folder]: e.target.value }))
                  }
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
          title={!allMapped ? "Map every subject folder to a course first" : undefined}
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
              <th className="px-4 py-2 text-left">Subject folder</th>
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
                <td className="px-4 py-2">{f.subjectFolder}</td>
                <td className="px-4 py-2">
                  <select
                    value={f.order ?? ""}
                    onChange={(e) =>
                      updateFile(f.key, { order: e.target.value ? Number(e.target.value) : null })
                    }
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
