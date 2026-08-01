"use client";

import dynamic from "next/dynamic";

// `ssr:false` is only valid inside a Client Component (Next 16 rule) — this
// thin wrapper is the client boundary, and it's what actually keeps pdf.js
// (and its worker) out of every page's initial bundle: nothing here imports
// pdfjs-dist directly, only the lazily-loaded PdfViewerClient does.
const PdfViewerClient = dynamic(() => import("./pdf-viewer-client").then((m) => m.PdfViewerClient), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] items-center justify-center rounded-2xl border border-border bg-surface-muted">
      <p className="text-sm text-muted">Loading PDF viewer…</p>
    </div>
  ),
});

export function PDFViewer({ url, downloadable = true }: { url: string; downloadable?: boolean }) {
  return <PdfViewerClient url={url} downloadable={downloadable} />;
}
