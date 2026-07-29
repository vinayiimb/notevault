"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowSquareOut, CheckSquare, Square, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { uploadResourceAction } from "@/lib/actions";
import type { CoverageFileRef } from "@/lib/coverage-data";

// One Subject x Year cell on the Course Coverage page: an empty checkbox
// with an upload button when nothing's on file yet, a checked box that opens
// the paper directly when there's exactly one, or a checked box with a count
// badge that opens a small list when there are several (Drive-matched papers
// and admin-uploaded ones can both land in the same year).
export function CourseCoverageCell({
  subjectId,
  year,
  files,
}: {
  subjectId: string;
  year: number;
  files: CoverageFileRef[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onClickOutside);
    return () => window.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("subjectId", subjectId);
      formData.set("type", "PYQ");
      formData.set("year", String(year));
      formData.set("title", file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || file.name);
      formData.set("file", file);
      const result = await uploadResourceAction(formData);
      if (!result || (result.status !== "created" && result.status !== "duplicate")) {
        setError("Upload failed.");
        return;
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  const uploadButton = (
    <button
      type="button"
      title="Upload a paper for this subject/year"
      disabled={uploading}
      onClick={() => inputRef.current?.click()}
      className="rounded p-1 text-muted transition hover:bg-surface-muted hover:text-accent disabled:opacity-50"
    >
      <UploadSimple size={12} weight="bold" className={uploading ? "animate-pulse" : ""} />
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleUpload(file);
        }}
      />
    </button>
  );

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center gap-1">
        <Square size={16} className="text-border" />
        {uploadButton}
        {error && <span className="text-[10px] text-red-500">!</span>}
      </div>
    );
  }

  if (files.length === 1) {
    return (
      <div className="flex items-center justify-center gap-1">
        <a
          href={files[0].url}
          target="_blank"
          rel="noopener noreferrer"
          title={files[0].label}
          className="text-success"
        >
          <CheckSquare size={16} weight="fill" />
        </a>
        {uploadButton}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative flex items-center justify-center gap-1">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex items-center gap-0.5 text-success">
        <CheckSquare size={16} weight="fill" />
        <span className="text-[10px] font-bold">{files.length}</span>
      </button>
      {uploadButton}
      {open && (
        <div className="absolute top-full left-1/2 z-20 mt-1 w-64 -translate-x-1/2 rounded-xl border border-border bg-surface p-2 text-left shadow-lg">
          <ul className="flex flex-col divide-y divide-border">
            {files.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-2 py-1.5 first:pt-0 last:pb-0">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{f.label}</span>
                  <span className="text-[10px] text-muted">{f.source === "drive" ? "Drive" : "Uploaded"}</span>
                </span>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted hover:text-accent"
                >
                  <ArrowSquareOut size={14} />
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
