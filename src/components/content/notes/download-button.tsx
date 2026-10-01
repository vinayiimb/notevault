"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { downloadElementAsPdf } from "@/lib/notes-pdf";

// Downloads the notes as a PDF that looks like the page (theme, cards,
// tables, diagrams) — built in the browser, no print dialog.
export function ContentDownloadButton({ title }: { title: string }) {
  const [progress, setProgress] = useState<number | null>(null);

  async function download(e: React.MouseEvent<HTMLButtonElement>) {
    const root = e.currentTarget.closest<HTMLElement>(".nt-root");
    if (!root || progress !== null) return;
    setProgress(0);
    try {
      await downloadElementAsPdf({
        root,
        blocks: ".nt-intro-container, .nt-prose > *",
        filename: title,
        footer: `${title} · dupyq.online`,
        onProgress: setProgress,
      });
    } catch (err) {
      console.error(err);
      alert("Couldn't create the PDF. Please try again.");
    } finally {
      setProgress(null);
    }
  }

  return (
    <button type="button" className="nt-btn nt-btn-ghost" onClick={download} disabled={progress !== null} aria-label="Download notes as PDF">
      <DownloadSimple size={16} weight="bold" />
      <span className="hidden sm:inline">{progress === null ? "Download PDF" : `Preparing… ${progress}%`}</span>
    </button>
  );
}
