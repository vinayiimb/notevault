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
          // Don't add to existingPapers yet - it will be fetched fresh on page reload
          // This avoids showing incomplete entries with empty fileUrl
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
    <div className="rounded-2xl border border-border bg-gradient-to-br from-surface to-surface-muted/30 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Term Papers</h3>
          <p className="mt-2 text-sm text-muted max-w-2xl">
            Upload one combined PDF per semester covering every subject. Click a semester to expand it, then drop in PDFs for each year — only the year needs filling in.
          </p>
        </div>
        <div className="shrink-0 flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
          <FileArchive size={20} weight="bold" />
        </div>
      </div>

      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {sortedTerms.map((term) => {
          const count = existingPapers.filter((p) => p.termId === term.id).length;
          return (
            <button
              key={term.id}
              type="button"
              onClick={() => setOpenTermId(openTermId === term.id ? null : term.id)}
              className={`group flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                openTermId === term.id
                  ? "border-accent bg-gradient-to-r from-accent to-accent/80 text-accent-foreground shadow-lg shadow-accent/20"
                  : "border-border bg-background/50 hover:border-accent hover:bg-background hover:shadow-md"
              }`}
            >
              <div className="text-left flex-1">
                <p className="font-medium">{term.name}</p>
                <p className={`text-xs mt-0.5 ${openTermId === term.id ? "text-accent-foreground/70" : "text-muted group-hover:text-muted/80"}`}>
                  {count} paper{count === 1 ? "" : "s"}
                </p>
              </div>
              <div className={`text-lg transition ${openTermId === term.id ? "rotate-180" : ""}`}>
                ⌄
              </div>
            </button>
          );
        })}
      </div>

      {openTermId && (
        <div className="mt-4 space-y-4 rounded-xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-4">
          {(() => {
            const term = sortedTerms.find((t) => t.id === openTermId)!;
            const termPapers = existingPapers.filter((p) => p.termId === openTermId);
            const pending = pendingByTerm[openTermId] ?? [];
            return (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{term.name}</p>
                    {termPapers.length > 0 && (
                      <p className="mt-1 text-xs text-muted">{termPapers.length} uploaded paper{termPapers.length === 1 ? "" : "s"}</p>
                    )}
                  </div>
                </div>

                {termPapers.length > 0 && (
                  <ul className="space-y-2">
                    {termPapers.map((paper) => (
                      <li key={paper.id} className={`group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                        paper.fileUrl
                          ? "border-green-500/30 bg-green-500/5 hover:border-green-500/50 hover:bg-green-500/10"
                          : "border-amber-500/30 bg-amber-500/5 hover:border-amber-500/50"
                      }`}>
                        {paper.fileUrl ? (
                          <a
                            href={paper.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex flex-1 items-center gap-2 text-foreground hover:text-accent transition truncate"
                          >
                            <FileArchive size={14} weight="bold" className="shrink-0" />
                            <span className="truncate">
                              {paper.academicYear ?? paper.year ?? "Undated"} · {paper.fileName}
                            </span>
                          </a>
                        ) : (
                          <span className="flex flex-1 items-center gap-2 text-muted truncate">
                            <FileArchive size={14} weight="bold" className="shrink-0" />
                            <span className="truncate">
                              {paper.academicYear ?? paper.year ?? "Undated"} · {paper.fileName}
                            </span>
                            <span className="shrink-0 ml-auto text-xs bg-amber-500/20 text-amber-700 px-2 py-0.5 rounded">Processing</span>
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(paper.id)}
                          className="shrink-0 text-muted opacity-0 hover:text-red-500 transition group-hover:opacity-100"
                        >
                          <Trash size={16} weight="bold" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <label
                  className="group relative flex flex-col items-center justify-center gap-2.5 rounded-xl border-2 border-dashed border-accent/30 bg-gradient-to-br from-accent/5 to-accent/0 p-8 text-center transition cursor-pointer hover:border-accent hover:from-accent/10 hover:to-accent/5"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = Array.from(e.dataTransfer.files).filter((f) => /\.pdf$/i.test(f.name));
                    if (dropped.length > 0) addFiles(openTermId, dropped);
                  }}
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent transition group-hover:bg-accent/20">
                    <FileArchive size={24} weight="bold" />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-foreground">Drop PDFs here</span>
                    <p className="mt-0.5 text-xs text-muted">or click to select multiple files (one or more years)</p>
                  </div>
                  <span className="mt-2 text-xs text-muted/70 font-medium uppercase tracking-wide">PDF Only</span>
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
                  <div className="space-y-3">
                    <div className="overflow-x-auto rounded-lg border border-border/50 bg-background/30">
                      <table className="w-full text-sm">
                        <thead className="bg-accent/5 text-xs font-semibold tracking-wide text-muted uppercase border-b border-border/50">
                          <tr>
                            <th className="px-3 py-2 text-left">File</th>
                            <th className="px-3 py-2 text-left">Year</th>
                            <th className="px-3 py-2 text-center">Status</th>
                            <th className="px-3 py-2 w-16"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/30">
                          {pending.map((item) => (
                            <tr key={item.key} className="hover:bg-accent/5 transition">
                              <td className="max-w-[220px] truncate px-3 py-2 text-xs text-muted" title={item.file.name}>
                                {item.file.name}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="text"
                                  value={item.year}
                                  onChange={(e) => updatePendingYear(openTermId, item.key, e.target.value)}
                                  placeholder="2024-25"
                                  className={`w-24 rounded-md border bg-background px-2 py-1 text-xs transition focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20 ${
                                    item.year.trim() ? "border-border" : "border-amber-500/50 bg-amber-500/5"
                                  }`}
                                />
                              </td>
                              <td className="px-3 py-2 text-xs text-center">
                                {item.status === "uploading" && (
                                  <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-600 px-2 py-1 rounded-md font-medium">
                                    <span className="animate-spin">⟳</span> Uploading
                                  </span>
                                )}
                                {item.status === "done" && (
                                  <span className="inline-flex items-center gap-1 bg-green-500/10 text-green-600 px-2 py-1 rounded-md font-medium">✓ Uploaded</span>
                                )}
                                {item.status === "duplicate" && (
                                  <span className="text-muted text-xs">{item.message}</span>
                                )}
                                {item.status === "error" && (
                                  <span className="text-red-600 font-medium">{item.message}</span>
                                )}
                                {item.status === "idle" && <span className="text-muted">Ready</span>}
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => removePending(openTermId, item.key)}
                                  className="text-xs text-muted hover:text-red-500 transition font-medium"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <button
                      type="button"
                      onClick={() => uploadPending(openTermId)}
                      disabled={uploading}
                      className="w-full flex items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-accent to-accent/80 px-4 py-3 text-sm font-semibold text-accent-foreground transition hover:shadow-lg hover:shadow-accent/30 disabled:opacity-50 disabled:hover:shadow-none"
                    >
                      <UploadSimple size={18} weight="bold" />
                      {uploading ? "Uploading..." : `Upload ${pending.filter((p) => p.status !== "done" && p.status !== "duplicate").length} file(s)`}
                    </button>
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
