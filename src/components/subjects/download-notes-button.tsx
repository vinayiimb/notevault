"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { preprocessNotesMarkdown } from "@/lib/content/toc";

export function DownloadNotesButton({ content, title }: { content: string; title: string }) {
  const [loading, setLoading] = useState(false);

  async function download() {
    setLoading(true);
    try {
      alert("PDF generation is currently disabled on Cloudflare Workers.");
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
