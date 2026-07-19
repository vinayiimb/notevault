"use client";

import { useMemo, useRef, useState } from "react";
import { FolderOpen, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { findOrCreateSubjectAction, uploadResourceAction } from "@/lib/actions";

type Term = { id: string; name: string; order: number };
type Program = { id: string; name: string; terms: Term[] };

type FileStatus = "pending" | "uploading" | "done" | "duplicate" | "error";

type Row = {
  key: string;
  relativePath: string;
  file: File;
  semesterRoman: string; // "" when not detected — admin picks it
  courseFolder: string;
  year: string;
  status: FileStatus;
  message?: string;
};

const ROMAN_TO_ORDER: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
const ORDER_TO_ROMAN: Record<number, string> = { 1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI" };

// Accepts "Semester_I", "Semester I", "Sem-3", "SEM_VI", etc. — whatever
// folder-naming convention the dropped tree happens to use.
function detectSemester(segment: string): string | null {
  const m = segment.trim().match(/^sem(?:ester)?[\s_-]*([ivx]+|\d+)$/i);
  if (!m) return null;
  const token = m[1].toUpperCase();
  if (ROMAN_TO_ORDER[token] !== undefined) return token;
  const asNum = parseInt(token, 10);
  if (!Number.isNaN(asNum) && ORDER_TO_ROMAN[asNum]) return ORDER_TO_ROMAN[asNum];
  return null;
}

// Accepts "2017-18", "2017-2018", or a bare "2017".
function detectYear(segment: string): string | null {
  const cleaned = segment.trim();
  const range = cleaned.match(/^(\d{4})[-–](\d{2,4})$/);
  if (range) {
    const [, y1, y2raw] = range;
    const y2 = y2raw.length === 4 ? y2raw.slice(-2) : y2raw;
    return `${y1}-${y2}`;
  }
  if (/^\d{4}$/.test(cleaned)) return cleaned;
  return null;
}

// Works regardless of whether the tree is Semester/Course/Year.pdf or
// Semester/Year/Course/whatever.pdf — finds the semester folder anywhere,
// then tries the filename and every remaining folder for a year, and
// treats whatever's left as the course name.
function parsePath(relativePath: string) {
  const parts = relativePath.split("/").filter(Boolean);
  const filename = parts.pop() ?? relativePath;
  const nameStem = filename.replace(/\.pdf$/i, "");
  const folderSegments = parts;

  let semesterRoman = "";
  let semesterIdx = -1;
  folderSegments.forEach((seg, i) => {
    if (semesterRoman) return;
    const detected = detectSemester(seg);
    if (detected) {
      semesterRoman = detected;
      semesterIdx = i;
    }
  });

  const remaining = folderSegments.filter((_, i) => i !== semesterIdx);

  let year = detectYear(nameStem);
  let courseParts = remaining;
  if (!year) {
    const yearIdx = remaining.findIndex((seg) => detectYear(seg));
    if (yearIdx >= 0) {
      year = detectYear(remaining[yearIdx]);
      courseParts = remaining.filter((_, i) => i !== yearIdx);
    }
  }

  const courseFolder = courseParts.length > 0 ? courseParts[courseParts.length - 1] : nameStem;

  return { semesterRoman, courseFolder, year: year ?? "" };
}

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type DroppedEntry = { file: File; relativePath: string };

async function readEntry(entry: FileSystemEntry, base: string, out: DroppedEntry[]): Promise<void> {
  if (entry.isFile) {
    const fileEntry = entry as FileSystemFileEntry;
    const file = await new Promise<File>((resolve, reject) => fileEntry.file(resolve, reject));
    out.push({ file, relativePath: `${base}${file.name}` });
    return;
  }
  if (entry.isDirectory) {
    const dirEntry = entry as FileSystemDirectoryEntry;
    const reader = dirEntry.createReader();
    const children: FileSystemEntry[] = [];
    // readEntries only returns a batch at a time — keep calling until empty.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) =>
        reader.readEntries(resolve, reject)
      );
      if (batch.length === 0) break;
      children.push(...batch);
    }
    for (const child of children) {
      await readEntry(child, `${base}${dirEntry.name}/`, out);
    }
  }
}

