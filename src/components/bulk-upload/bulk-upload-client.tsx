"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { FileArchive, FilePdf, Sparkle } from "@phosphor-icons/react/dist/ssr";
import {
  quickCreateSubjectAction,
  rememberSubjectMatchAction,
  saveFailedUploadAction,
  uploadResourceAction,
} from "@/lib/actions";
import { matchSubjectsWithAI } from "@/lib/ai";
import { guessSubject, normalizeMemoryKey } from "@/lib/subject-match";
import type { AcademicProgram } from "@/lib/academic-types";

const NEW_SUBJECT = "__new__";

type RowStatus = "pending" | "uploading" | "done" | "duplicate" | "unmatched" | "error";

type Row = {
  key: string;
  file: File;
  filename: string;
  fileHash: string;
  title: string;
  subjectId: string;
  year: string;
  type: "PYQ" | "NOTES";
  status: RowStatus;
  message?: string;
  creatingNew: boolean;
  newProgramId: string;
  newTermId: string;
  newSubjectName: string;
  creating: boolean;
  createError: string | null;
};

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function BulkUploadClient({
  programs: initialPrograms,
  memory: initialMemory,
  existingHashes,
}: {
  programs: AcademicProgram[];
  memory: Record<string, string>;
  existingHashes: string[];
}) {
  const [programs, setPrograms] = useState(initialPrograms);
  const [memory, setMemory] = useState(initialMemory);
  const [knownHashes, setKnownHashes] = useState(() => new Set(existingHashes));
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultYear, setDefaultYear] = useState("2024");
  const [defaultType, setDefaultType] = useState<"PYQ" | "NOTES">("PYQ");
  const [defaultProgramId, setDefaultProgramId] = useState("");
  const [defaultTermId, setDefaultTermId] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [duplicatesInZip, setDuplicatesInZip] = useState(0);
  const [alreadyUploadedInZip, setAlreadyUploadedInZip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [autoCreating, setAutoCreating] = useState(false);
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatchError, setAiMatchError] = useState<string | null>(null);
  const [batchId] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const moreInputRef = useRef<HTMLInputElement>(null);
  const autoCreatingRef = useRef(false);

  const flatSubjects = useMemo(
    () =>
      programs.flatMap((p) =>
        p.terms.flatMap((t) =>
          t.subjects.map((s) => ({ id: s.id, name: s.name, programName: p.name, termName: t.name }))
        )
      ),
    [programs]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, typeof flatSubjects>();
    for (const s of flatSubjects) {
      const key = `${s.programName} · ${s.termName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [flatSubjects]);

  const activeRows = rows.filter((r) => r.status !== "duplicate");
  const duplicateRows = rows.filter((r) => r.status === "duplicate");
  const matchedCount = activeRows.filter((r) => r.subjectId).length;
  // Matched rows first so the admin can see what's already resolved without
  // hunting through a mixed list; unmatched ones grouped below need action.
  // Already-uploaded duplicates get their own group since there's nothing to
  // do with them but skip.
  const matchedRows = activeRows.filter((r) => r.subjectId);
  const unmatchedRows = activeRows.filter((r) => !r.subjectId);
  const defaultProgram = programs.find((p) => p.id === defaultProgramId);

  // DSE / AEC / SEC / VAC / GE electives aren't tied to one semester — the
  // Common Pool programme carries a real "All Semesters" term for exactly
  // this. Surface it as a selectable semester regardless of which course is
  // currently picked, instead of requiring Common Pool to be chosen first.
  const allSemestersTerm = useMemo(() => {
    const hit = programs
      .flatMap((program) => program.terms.map((term) => ({ term, program })))
      .find(({ term }) => term.name === "All Semesters");
    return hit ? { termId: hit.term.id, programId: hit.program.id } : null;
  }, [programs]);

  async function handleZips(files: File[]) {
    setError(null);
    setExtracting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const newRows: Row[] = [];
      // Seed with hashes already present from a previous zip in this same
      // session, so uploading several zips back-to-back still dedupes
      // against each other, not just against the database.
      const seenInBatch = new Set<string>(rows.map((r) => r.fileHash));
      let duplicateSkipped = 0;
      let alreadyUploaded = 0;

      for (const file of files) {
        const zip = await JSZip.loadAsync(file);

        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          if (!/\.pdf$/i.test(path)) continue;

          const arrayBuffer = await entry.async("arraybuffer");
          const fileHash = await sha256Hex(arrayBuffer);

          // Same bytes already seen earlier in this same batch — skip the repeat.
          if (seenInBatch.has(fileHash)) {
            duplicateSkipped++;
            continue;
          }
          seenInBatch.add(fileHash);

          const filename = path.split("/").pop() || path;
          const pdfFile = new File([arrayBuffer], filename, { type: "application/pdf" });
          const subjectId = guessSubject(filename, flatSubjects, memory) ?? "";
          // Already uploaded in an earlier session — flag it immediately
          // instead of waiting until Upload is clicked.
          const alreadyInDb = knownHashes.has(fileHash);
          if (alreadyInDb) alreadyUploaded++;

          newRows.push({
            key: `${path}-${crypto.randomUUID()}`,
            file: pdfFile,
            filename,
            fileHash,
            title: filename.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim(),
            subjectId,
            year: defaultYear,
            type: defaultType,
            status: alreadyInDb ? "duplicate" : "pending",
            message: alreadyInDb ? "Already uploaded previously — skipped" : undefined,
            creatingNew: false,
            newProgramId: "",
            newTermId: "",
            newSubjectName: "",
            creating: false,
            createError: null,
          });
        }
      }

      if (newRows.length === 0) {
        setError(
          duplicateSkipped > 0
            ? "Every PDF in that zip was a duplicate of another file already in the list."
            : "No PDF files found in that zip."
        );
      }
      setDuplicatesInZip((prev) => prev + duplicateSkipped);
      setAlreadyUploadedInZip((prev) => prev + alreadyUploaded);
      setRows((prev) => [...prev, ...newRows]);
    } catch (err) {
      setError(`Could not read that zip file: ${err instanceof Error ? err.message : err}`);
    } finally {
      setExtracting(false);
    }
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  // Remembers a manual title -> subject correction (persisted server-side)
  // and immediately applies it to any other still-unmatched row in this same
  // batch whose title collapses to the same key (e.g. a different year's
  // paper number for the same subject).
  function rememberAndApply(row: Row, subjectId: string) {
    const key = normalizeMemoryKey(row.title);
    if (!key) return;
    setMemory((prev) => ({ ...prev, [key]: subjectId }));
    setRows((prev) =>
      prev.map((r) =>
        r.key !== row.key && !r.subjectId && normalizeMemoryKey(r.title) === key
          ? { ...r, subjectId }
          : r
      )
    );
    const formData = new FormData();
    formData.set("key", key);
    formData.set("subjectId", subjectId);
    rememberSubjectMatchAction(formData).catch(() => {});
  }

  function onSubjectSelect(row: Row, value: string) {
    if (value === NEW_SUBJECT) {
      updateRow(row.key, {
        creatingNew: true,
        newProgramId: "",
        newTermId: "",
        newSubjectName: row.title,
        createError: null,
      });
    } else {
      updateRow(row.key, { subjectId: value });
      if (value) rememberAndApply(row, value);
    }
  }

  async function createSubjectForRow(row: Row) {
    if (!row.newTermId || !row.newSubjectName.trim()) return;
    updateRow(row.key, { creating: true, createError: null });
    try {
      const formData = new FormData();
      formData.set("termId", row.newTermId);
      formData.set("name", row.newSubjectName.trim());
      const created = await quickCreateSubjectAction(formData);

      // Make the new subject selectable everywhere, immediately.
      setPrograms((prev) =>
        prev.map((p) => ({
          ...p,
          terms: p.terms.map((t) =>
            t.id === created.termId ? { ...t, subjects: [...t.subjects, created] } : t
          ),
        }))
      );

      updateRow(row.key, {
        subjectId: created.id,
        creatingNew: false,
        creating: false,
      });
      rememberAndApply(row, created.id);
    } catch (err) {
      updateRow(row.key, {
        creating: false,
        createError: err instanceof Error ? err.message : "Could not create that subject.",
      });
    }
  }

  // For any row still unmatched: if a default course + semester is set,
  // create a brand-new subject for it there automatically, named directly
  // from the row's title/filename — no matching, no AI, nothing to review.
  // Rows sharing the same core title (e.g. same paper, different year
  // suffix) reuse one created subject. This runs automatically (see the
  // effect below) as soon as a default semester is picked, so picking the
  // course + semester and then hitting Upload is the entire workflow; the
  // subject list this produces is a first pass meant to be cleaned up
  // (renamed/merged/moved) later once the real syllabus mapping is known.
  async function autoCreateRemaining() {
    if (!defaultTermId) return;
    if (autoCreatingRef.current) return;
    const unmatched = rows.filter((r) => !r.subjectId && !r.creatingNew);
    if (unmatched.length === 0) return;

    autoCreatingRef.current = true;
    setAutoCreating(true);
    const createdForKey = new Map<string, string>();
    for (const row of unmatched) {
      const key = normalizeMemoryKey(row.title) || row.title.trim().toLowerCase();
      let subjectId = createdForKey.get(key);
      if (!subjectId) {
        try {
          const formData = new FormData();
          formData.set("termId", defaultTermId);
          formData.set("name", row.title.trim() || row.filename);
          const created = await quickCreateSubjectAction(formData);
          setPrograms((prev) =>
            prev.map((p) => ({
              ...p,
              terms: p.terms.map((t) =>
                t.id === created.termId ? { ...t, subjects: [...t.subjects, created] } : t
              ),
            }))
          );
          subjectId = created.id;
          createdForKey.set(key, subjectId);
        } catch {
          continue; // leave unmatched — it'll be saved to Failed Uploads on upload
        }
      }
      updateRow(row.key, { subjectId });
      rememberAndApply(row, subjectId);
    }
    setAutoCreating(false);
    autoCreatingRef.current = false;
  }

  async function applyDefaultsToAll() {
    setRows((prev) => prev.map((r) => ({ ...r, year: defaultYear, type: defaultType })));
    await autoCreateRemaining();
  }

  // Auto-fill as soon as a default semester is picked (or new files are
  // added while one's already picked) — the admin shouldn't need to click
  // "Apply to all rows" by hand for the common case of "just create a
  // subject per file and let me upload."
  useEffect(() => {
    if (!defaultTermId || unmatchedRows.length === 0) return;
    const id = setTimeout(() => autoCreateRemaining(), 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultTermId, unmatchedRows.length]);

  // Uses AI to have a second, smarter attempt at matching whatever the plain
  // filename heuristic couldn't. Scoped to the currently-picked default
  // course's own subjects (not the whole catalog) — both because that's
  // almost always what a course-wise batch actually needs, and because the
  // free Groq tier's per-request token cap can't fit the full 600+ subject
  // catalog anyway.
  //
  // When the AI can't find a real match, it doesn't just suggest a name for
  // manual creation — it creates the subject itself (same as
  // autoCreateRemaining) and remembers the title -> subject association via
  // rememberAndApply, so the *next* upload with a similar title matches
  // instantly without needing AI again. That learned list is
  // SubjectMatchMemory, persisted server-side, separate from this session.
  async function aiMatchRemaining() {
    if (!defaultProgramId) return;
    const stillUnmatched = rows.filter((r) => !r.subjectId && !r.creatingNew);
    if (stillUnmatched.length === 0) return;

    const targetProgram = programs.find((p) => p.id === defaultProgramId);
    const candidates = flatSubjects.filter((s) =>
      targetProgram?.terms.some((t) => t.subjects.some((sub) => sub.id === s.id))
    );

    setAiMatching(true);
    setAiMatchError(null);
    try {
      const result = await matchSubjectsWithAI(
        stillUnmatched.map((r) => r.title),
        candidates.map((c) => ({ id: c.id, name: c.name }))
      );
      if (!result.ok) {
        setAiMatchError(result.error);
        return;
      }
      const byTitle = new Map(result.data.matches.map((m) => [m.title, m]));
      const createdForName = new Map<string, string>();

      for (const row of stillUnmatched) {
        const match = byTitle.get(row.title);
        if (!match) continue;

        if (match.subjectId && candidates.some((c) => c.id === match.subjectId)) {
          updateRow(row.key, { subjectId: match.subjectId });
          rememberAndApply(row, match.subjectId);
          continue;
        }

        const newName = match.suggestedNewSubjectName?.trim();
        if (!newName || !defaultTermId) continue;

        let subjectId = createdForName.get(newName);
        if (!subjectId) {
          try {
            const formData = new FormData();
            formData.set("termId", defaultTermId);
            formData.set("name", newName);
            const created = await quickCreateSubjectAction(formData);
            setPrograms((prev) =>
              prev.map((p) => ({
                ...p,
                terms: p.terms.map((t) =>
                  t.id === created.termId ? { ...t, subjects: [...t.subjects, created] } : t
                ),
              }))
            );
            subjectId = created.id;
            createdForName.set(newName, subjectId);
          } catch {
            continue; // leave unmatched — it'll be saved to Failed Uploads on upload
          }
        }
        updateRow(row.key, { subjectId });
        rememberAndApply(row, subjectId);
      }
    } catch (err) {
      setAiMatchError(err instanceof Error ? err.message : "AI matching failed.");
    } finally {
      setAiMatching(false);
    }
  }

  async function fileAway(row: Row, reason: string) {
    try {
      const formData = new FormData();
      formData.set("title", row.title || row.filename);
      formData.set("type", row.type);
      if (row.type === "PYQ" && row.year) formData.set("year", row.year);
      formData.set("reason", reason);
      formData.set("file", row.file);
      await saveFailedUploadAction(formData);
      return true;
    } catch {
      return false;
    }
  }

  async function uploadAll() {
    setUploading(true);
    for (const row of rows) {
      if (row.status === "done" || row.status === "duplicate") continue;

      // No subject at all — don't lose the file, file it away for later
      // instead of silently skipping it.
      if (!row.subjectId) {
        updateRow(row.key, { status: "uploading" });
        const saved = await fileAway(row, "No subject matched");
        updateRow(row.key, {
          status: "unmatched",
          message: saved
            ? "No subject picked — saved to Failed Uploads"
            : "No subject picked — AND could not save a copy either. Try Upload again.",
        });
        continue;
      }

      updateRow(row.key, { status: "uploading" });
      try {
        const formData = new FormData();
        formData.set("subjectId", row.subjectId);
        formData.set("type", row.type);
        formData.set("title", row.title || row.filename);
        if (row.type === "PYQ" && row.year) formData.set("year", row.year);
        formData.set("file", row.file);
        formData.set("batchId", batchId);
        const result = await uploadResourceAction(formData);
        if (result?.status === "duplicate") {
          updateRow(row.key, { status: "duplicate", message: "Already uploaded — skipped" });
          setKnownHashes((prev) => new Set(prev).add(row.fileHash));
        } else {
          updateRow(row.key, { status: "done", message: "Uploaded" });
          setKnownHashes((prev) => new Set(prev).add(row.fileHash));
        }
      } catch (err) {
        const reason = err instanceof Error ? err.message : "Upload failed";
        const saved = await fileAway(row, reason);
        updateRow(row.key, {
          status: "error",
          message: saved
            ? `${reason} — saved to Failed Uploads`
            : `${reason} — AND could not save a copy either. Try Upload again.`,
        });
      }
    }
    setUploading(false);
  }

  if (rows.length === 0) {
    return (
      <div className="max-w-2xl">
        {error && (
          <div className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/30">
            {error}
          </div>
        )}
        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-surface px-6 py-16 text-center transition hover:border-accent/60"
        >
          <FileArchive size={32} weight="bold" className="text-muted" />
          <p className="font-medium">
            {extracting ? "Reading zip file..." : "Drop one or more .zip files of PDFs here, or click to browse"}
          </p>
          <p className="text-sm text-muted">
            Each PDF is matched to a subject by its filename where possible. Identical files are
            only kept once.
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".zip,application/zip"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleZips(files);
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Default course</label>
          <select
            value={defaultProgramId}
            onChange={(e) => {
              setDefaultProgramId(e.target.value);
              setDefaultTermId("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Select course</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Default semester</label>
          <select
            value={defaultTermId}
            onChange={(e) => {
              const val = e.target.value;
              setDefaultTermId(val);
              if (allSemestersTerm && val === allSemestersTerm.termId) {
                setDefaultProgramId(allSemestersTerm.programId);
              }
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Select semester</option>
            {defaultProgram?.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
            {allSemestersTerm && defaultProgram?.id !== allSemestersTerm.programId && (
              <option value={allSemestersTerm.termId}>
                No specific semester (DSE / AEC / SEC / VAC / GE)
              </option>
            )}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Default type</label>
          <select
            value={defaultType}
            onChange={(e) => setDefaultType(e.target.value as "PYQ" | "NOTES")}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="PYQ">PYQ</option>
            <option value="NOTES">Notes</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Default year</label>
          <input
            value={defaultYear}
            onChange={(e) => setDefaultYear(e.target.value)}
            type="number"
            className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={applyDefaultsToAll}
          disabled={autoCreating}
          title="Subjects are created automatically as soon as you pick a semester below — use this to re-apply the default year/type, or retry any that failed to create."
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted disabled:opacity-50"
        >
          {autoCreating ? "Creating subjects..." : "Apply to all rows"}
        </button>
        <button
          type="button"
          onClick={aiMatchRemaining}
          disabled={aiMatching || !defaultProgramId || unmatchedRows.length === 0}
          title={!defaultProgramId ? "Pick a default course first — AI matching is scoped to that course's subjects" : undefined}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted disabled:opacity-50"
        >
          <Sparkle size={14} weight="bold" className="text-brand" />
          {aiMatching ? "Matching..." : "AI Match remaining"}
        </button>
        <button
          type="button"
          onClick={() => moreInputRef.current?.click()}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted"
        >
          + Add more zip files
        </button>
        <input
          ref={moreInputRef}
          type="file"
          accept=".zip,application/zip"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleZips(files);
            e.target.value = "";
          }}
        />
        <div className="ml-auto flex items-center gap-3">
          <span className="text-sm text-muted">
            {matchedCount} of {activeRows.length} matched to a subject
          </span>
          <button
            type="button"
            onClick={() => {
              setRows([]);
              setError(null);
              setDuplicatesInZip(0);
              setAlreadyUploadedInZip(0);
              setAiMatchError(null);
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted"
          >
            Start over
          </button>
          <button
            type="button"
            onClick={uploadAll}
            disabled={uploading || activeRows.length === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {uploading ? "Uploading..." : `Upload ${activeRows.length} file${activeRows.length === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {!defaultTermId && (
        <p className="mt-2 text-xs text-muted">
          Pick a default course + semester above — anything still unmatched below gets its own
          subject created automatically (named from the file), so all that&apos;s left is to hit
          Upload. Rename or regroup those subjects later once you know where they really belong.
        </p>
      )}
      {aiMatchError && <p className="mt-2 text-xs text-red-500">{aiMatchError}</p>}
      {duplicatesInZip > 0 && (
        <p className="mt-2 text-xs text-muted">
          {duplicatesInZip} duplicate file{duplicatesInZip === 1 ? "" : "s"} in this zip
          {duplicatesInZip === 1 ? " was" : " were"} identical to another file already in the
          list and skipped.
        </p>
      )}
      {alreadyUploadedInZip > 0 && (
        <p className="mt-2 text-xs text-muted">
          {alreadyUploadedInZip} file{alreadyUploadedInZip === 1 ? "" : "s"} matched something
          already uploaded previously — flagged below, will be skipped automatically.
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3 font-medium">File</th>
              <th className="px-4 py-3 font-medium">Title &amp; Subject</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Year</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {matchedRows.length > 0 && (
              <tr className="bg-green-soft/40">
                <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-green">
                  ✓ Matched ({matchedRows.length})
                </td>
              </tr>
            )}
            {matchedRows.map(renderRow)}
            {unmatchedRows.length > 0 && (
              <tr className="bg-amber-50 dark:bg-amber-950/20">
                <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  Not matched — needs a subject ({unmatchedRows.length})
                </td>
              </tr>
            )}
            {unmatchedRows.map(renderRow)}
            {duplicateRows.length > 0 && (
              <tr className="bg-surface-muted">
                <td colSpan={5} className="px-4 py-2 text-xs font-semibold text-muted">
                  Already uploaded previously — will be skipped ({duplicateRows.length})
                </td>
              </tr>
            )}
            {duplicateRows.map(renderRow)}
          </tbody>
        </table>
      </div>
    </div>
  );

  function renderRow(row: Row) {
    const newProgram = programs.find((p) => p.id === row.newProgramId);
    return (
      <Fragment key={row.key}>
                  <tr>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <FilePdf size={16} className="shrink-0 text-muted" />
                        <span className="truncate text-xs text-muted" title={row.filename}>
                          {row.filename}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-1.5">
                        <input
                          value={row.title}
                          onChange={(e) => updateRow(row.key, { title: e.target.value })}
                          className="w-full min-w-[220px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                        />
                        <select
                          value={row.creatingNew ? NEW_SUBJECT : row.subjectId}
                          onChange={(e) => onSubjectSelect(row, e.target.value)}
                          className={`w-full min-w-[220px] rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none ${
                            row.subjectId || row.creatingNew ? "border-border focus:border-accent" : "border-amber-400"
                          }`}
                        >
                          <option value="">Not matched — pick one</option>
                          <option value={NEW_SUBJECT}>+ Create new subject...</option>
                          {grouped.map(([group, groupSubjects]) => (
                            <optgroup key={group} label={group}>
                              {groupSubjects.map((s) => (
                                <option key={s.id} value={s.id}>
                                  {s.name}
                                </option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      <select
                        value={row.type}
                        onChange={(e) => updateRow(row.key, { type: e.target.value as "PYQ" | "NOTES" })}
                        className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                      >
                        <option value="PYQ">PYQ</option>
                        <option value="NOTES">Notes</option>
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <input
                        value={row.year}
                        onChange={(e) => updateRow(row.key, { year: e.target.value })}
                        type="number"
                        disabled={row.type !== "PYQ"}
                        className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-40"
                      />
                    </td>
                    <td className="px-4 py-2 text-xs">
                      {row.status === "pending" && <span className="text-muted">Waiting</span>}
                      {row.status === "uploading" && <span className="text-accent">Uploading...</span>}
                      {row.status === "done" && <span className="text-green-600">Uploaded</span>}
                      {row.status === "duplicate" && (
                        <span className="text-amber-600" title={row.message}>
                          Already uploaded
                        </span>
                      )}
                      {row.status === "unmatched" && (
                        <span
                          className={row.message?.includes("AND could not") ? "text-red-600" : "text-amber-600"}
                          title={row.message}
                        >
                          {row.message?.includes("AND could not") ? "Not saved — retry" : "Saved for later"}
                        </span>
                      )}
                      {row.status === "error" && (
                        <span
                          className={row.message?.includes("AND could not") ? "text-red-600" : "text-amber-600"}
                          title={row.message}
                        >
                          {row.message?.includes("AND could not") ? "Failed — not saved, retry" : "Failed — saved for later"}
                        </span>
                      )}
                    </td>
                  </tr>
                  {row.creatingNew && (
                    <tr className="bg-accent-soft/30">
                      <td colSpan={5} className="px-4 py-3">
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">Program</label>
                            <select
                              value={row.newProgramId}
                              onChange={(e) =>
                                updateRow(row.key, { newProgramId: e.target.value, newTermId: "" })
                              }
                              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                            >
                              <option value="">Select program</option>
                              {programs.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">Semester</label>
                            <select
                              value={row.newTermId}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (allSemestersTerm && val === allSemestersTerm.termId) {
                                  updateRow(row.key, {
                                    newTermId: val,
                                    newProgramId: allSemestersTerm.programId,
                                  });
                                } else {
                                  updateRow(row.key, { newTermId: val });
                                }
                              }}
                              className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                            >
                              <option value="">Select semester</option>
                              {newProgram?.terms.map((t) => (
                                <option key={t.id} value={t.id}>
                                  {t.name}
                                </option>
                              ))}
                              {allSemestersTerm && newProgram?.id !== allSemestersTerm.programId && (
                                <option value={allSemestersTerm.termId}>
                                  No specific semester (DSE / AEC / SEC / VAC / GE)
                                </option>
                              )}
                            </select>
                          </div>
                          <div className="flex flex-1 flex-col gap-1.5">
                            <label className="text-xs font-medium text-muted">New subject name</label>
                            <input
                              value={row.newSubjectName}
                              onChange={(e) => updateRow(row.key, { newSubjectName: e.target.value })}
                              className="w-full min-w-[200px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => createSubjectForRow(row)}
                            disabled={row.creating || !row.newTermId || !row.newSubjectName.trim()}
                            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                          >
                            {row.creating ? "Creating..." : "Create & assign"}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateRow(row.key, { creatingNew: false })}
                            className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-surface-muted"
                          >
                            Cancel
                          </button>
                        </div>
                        {row.createError && (
                          <p className="mt-2 text-xs text-red-500">{row.createError}</p>
                        )}
                      </td>
                    </tr>
                  )}
      </Fragment>
    );
  }
}
