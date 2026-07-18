"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { preprocessNotesMarkdown } from "@/lib/notes-markdown";

export function DownloadNotesButton({ content, title }: { content: string; title: string }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ unit: "pt", format: "a4" });
      const pageW = doc.internal.pageSize.getWidth();
      const pageH = doc.internal.pageSize.getHeight();
      const margin = 56;
      const contentW = pageW - margin * 2;
      let y = margin;

      function ensureSpace(lineHeight: number) {
        if (y + lineHeight > pageH - margin) {
          doc.addPage();
          y = margin;
        }
      }

      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      for (const line of doc.splitTextToSize(title, contentW)) {
        ensureSpace(22);
        doc.text(line, margin, y);
        y += 22;
      }
      y += 10;

      const markdown = preprocessNotesMarkdown(content);
      for (const raw of markdown.split("\n")) {
        const line = raw.trim();
        if (!line) {
          y += 6;
          continue;
        }

        if (line.startsWith("## ")) {
          y += 8;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(14);
          const text = line.slice(3).replace(/\*\*/g, "");
          for (const w of doc.splitTextToSize(text, contentW)) {
            ensureSpace(18);
            doc.text(w, margin, y);
            y += 18;
          }
          y += 4;
        } else if (line.startsWith("### ")) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(12);
          const text = line.slice(4).replace(/\*\*/g, "");
          for (const w of doc.splitTextToSize(text, contentW)) {
            ensureSpace(16);
            doc.text(w, margin, y);
            y += 16;
          }
          y += 2;
        } else {
          doc.setFont("helvetica", "normal");
          doc.setFontSize(10.5);
          const isBullet = /^\*\s+/.test(line);
          const text = line
            .replace(/^\*\s+/, "•  ")
            .replace(/\*\*(.+?)\*\*/g, "$1")
            .replace(/\*(.+?)\*/g, "$1");
          const indent = isBullet ? 14 : 0;
          for (const w of doc.splitTextToSize(text, contentW - indent)) {
            ensureSpace(14);
            doc.text(w, margin + indent, y);
            y += 14;
          }
        }
      }

      doc.save(`${title.replace(/[^\w.-]+/g, "_") || "notes"}.pdf`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium transition hover:bg-surface-muted disabled:opacity-50"
    >
      <DownloadSimple size={16} weight="bold" />
      {loading ? "Preparing..." : "Download PDF"}
    </button>
  );
}