export function FolderUploadClient({
  programs,
  existingHashes,
}: {
  programs: Program[];
  existingHashes: string[];
}) {
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [courseProgram, setCourseProgram] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const knownHashes = useMemo(() => new Set(existingHashes), [existingHashes]);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const courseFolders = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) set.add(r.courseFolder);
    return Array.from(set).sort();
  }, [rows]);

  function addDropped(entries: DroppedEntry[]) {
    const pdfEntries = entries.filter((e) => /\.pdf$/i.test(e.file.name));
    if (pdfEntries.length === 0) {
      setError("No PDF files found in what was dropped.");
      return;
    }
    setRows((prev) => {
      const seen = new Set(prev.map((r) => r.relativePath));
      const additions: Row[] = [];
      for (const { file, relativePath } of pdfEntries) {
        if (seen.has(relativePath)) continue;
        seen.add(relativePath);
        const { semesterRoman, courseFolder, year } = parsePath(relativePath);
        additions.push({
          key: relativePath,
          relativePath,
          file,
          semesterRoman,
          courseFolder,
          year,
          status: "pending",
        });
      }
      return [...prev, ...additions];
    });
  }

  async function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault();
    setError(null);
    setReading(true);
    try {
      const items = Array.from(e.dataTransfer.items);
      const entries = items
        .map((item) => item.webkitGetAsEntry?.())
        .filter((entry): entry is FileSystemEntry => !!entry);

      if (entries.length > 0) {
        const out: DroppedEntry[] = [];
        for (const entry of entries) {
          await readEntry(entry, "", out);
        }
        addDropped(out);
      } else {
        // Fallback for browsers without webkitGetAsEntry support.
        const files = Array.from(e.dataTransfer.files);
        addDropped(files.map((file) => ({ file, relativePath: file.name })));
      }
    } catch (err) {
      setError(`Could not read what was dropped: ${err instanceof Error ? err.message : err}`);
    } finally {
      setReading(false);
    }
  }

  function handlePickedFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    addDropped(
      files.map((file) => ({
        file,
        relativePath: file.webkitRelativePath || file.name,
      }))
    );
  }

  function updateRow(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function resolveTermId(program: Program, semesterRoman: string): string | null {
    const allSemesters = program.terms.find((t) => t.name === "All Semesters");
    if (allSemesters && program.terms.length === 1) return allSemesters.id;

    const order = ROMAN_TO_ORDER[semesterRoman];
    const specific = order ? program.terms.find((t) => t.order === order) : undefined;
    if (specific) return specific.id;
    return allSemesters?.id ?? null;
  }

  async function uploadAll() {
    setUploading(true);
    const subjectCache = new Map<string, string>();
    const seenThisRun = new Set<string>();

    for (const row of rows) {
      if (row.status === "done" || row.status === "duplicate") continue;
      if (!row.year.trim()) {
        updateRow(row.key, { status: "error", message: "Year is required" });
        continue;
      }
      const programId = courseProgram[row.courseFolder];
      const program = programs.find((p) => p.id === programId);
      if (!program) {
        updateRow(row.key, { status: "error", message: "No course chosen for this folder" });
        continue;
      }
      const termId = resolveTermId(program, row.semesterRoman);
      if (!termId) {
        updateRow(row.key, {
          status: "error",
          message: row.semesterRoman
            ? `${program.name} has no matching semester`
            : "Choose a semester for this file",
        });
        continue;
      }

      updateRow(row.key, { status: "uploading" });
      try {
        const bytes = await row.file.arrayBuffer();
        const hash = await sha256Hex(bytes);
        if (knownHashes.has(hash) || seenThisRun.has(hash)) {
          updateRow(row.key, { status: "duplicate", message: "Already uploaded" });
          continue;
        }

        const cacheKey = `${termId}::${row.courseFolder}`;
        let subjectId = subjectCache.get(cacheKey);
        if (!subjectId) {
          const subjectForm = new FormData();
          subjectForm.set("termId", termId);
          subjectForm.set("name", row.courseFolder);
          const subject = await findOrCreateSubjectAction(subjectForm);
          subjectId = subject.id;
          subjectCache.set(cacheKey, subjectId);
        }

        const uploadForm = new FormData();
        uploadForm.set("subjectId", subjectId);
        uploadForm.set("type", "PYQ");
        uploadForm.set("title", `${row.courseFolder} — ${row.year}`);
        uploadForm.set("year", row.year.slice(0, 4));
        uploadForm.set("file", new File([bytes], `${row.year}.pdf`, { type: "application/pdf" }));
        const result = await uploadResourceAction(uploadForm);
        if (result?.status === "duplicate") {
          updateRow(row.key, { status: "duplicate", message: "Already uploaded" });
        } else {
          updateRow(row.key, { status: "done", message: "Uploaded" });
        }
        seenThisRun.add(hash);
      } catch (err) {
        updateRow(row.key, {
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
      }
    }
    setUploading(false);
  }

  const doneCount = rows.filter((r) => r.status === "done" || r.status === "duplicate").length;
  const allMapped =
    courseFolders.length > 0 &&
    courseFolders.every((c) => courseProgram[c]) &&
    rows.every((r) => r.year.trim().length > 0);

  const dropZone = (
    <label
      className="flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-surface p-10 text-center transition hover:border-accent"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <FolderOpen size={32} weight="bold" className="text-muted" />
      <span className="text-sm font-medium">
        {reading ? "Reading dropped files..." : "Drop folders and/or PDFs here"}
      </span>
      <span className="text-xs text-muted">or</span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            folderInputRef.current?.click();
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
        >
          Choose folder
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            fileInputRef.current?.click();
          }}
          className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-surface-muted"
        >
          Choose PDFs
        </button>
      </span>
      <input
        ref={folderInputRef}
        type="file"
        // @ts-expect-error -- webkitdirectory isn't in the DOM lib typings
        webkitdirectory=""
        directory=""
        multiple
        className="hidden"
        onChange={(e) => {
          handlePickedFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        multiple
        className="hidden"
        onChange={(e) => {
          handlePickedFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  if (rows.length === 0) {
    return (
      <div>
        {dropZone}
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="rounded-xl border border-dashed border-border bg-surface-muted/40 p-3 text-xs text-muted">
        <span className="mr-2">Add more:</span>
        <button
          type="button"
          onClick={() => folderInputRef.current?.click()}
          className="mr-2 rounded-lg border border-border bg-background px-2 py-1 font-medium hover:bg-surface-muted"
        >
          Choose folder
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-border bg-background px-2 py-1 font-medium hover:bg-surface-muted"
        >
          Choose PDFs
        </button>
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error -- webkitdirectory isn't in the DOM lib typings
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={(e) => {
            handlePickedFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            handlePickedFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="rounded-xl border border-border bg-surface p-4">
        <p className="text-sm font-medium">
          Map each course folder to a course ({courseFolders.length} found)
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {courseFolders.map((folder) => {
            const count = rows.filter((r) => r.courseFolder === folder).length;
            return (
              <div key={folder} className="flex flex-wrap items-center gap-3">
                <span className="min-w-[240px] text-sm font-medium">{folder}</span>
                <span className="text-xs text-muted">{count} file{count === 1 ? "" : "s"}</span>
                <select
                  value={courseProgram[folder] ?? ""}
                  onChange={(e) =>
                    setCourseProgram((prev) => ({ ...prev, [folder]: e.target.value }))
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
          title={!allMapped ? "Map every course folder and fill in every year first" : undefined}
          className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          <UploadSimple size={16} weight="bold" />
          {uploading ? "Uploading..." : `Upload all ${rows.length} files`}
        </button>
        <span className="text-sm text-muted">
          {doneCount} of {rows.length} done
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-2 text-left">File</th>
              <th className="px-4 py-2 text-left">Semester</th>
              <th className="px-4 py-2 text-left">Course folder</th>
              <th className="px-4 py-2 text-left">Year</th>
              <th className="px-4 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((r) => (
              <tr key={r.key}>
                <td className="max-w-xs truncate px-4 py-2 text-xs text-muted" title={r.relativePath}>
                  {r.relativePath}
                </td>
                <td className="px-4 py-2">
                  <select
                    value={r.semesterRoman}
                    onChange={(e) => updateRow(r.key, { semesterRoman: e.target.value })}
                    className="rounded-lg border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
                  >
                    <option value="">Not detected</option>
                    {Object.keys(ROMAN_TO_ORDER).map((roman) => (
                      <option key={roman} value={roman}>
                        {roman}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={r.courseFolder}
                    onChange={(e) => updateRow(r.key, { courseFolder: e.target.value })}
                    className="w-40 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2">
                  <input
                    value={r.year}
                    onChange={(e) => updateRow(r.key, { year: e.target.value })}
                    placeholder="2024-25"
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2">
                  {r.status === "pending" && <span className="text-muted">Waiting</span>}
                  {r.status === "uploading" && <span className="text-accent">Uploading...</span>}
                  {r.status === "done" && <span className="text-green-600">Uploaded</span>}
                  {r.status === "duplicate" && <span className="text-muted">{r.message}</span>}
                  {r.status === "error" && <span className="text-red-500">{r.message}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
