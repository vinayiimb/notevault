// @ts-nocheck
"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { FileArchive, FilePdf, Sparkle } from "@phosphor-icons/react/dist/ssr";
import {
  rememberSubjectMatchAction,
  saveFailedUploadAction,
  uploadResourceAction,
} from "@/lib/actions";
import { matchSubjectsWithAI } from "@/lib/ai";
import { guessSubject, guessYear, normalizeMemoryKey } from "@/lib/subject-match";
import type { AcademicProgram } from "@/lib/academic-types";

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
  const programs = initialPrograms;
  const [memory, setMemory] = useState(initialMemory);
  const [knownHashes, setKnownHashes] = useState(() => new Set(existingHashes));
  const [rows, setRows] = useState<Row[]>([]);
  const [defaultYear, setDefaultYear] = useState("2024");
  const [defaultType, setDefaultType] = useState<"PYQ" | "NOTES">("PYQ");
  const [defaultProgramId, setDefaultProgramId] = useState("");
  const [defaultTermId, setDefaultTermId] = useState("");
  // When the whole batch is really just one subject's papers across years
  // (the common case), picking this once assigns it to every row — the
  // per-row Title & Subject editor then collapses to a simple label, with a
  // "change" link for the rare outlier file that doesn't belong.
  const [defaultSubjectId, setDefaultSubjectId] = useState("");
  const [overriddenKeys, setOverriddenKeys] = useState<Set<string>>(new Set());
  const [extracting, setExtracting] = useState(false);
  const [duplicatesInZip, setDuplicatesInZip] = useState(0);
  const [alreadyUploadedInZip, setAlreadyUploadedInZip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [aiMatching, setAiMatching] = useState(false);
  const [aiMatchError, setAiMatchError] = useState<string | null>(null);
  const [batchId] = useState(() => crypto.randomUUID());
  const inputRef = useRef<HTMLInputElement>(null);
  const moreInputRef = useRef<HTMLInputElement>(null);

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
  const defaultTerm = defaultProgram?.terms.find((t) => t.id === defaultTermId);
  const defaultTermSubjects = defaultTerm?.subjects ?? [];
  const defaultSubject = defaultTermSubjects.find((s) => s.id === defaultSubjectId);

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
          // A default subject means the whole batch is one subject's papers
          // — skip the per-file heuristic entirely and use it directly.
          const subjectId = defaultSubjectId || (guessSubject(filename, flatSubjects, memory) ?? "");
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
            year: String(guessYear(filename) ?? defaultYear),
            type: defaultType,
            status: alreadyInDb ? "duplicate" : "pending",
            message: alreadyInDb ? "Already uploaded previously — skipped" : undefined,
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
    updateRow(row.key, { subjectId: value });
    if (value) rememberAndApply(row, value);
  }

  function applyDefaultsToAll() {
    setRows((prev) => prev.map((r) => ({ ...r, year: defaultYear, type: defaultType })));
  }

  // Sets the default subject and assigns it to every row that hasn't been
  // individually flagged as an exception via toggleOverride.
  function applyDefaultSubject(subjectId: string) {
    setDefaultSubjectId(subjectId);
    if (!subjectId) return;
    setRows((prev) => prev.map((r) => (overriddenKeys.has(r.key) ? r : { ...r, subjectId })));
  }

  // Toggles a single row out of (or back into) the default-subject
  // cascade — for the rare file in an otherwise single-subject batch that
  // actually belongs somewhere else, without giving up the simplified view
  // for every other row.
  function toggleOverride(row: Row) {
    setOverriddenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(row.key)) {
        next.delete(row.key);
        if (defaultSubjectId) updateRow(row.key, { subjectId: defaultSubjectId });
      } else {
        next.add(row.key);
      }
      return next;
    });
  }

  // Uses AI to have a second, smarter attempt at matching whatever the plain
  // filename heuristic couldn't. Scoped to the currently-picked default
  // course's own subjects (not the whole catalog) — both because that's
  // almost always what a course-wise batch actually needs, and because the
  // free Groq tier's per-request token cap can't fit the full 600+ subject
  // catalog anyway.
  //
  // AI may select only an existing canonical subject ID. Suggestions for new
  // names remain unmatched and are sent to review during upload.
  async function aiMatchRemaining() {
    if (!defaultProgramId) return;
    const stillUnmatched = rows.filter((r) => !r.subjectId);
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
      for (const row of stillUnmatched) {
        const match = byTitle.get(row.title);
        if (!match) continue;

        if (match.subjectId && candidates.some((c) => c.id === match.subjectId)) {
          updateRow(row.key, { subjectId: match.subjectId });
          rememberAndApply(row, match.subjectId);
          continue;
        }
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

  async function uploadRow(row: Row) {
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
      return;
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

  // Uploads run UPLOAD_CONCURRENCY at a time instead of one-by-one — with
  // dozens of PDFs in a batch, each a real network round-trip to Blob, doing
  // them serially was the main reason bulk upload felt slow.
  const UPLOAD_CONCURRENCY = 5;

  async function uploadAll() {
    setUploading(true);
    const toUpload = rows.filter((r) => r.status !== "done" && r.status !== "duplicate");
    setUploadProgress({ done: 0, total: toUpload.length });

    let nextIndex = 0;
    async function worker() {
      while (nextIndex < toUpload.length) {
        const row = toUpload[nextIndex++];
        await uploadRow(row);
        setUploadProgress((p) => ({ ...p, done: p.done + 1 }));
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(UPLOAD_CONCURRENCY, toUpload.length) }, worker)
    );

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
              setDefaultSubjectId("");
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
              setDefaultSubjectId("");
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
          <label className="text-xs font-medium text-muted">Default subject</label>
          <select
            value={defaultSubjectId}
            onChange={(e) => {
              const val = e.target.value;
              applyDefaultSubject(val);
            }}
            disabled={!defaultTermId}
            title={!defaultTermId ? "Pick a default semester first" : "Whole batch is one subject's papers across years? Set it here."}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="">One subject for this whole batch?</option>
            {defaultTermSubjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
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
          title="Apply the selected year and document type to every row."
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted"
        >
          Apply to all rows
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
              setDefaultSubjectId("");
              setOverriddenKeys(new Set());
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

      {uploading && (
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-all duration-300"
              style={{
                width: `${uploadProgress.total === 0 ? 0 : (uploadProgress.done / uploadProgress.total) * 100}%`,
              }}
            />
          </div>
          <span className="shrink-0 text-xs text-muted">
            {uploadProgress.done} of {uploadProgress.total}
          </span>
        </div>
      )}

      {!defaultTermId && (
        <p className="mt-2 text-xs text-muted">
          Pick a default course and semester to limit matching to the official subject list.
          Unmatched files are saved to Failed Uploads for manual review; no subject is created from a filename.
        </p>
      )}
      {defaultTermId && !defaultSubjectId && (
        <p className="mt-2 text-xs text-muted">
          If this whole batch is one subject&apos;s papers across years, pick it in{" "}
          <strong>Default subject</strong> above — every row below will use it and the table
          collapses to just File + Year, with a &quot;change&quot; link for any file that&apos;s an exception.
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
                      {defaultSubjectId && !overriddenKeys.has(row.key) ? (
                        <div className="flex flex-col gap-1">
                          <input
                            value={row.title}
                            onChange={(e) => updateRow(row.key, { title: e.target.value })}
                            className="w-full min-w-[220px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                          />
                          <div className="flex items-center gap-2 text-xs text-muted">
                            <span>Subject: {defaultSubject?.name ?? "—"}</span>
                            <button
                              type="button"
                              onClick={() => toggleOverride(row)}
                              className="text-accent underline-offset-2 hover:underline"
                            >
                              not this one?
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {defaultSubjectId && (
                            <button
                              type="button"
                              onClick={() => toggleOverride(row)}
                              className="self-start text-xs text-accent underline-offset-2 hover:underline"
                            >
                              ← use default subject ({defaultSubject?.name})
                            </button>
                          )}
                          <input
                            value={row.title}
                            onChange={(e) => updateRow(row.key, { title: e.target.value })}
                            className="w-full min-w-[220px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                          />
                          <select
                            value={row.subjectId}
                            onChange={(e) => onSubjectSelect(row, e.target.value)}
                            className={`w-full min-w-[220px] rounded-lg border bg-background px-2 py-1.5 text-sm focus:outline-none ${
                              row.subjectId ? "border-border focus:border-accent" : "border-amber-400"
                            }`}
                          >
                            <option value="">Not matched — pick one</option>
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
                      )}
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
      </Fragment>
    );
  }
}
