"use client";

import { useMemo, useState } from "react";
import { FileArchive, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { findOrCreateSubjectAction, uploadResourceAction } from "@/lib/actions";

type Term = { id: string; name: string; order: number };
type Program = { id: string; name: string; terms: Term[] };

type ParsedFile = {
  path: string;
  subjectFolder: string;
  semesterRoman: string;
  year: string;
  bytes: ArrayBuffer;
};

type FileStatus = "pending" | "uploading" | "done" | "duplicate" | "error";

type FlatFile = ParsedFile & { key: string; status: FileStatus; message?: string };

const ROMAN_TO_ORDER: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };

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

// Matches "Semester_I/Physics/2017-18.pdf" (or "2017-2018.pdf") anywhere in
// the zip path — tolerant of a wrapping root folder like
// "DBC_By_Semester/Semester_I/...".
const ENTRY_RE = /Semester_(I|II|III|IV|V|VI)\/([^/]+)\/(\d{4}-\d{2,4})\.pdf$/i;

export function ConsolidatedUploadClient({
  programs,
  existingHashes,
}: {
  programs: Program[];
  existingHashes: string[];
}) {
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    setExtracting(true);
    try {
      const JSZip = (await import("jszip")).default;
      const newFiles: FlatFile[] = [];
      const seen = new Set<string>(files.map((f) => f.path));

      for (const zipFile of zipFiles) {
        const zip = await JSZip.loadAsync(zipFile);
        for (const [path, entry] of Object.entries(zip.files)) {
          if (entry.dir) continue;
          const match = path.match(ENTRY_RE);
          if (!match) continue;
          if (seen.has(path)) continue;
          seen.add(path);

          const [, semesterRoman, subjectFolder, yearRaw] = match;
          const bytes = await entry.async("arraybuffer");
          const year = yearRaw.length > 7 ? `${yearRaw.slice(0, 4)}-${yearRaw.slice(-2)}` : yearRaw;

          newFiles.push({
            key: path,
            path,
            subjectFolder,
            semesterRoman: semesterRoman.toUpperCase(),
            year,
            bytes,
            status: "pending",
          });
        }
      }

      if (newFiles.length === 0) {
        setError(
          "No matching files found. Expected paths like \"Semester_I/Physics/2017-18.pdf\" inside the zip."
        );
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

  function resolveTermId(program: Program, semesterRoman: string): string | null {
    // A program with only one "All Semesters" term (GE Pool) or one that
    // also happens to carry it (Common Pool) uses that single bucket
    // regardless of which Semester_X folder the file came from.
    const allSemesters = program.terms.find((t) => t.name === "All Semesters");
    if (allSemesters && program.terms.length === 1) return allSemesters.id;

    const order = ROMAN_TO_ORDER[semesterRoman];
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
      const termId = resolveTermId(program, file.semesterRoman);
      if (!termId) {
        updateFile(file.key, { status: "error", message: `${program.name} has no matching semester` });
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
        uploadForm.set("title", `${file.subjectFolder} — ${file.year}`);
        uploadForm.set("year", file.year.slice(0, 4));
        uploadForm.set("file", new File([file.bytes], `${file.year}.pdf`, { type: "application/pdf" }));
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
            {extracting ? "Reading zip file..." : "Drop a zip of Semester_X/Subject/Year.pdf files here"}
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
                <td className="px-4 py-2">{f.semesterRoman}</td>
                <td className="px-4 py-2">{f.year}</td>
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
