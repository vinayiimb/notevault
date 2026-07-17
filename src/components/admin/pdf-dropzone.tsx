"use client";

import { useState } from "react";
import { FilePdf, UploadSimple } from "@phosphor-icons/react/dist/ssr";

export function PdfDropzone({ name, required }: { name: string; required?: boolean }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">PDF file</label>
      <div
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragOver
            ? "border-accent bg-accent-soft"
            : "border-border bg-background hover:border-accent/60"
        }`}
      >
        {/* Real, fully-interactive file input layered over the visual box.
            Native browser drag-and-drop and click both work on it directly,
            and it keeps real dimensions so required-field validation is visible. */}
        <input
          type="file"
          name={name}
          accept="application/pdf"
          required={required}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDrop={() => setDragOver(false)}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        {fileName ? (
          <>
            <FilePdf size={28} weight="bold" className="text-accent" />
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted">Click or drop another PDF to replace it</p>
          </>
        ) : (
          <>
            <UploadSimple size={24} weight="bold" className="text-muted" />
            <p className="text-sm font-medium text-foreground">
              Drag and drop a PDF here, or click to browse
            </p>
            <p className="text-xs text-muted">PDF only</p>
          </>
        )}
      </div>
    </div>
  );
}
