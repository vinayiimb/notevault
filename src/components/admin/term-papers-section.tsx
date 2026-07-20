"use client";

import { useState } from "react";
import { FileArchive, Trash } from "@phosphor-icons/react/dist/ssr";
import { deleteTermPaperAction, uploadTermPaperAction } from "@/lib/actions";

type Term = { id: string; name: string; order: number };
type TermPaper = { id: string; termId: string; academicYear: string | null; year: number | null; fileName: string; fileUrl: string };

async function sha256Hex(data: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function TermPapersSection({ terms, papers, programId }: { terms: Term[]; papers: TermPaper[]; programId: string }) {
  const [selectedSemester, setSelectedSemester] = useState<string>(terms[0]?.id ?? "");
  const [year, setYear] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTerm = terms.find((t) => t.id === selectedSemester);
  const termPapers = papers.filter((p) => p.termId === selectedSemester);

  async function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!year.trim()) {
      setError("Year is required");
      return;
    }
    const fileInput = e.currentTarget.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    if (!file) {
      setError("File is required");
      return;
    }

    setUploading(true);
    setError(null);
    try {
      const bytes = await file.arrayBuffer();
      const hash = await sha256Hex(bytes);
      const yearStart = year.match(/(?:19|20)\d{2}/)?.[0] ?? "";

      const formData = new FormData();
      formData.set("termId", selectedSemester);
      formData.set("year", yearStart);
      formData.set("academicYear", year.trim());
      formData.set("file", file);

      await uploadTermPaperAction(formData);
      setYear("");
      fileInput.value = "";
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(paperId: string) {
    if (!confirm("Delete this term paper?")) return;
    const formData = new FormData();
    formData.set("id", paperId);
    await deleteTermPaperAction(formData);
    window.location.reload();
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h3 className="font-medium">Term papers</h3>
      <p className="mt-1 text-xs text-muted">Upload a combined PDF for each semester covering all subjects.</p>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-4">
        {terms.map((term) => (
          <button
            key={term.id}
            onClick={() => setSelectedSemester(term.id)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition ${
              selectedSemester === term.id
                ? "bg-accent text-accent-foreground"
                : "bg-background border border-border hover:border-accent"
            }`}
          >
            {term.name}
          </button>
        ))}
      </div>

      {selectedTerm && (
        <div className="mt-4 flex flex-col gap-4">
          <form onSubmit={handleUpload} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                placeholder="e.g. 2024-25"
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">PDF file</label>
              <input
                type="file"
                accept=".pdf"
                required
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={uploading}
              className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </form>

          {termPapers.length > 0 && (
            <div className="flex flex-col gap-2 border-t border-border pt-4">
              <p className="text-xs font-medium text-muted">Uploaded papers:</p>
              <ul className="flex flex-col gap-2">
                {termPapers.map((paper) => (
                  <li key={paper.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
                    <a
                      href={paper.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-sm hover:text-accent"
                    >
                      <FileArchive size={14} />
                      {paper.academicYear ?? paper.year ?? "Undated"} · {paper.fileName}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleDelete(paper.id)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      <Trash size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
