"use client";

import { useState } from "react";
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

type PendingFile = {
  key: string;
  file: File;
  year: string;
  status: "idle" | "uploading" | "done" | "duplicate" | "error";
  message?: string;
};

function extractYear(fileName: string): string {
  const base = fileName.replace(/\.pdf$/i, "");
  const range = base.match(/(?:19|20)\d{2}\s*[-–]\s*\d{2,4}/);
  if (range) {
    const [y1, y2raw] = range[0].split(/[-–]/).map((s) => s.trim());
    const y2 = y2raw.length === 4 ? y2raw.slice(-2) : y2raw;
    return `${y1}-${y2}`;
  }
  const single = base.match(/(?:19|20)\d{2}/);
  return single ? single[0] : "";
}

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function TermPapersSection({ terms, papers }: { terms: Term[]; papers: TermPaper[] }) {
  const sortedTerms = [...terms].sort((a, b) => a.order - b.order);
  const [openTermId, setOpenTermId] = useState<string | null>(null);
  const [pendingByTerm, setPendingByTerm] = useState<Record<string, PendingFile[]>>({});
  const [existingPapers, setExistingPapers] = useState(papers);
  const [uploading, setUploading] = useState(false);

  function addFiles(termId: string, selected: File[]) {
    const additions: PendingFile[] = selected
      .filter((f) => /\.pdf$/i.test(f.name))
      .map((f) => ({ key: `${f.name}-${f.size}-${f.lastModified}`, file: f, year: extractYear(f.name), status: "idle" }));
    setPendingByTerm((prev) => {
      const existing = prev[termId] ?? [];
      const seen = new Set(existing.map((p) => p.key));
      return { ...prev, [termId]: [...existing, ...additions.filter((a) => !seen.has(a.key))] };
    });
  }

  function updatePendingYear(termId: string, key: string, year: string) {
    setPendingByTerm((prev) => ({
      ...prev,
      [termId]: (prev[termId] ?? []).map((p) => (p.key === key ? { ...p, year } : p)),
    }));
  }

  function removePending(termId: string, key: string) {
    setPendingByTerm((prev) => ({ ...prev, [termId]: (prev[termId] ?? []).filter((p) => p.key !== key) }));
  }

  function updatePendingStatus(termId: string, key: string, patch: Partial<PendingFile>) {
    setPendingByTerm((prev) => ({
      ...prev,
      [termId]: (prev[termId] ?? []).map((p) => (p.key === key ? { ...p, ...patch } : p)),
    }));
  }

  async function uploadPending(termId: string) {
    setUploading(true);
    const pending = pendingByTerm[termId] ?? [];
    for (const item of pending) {
      if (item.status === "done" || item.status === "duplicate") continue;
      if (!item.year.trim()) {
        updatePendingStatus(termId, item.key, { status: "error", message: "Year is required" });
        continue;
      }

      updatePendingStatus(termId, item.key, { status: "uploading" });
      try {
        const bytes = await item.file.arrayBuffer();
        const hash = await sha256Hex(bytes);
        const yearStart = item.year.match(/(?:19|20)\d{2}/)?.[0] ?? "";

        const formData = new FormData();
        formData.set("termId", termId);
        formData.set("year", yearStart);
        formData.set("academicYear", item.year.trim());
        formData.set("fileName", item.file.name);
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
            formData.set("file", item.file);
            result = await uploadTermPaperAction(formData);
            void directError;
          }
        } else {
          formData.set("file", item.file);
          result = await uploadTermPaperAction(formData);
        }

        updatePendingStatus(termId, item.key, {
          status: result.status === "duplicate" ? "duplicate" : "done",
          message: result.status === "duplicate" ? "Already uploaded" : "Uploaded",
        });
        if (result.status === "created") {
          setExistingPapers((prev) => [
            ...prev,
            {
              id: result.termPaperId,
              termId,
              academicYear: item.year.trim(),
              year: Number(yearStart) || null,
              fileName: item.file.name,
              fileUrl: "",
            },
          ]);
        }
      } catch (err) {
        updatePendingStatus(termId, item.key, {
          status: "error",
          message: err instanceof Error ? err.message : "Upload failed",
        });
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

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-medium">Term papers</h3>
      <p className="mt-1 text-xs text-muted">
        One combined PDF per semester, covering every subject at once. Click a semester to open it, then
        drop in the PDFs for each year — the only thing to fill in per file is the year.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {sortedTerms.map((term) => {
          const count = existingPapers.filter((p) => p.termId === term.id).length;
          return (
            <button
              key={term.id}
              type="button"
              onClick={() => setOpenTermId(openTermId === term.id ? null : term.id)}
              className={`flex flex-col items-center gap-0.5 rounded-lg border px-4 py-2 text-sm font-medium transition ${
                openTermId === term.id
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-background hover:border-accent"
              }`}
            >
              <span>{term.name}</span>
              <span className={`text-[10px] ${openTermId === term.id ? "text-accent-foreground/80" : "text-muted"}`}>
                {count} paper{count === 1 ? "" : "s"}
              </span>
            </button>
          );
        })}
      </div>

      {openTermId && (
        <div className="mt-4 rounded-lg border border-border bg-background p-4">
          {(() => {
            const term = sortedTerms.find((t) => t.id === openTermId)!;
            const termPapers = existingPapers.filter((p) => p.termId === openTermId);
            const pending = pendingByTerm[openTermId] ?? [];
            return (
              <>
                <p className="text-sm font-medium">{term.name}</p>

                {termPapers.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5">
                    {termPapers.map((paper) => (
                      <li key={paper.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                        {paper.fileUrl ? (
                          <a
                            href={paper.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 hover:text-accent"
                          >
                            <FileArchive size={14} />
                            {paper.academicYear ?? paper.year ?? "Undated"} · {paper.fileName}
                          </a>
                        ) : (
                          <span className="flex items-center gap-2 text-muted">
                            <FileArchive size={14} />
                            {paper.academicYear ?? paper.year ?? "Undated"} · {paper.fileName}
                          </span>
                        )}
                        <button type="button" onClick={() => handleDelete(paper.id)} className="text-red-500 hover:underline">
                          <Trash size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <label
                  className="mt-3 flex flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-border bg-surface p-6 text-center transition hover:border-accent"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = Array.from(e.dataTransfer.files).filter((f) => /\.pdf$/i.test(f.name));
                    if (dropped.length > 0) addFiles(openTermId, dropped);
                  }}
                >
                  <FileArchive size={22} weight="bold" className="text-muted" />
                  <span className="text-sm font-medium">Drop {term.name} PDFs here (one or more years)</span>
                  <span className="text-xs text-muted">or click to select multiple files</span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const picked = Array.from(e.target.files ?? []);
                      if (picked.length > 0) addFiles(openTermId, picked);
                      e.target.value = "";
                    }}
                  />
                </label>

                {pending.length > 0 && (
                  <div className="mt-3 overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead className="bg-surface-muted text-xs font-semibold tracking-wide text-muted uppercase">
                        <tr>
                          <th className="px-3 py-2 text-left">File</th>
                          <th className="px-3 py-2 text-left">Year</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {pending.map((item) => (
                          <tr key={item.key}>
                            <td className="max-w-[220px] truncate px-3 py-2 text-xs" title={item.file.name}>
                              {item.file.name}
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="text"
                                value={item.year}
                                onChange={(e) => updatePendingYear(openTermId, item.key, e.target.value)}
                                placeholder="2024-25"
                                className={`w-24 rounded-lg border bg-background px-2 py-1 text-xs focus:border-accent focus:outline-none ${
                                  item.year.trim() ? "border-border" : "border-amber-500"
                                }`}
                              />
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {item.status === "uploading" && <span className="text-accent">Uploading...</span>}
                              {item.status === "done" && <span className="text-green-600">Uploaded</span>}
                              {item.status === "duplicate" && <span className="text-muted">{item.message}</span>}
                              {item.status === "error" && <span className="text-red-500">{item.message}</span>}
                              {item.status === "idle" && <span className="text-muted">Ready</span>}
                            </td>
                            <td className="px-3 py-2">
                              <button
                                type="button"
                                onClick={() => removePending(openTermId, item.key)}
                                className="text-xs text-red-500 hover:underline"
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {pending.length > 0 && (
                  <button
                    type="button"
                    onClick={() => uploadPending(openTermId)}
                    disabled={uploading}
                    className="mt-3 flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    <UploadSimple size={16} weight="bold" />
                    {uploading ? "Uploading..." : `Upload ${pending.filter((p) => p.status !== "done" && p.status !== "duplicate").length} file(s)`}
                  </button>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
