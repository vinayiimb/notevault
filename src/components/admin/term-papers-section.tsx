"use client";

import { useRef, useState } from "react";
import { FileArchive, Trash, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import {
  deleteTermPaperAction,
  finalizeTermPaperUploadAction,
  prepareTermPaperUploadAction,
  uploadTermPaperAction,
} from "@/lib/actions";

type Term = { id: string; name: string; order: number };
type TermPaper = {
  id: string;
  termId: string;
  academicYear: string | null;
  year: number | null;
  fileName: string;
  fileUrl: string;
};

type RowStatus = "idle" | "uploading" | "done" | "duplicate" | "error";

const SEM_WORD_TO_ORDER: Record<string, number> = {
  "1st": 1, first: 1, ist: 1, i: 1,
  "2nd": 2, second: 2, iind: 2, ii: 2,
  "3rd": 3, third: 3, iiird: 3, iii: 3,
  "4th": 4, fourth: 4, ivth: 4, iv: 4,
  "5th": 5, fifth: 5, vth: 5, v: 5,
  "6th": 6, sixth: 6, vith: 6, vi: 6,
};
const SEMESTER_PHRASE_RE = /([a-z0-9]+)\s*[-–—]?\s*semesters?\b|\bsemesters?\s*[-–—]?\s*([a-z0-9]+)/i;

function extractSemesterOrder(text: string): number | null {
  const m = text.match(SEMESTER_PHRASE_RE);
  if (!m) return null;
  const token = (m[1] ?? m[2] ?? "").toLowerCase();
  return SEM_WORD_TO_ORDER[token] ?? null;
}

function extractYear(text: string): string | null {
  const range = text.match(/(?:19|20)\d{2}\s*[-–]\s*\d{2,4}/);
  if (range) {
    const [y1, y2raw] = range[0].split(/[-–]/).map((s) => s.trim());
    const y2 = y2raw.length === 4 ? y2raw.slice(-2) : y2raw;
    return `${y1}-${y2}`;
  }
  const single = text.match(/(?:19|20)\d{2}/);
  return single ? single[0] : null;
}

// A term with only one "All Semesters" bucket matches any file regardless
// of a detected order; otherwise the file's order must match the term's.
function matchTermForFile(fileName: string, terms: Term[]): { term: Term; year: string | null } | null {
  const base = fileName.replace(/\.pdf$/i, "");
  const order = extractSemesterOrder(base);
  const year = extractYear(base);
  const singleTerm = terms.length === 1 ? terms[0] : null;
  const term = (order ? terms.find((t) => t.order === order) : undefined) ?? singleTerm ?? undefined;
  return term ? { term, year } : null;
}

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function TermPapersSection({
  terms,
  papers,
}: {
  terms: Term[];
  papers: TermPaper[];
  programId: string;
}) {
  const sortedTerms = [...terms].sort((a, b) => a.order - b.order);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [years, setYears] = useState<Record<string, string>>({});
  const [applyYear, setApplyYear] = useState("");
  const [files, setFiles] = useState<Record<string, File>>({});
  const [status, setStatus] = useState<Record<string, RowStatus>>({});
  const [message, setMessage] = useState<Record<string, string>>({});
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [existingPapers, setExistingPapers] = useState(papers);
  const inputRef = useRef<HTMLInputElement>(null);

  function toggle(termId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(termId)) next.delete(termId);
      else next.add(termId);
      return next;
    });
  }

  function applyYearToChecked() {
    if (!applyYear.trim()) return;
    setYears((prev) => {
      const next = { ...prev };
      for (const termId of checked) next[termId] = applyYear.trim();
      return next;
    });
  }

  function handleFiles(selected: File[]) {
    const stillUnmatched: string[] = [];
    const newFiles: Record<string, File> = {};
    const newYears: Record<string, string> = {};
    const toCheck: string[] = [];

    for (const file of selected) {
      if (!/\.pdf$/i.test(file.name)) continue;
      const match = matchTermForFile(file.name, sortedTerms);
      if (!match) {
        stillUnmatched.push(file.name);
        continue;
      }
      newFiles[match.term.id] = file;
      if (match.year) newYears[match.term.id] = match.year;
      toCheck.push(match.term.id);
    }

    setFiles((prev) => ({ ...prev, ...newFiles }));
    setYears((prev) => ({ ...prev, ...newYears }));
    setChecked((prev) => {
      const next = new Set(prev);
      for (const id of toCheck) next.add(id);
      return next;
    });
    setUnmatched(stillUnmatched);
  }

  async function uploadAll() {
    setUploading(true);
    const rows = sortedTerms.filter((t) => checked.has(t.id) && files[t.id]);

    for (const term of rows) {
      const file = files[term.id];
      const year = years[term.id]?.trim();
      if (!file) continue;
      if (!year) {
        setStatus((prev) => ({ ...prev, [term.id]: "error" }));
        setMessage((prev) => ({ ...prev, [term.id]: "Year is required" }));
        continue;
      }

      setStatus((prev) => ({ ...prev, [term.id]: "uploading" }));
      try {
        const bytes = await file.arrayBuffer();
        const hash = await sha256Hex(bytes);
        const yearStart = year.match(/(?:19|20)\d{2}/)?.[0] ?? "";

        const formData = new FormData();
        formData.set("termId", term.id);
        formData.set("year", yearStart);
        formData.set("academicYear", year);
        formData.set("fileName", file.name);
        formData.set("fileSize", String(bytes.byteLength));
        formData.set("fileHash", hash);

        const prepared = await prepareTermPaperUploadAction(formData);
        let result: { status: "created" | "duplicate"; termPaperId: string };
        if (prepared.status === "duplicate") {
          result = prepared;
        } else if (prepared.status === "ready") {
          try {
            const putResponse = await fetch(prepared.uploadUrl, {
              method: "PUT",
              headers: { "Content-Type": "application/pdf" },
              body: bytes,
            });
            if (!putResponse.ok) throw new Error(`Storage rejected the PDF (${putResponse.status}).`);
            formData.set("key", prepared.key);
            formData.set("fileUrl", prepared.fileUrl);
            result = await finalizeTermPaperUploadAction(formData);
          } catch (directError) {
            if (bytes.byteLength > 4 * 1024 * 1024) {
              throw new Error(
                "This PDF is too large for the direct-to-storage upload, which failed (likely the R2 bucket's CORS policy) — " +
                  "large files can't use the backup path either, since Vercel caps request size well below this file's size. Fix the R2 CORS policy and retry.",
              );
            }
            formData.set("file", file);
            result = await uploadTermPaperAction(formData);
            void directError;
          }
        } else {
          formData.set("file", file);
          result = await uploadTermPaperAction(formData);
        }

        setStatus((prev) => ({ ...prev, [term.id]: result.status === "duplicate" ? "duplicate" : "done" }));
        setMessage((prev) => ({
          ...prev,
          [term.id]: result.status === "duplicate" ? "Already uploaded" : "Uploaded",
        }));
        if (result.status === "created") {
          setExistingPapers((prev) => [
            ...prev,
            { id: result.termPaperId, termId: term.id, academicYear: year, year: Number(yearStart) || null, fileName: file.name, fileUrl: "" },
          ]);
        }
      } catch (err) {
        setStatus((prev) => ({ ...prev, [term.id]: "error" }));
        setMessage((prev) => ({ ...prev, [term.id]: err instanceof Error ? err.message : "Upload failed" }));
      }
    }
    setUploading(false);
  }

  async function handleDelete(paperId: string) {
    if (!confirm("Delete this term paper?")) return;
    const formData = new FormData();
    formData.set("id", paperId);
    await deleteTermPaperAction(formData);
    setExistingPapers((prev) => prev.filter((p) => p.id !== paperId));
  }

  const uploadableCount = sortedTerms.filter((t) => checked.has(t.id) && files[t.id]).length;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-medium">Term papers</h3>
      <p className="mt-1 text-xs text-muted">
        One combined PDF per semester covering every subject. Check the semesters you have a file for,
        set a year, then drop or select several PDFs at once — each is matched to its semester by
        parsing the semester (and year, if present) out of its filename.
      </p>

      <div className="mt-4 flex items-center gap-2">
        <input
          type="text"
          value={applyYear}
          onChange={(e) => setApplyYear(e.target.value)}
          placeholder="e.g. 2024-25"
          className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={applyYearToChecked}
          disabled={!applyYear.trim() || checked.size === 0}
          className="rounded-lg border border-accent px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-accent/10 disabled:opacity-50"
        >
          Apply year to {checked.size} checked
        </button>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted text-xs font-semibold tracking-wide text-muted uppercase">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Semester</th>
              <th className="px-3 py-2 text-left">Year</th>
              <th className="px-3 py-2 text-left">File</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {sortedTerms.map((term) => {
              const termPapers = existingPapers.filter((p) => p.termId === term.id);
              return (
                <tr key={term.id} className={checked.has(term.id) ? "bg-accent-soft/30" : undefined}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.has(term.id)} onChange={() => toggle(term.id)} />
                  </td>
                  <td className="px-3 py-2">{term.name}</td>
                  <td className="px-3 py-2">
                    <input
                      type="text"
                      value={years[term.id] ?? ""}
                      onChange={(e) => setYears((prev) => ({ ...prev, [term.id]: e.target.value }))}
                      placeholder="2024-25"
                      className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none"
                    />
                  </td>
                  <td className="max-w-[180px] truncate px-3 py-2 text-xs text-muted" title={files[term.id]?.name}>
                    {files[term.id]?.name ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {status[term.id] === "uploading" && <span className="text-accent">Uploading...</span>}
                    {status[term.id] === "done" && <span className="text-green-600">Uploaded</span>}
                    {status[term.id] === "duplicate" && <span className="text-muted">{message[term.id]}</span>}
                    {status[term.id] === "error" && <span className="text-red-500">{message[term.id]}</span>}
                  </td>
                  <td className="px-3 py-2">
                    {termPapers.length === 0 ? (
                      <span className="text-xs text-muted">None</span>
                    ) : (
                      <ul className="flex flex-col gap-1">
                        {termPapers.map((paper) => (
                          <li key={paper.id} className="flex items-center gap-2 text-xs">
                            {paper.fileUrl ? (
                              <a
                                href={paper.fileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 hover:text-accent"
                              >
                                <FileArchive size={12} />
                                {paper.academicYear ?? paper.year ?? "Undated"}
                              </a>
                            ) : (
                              <span className="flex items-center gap-1 text-muted">
                                <FileArchive size={12} />
                                {paper.academicYear ?? paper.year ?? "Undated"}
                              </span>
                            )}
                            <button type="button" onClick={() => handleDelete(paper.id)} className="text-red-500 hover:underline">
                              <Trash size={12} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <label
        className="mt-4 flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-background p-6 text-center transition hover:border-accent"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = Array.from(e.dataTransfer.files).filter((f) => /\.pdf$/i.test(f.name));
          if (dropped.length > 0) handleFiles(dropped);
        }}
      >
        <FileArchive size={24} weight="bold" className="text-muted" />
        <span className="text-sm font-medium">Drop one or more combined semester PDFs here</span>
        <span className="text-xs text-muted">or click to select multiple files</span>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          multiple
          className="hidden"
          onChange={(e) => {
            const picked = Array.from(e.target.files ?? []);
            if (picked.length > 0) handleFiles(picked);
            e.target.value = "";
          }}
        />
      </label>

      {unmatched.length > 0 && (
        <p className="mt-2 text-xs text-amber-500">
          Couldn&apos;t match {unmatched.length} file{unmatched.length === 1 ? "" : "s"} to a semester:{" "}
          {unmatched.join(", ")}
        </p>
      )}

      <button
        type="button"
        onClick={uploadAll}
        disabled={uploading || uploadableCount === 0}
        className="mt-4 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        <UploadSimple size={16} weight="bold" />
        {uploading ? "Uploading..." : `Upload ${uploadableCount} file${uploadableCount === 1 ? "" : "s"}`}
      </button>
    </div>
  );
}
