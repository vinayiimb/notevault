"use client";

import { useRef, useState } from "react";
import { ImageSquare, UploadSimple } from "@phosphor-icons/react/dist/ssr";

export function ImageDropzone({ name, required }: { name: string; required?: boolean }) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted">Image file</label>
      <div
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-8 text-center transition ${
          dragOver
            ? "border-accent bg-accent-soft"
            : "border-border bg-background hover:border-accent/60"
        }`}
      >
        {/* Real, fully-interactive file input layered over the visual box —
            same pattern as PdfDropzone, which fixed a real drag-and-drop bug
            (a visually-hidden input silently failed on some browsers).
            dragover MUST call preventDefault(), or the browser rejects the
            drop entirely (its default action for a dragged file is to open
            it, not hand it to the input) — without that, the box's border
            still lights up on hover but no file ever actually lands in the
            input, so submitting shows "Please select a file" even though a
            file was visibly dropped. */}
        <input
          ref={inputRef}
          type="file"
          name={name}
          accept="image/png,image/jpeg,image/webp"
          required={required}
          className="absolute inset-0 z-10 cursor-pointer opacity-0"
          onDragEnter={() => setDragOver(true)}
          onDragLeave={() => setDragOver(false)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const dropped = e.dataTransfer.files;
            if (dropped && dropped.length > 0 && inputRef.current) {
              inputRef.current.files = dropped;
              setFileName(dropped[0].name);
            }
          }}
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
        {fileName ? (
          <>
            <ImageSquare size={28} weight="bold" className="text-accent" />
            <p className="text-sm font-medium text-foreground">{fileName}</p>
            <p className="text-xs text-muted">Click or drop another image to replace it</p>
          </>
        ) : (
          <>
            <UploadSimple size={24} weight="bold" className="text-muted" />
            <p className="text-sm font-medium text-foreground">
              Drag and drop an image here, or click to browse
            </p>
            <p className="text-xs text-muted">PNG, JPEG, or WebP</p>
          </>
        )}
      </div>
    </div>
  );
}
