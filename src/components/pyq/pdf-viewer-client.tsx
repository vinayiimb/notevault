"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowsOut,
  ArrowSquareOut,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
  X,
} from "@phosphor-icons/react";

const MIN_SCALE = 0.6;
const MAX_SCALE = 2.4;

// The actual pdf.js-backed viewer, always loaded via a dynamic
// `ssr:false` import from pdf-viewer.tsx — pdf.js (and its worker) never
// ship in the initial page bundle. Renders one page to a <canvas> at a
// time (not the whole document up front) so flipping through a 40-page
// paper doesn't pay for pages nobody has scrolled to yet.
export function PdfViewerClient({ url, downloadable = true }: { url: string; downloadable?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.1);
  const [fullscreen, setFullscreen] = useState(false);

  // Resets back to "loading" when `url` changes, adjusted during rendering
  // rather than as a setState call inside the effect below (the pattern
  // React recommends for resetting state in response to a changed prop).
  const [urlForReset, setUrlForReset] = useState(url);
  if (url !== urlForReset) {
    setUrlForReset(url);
    setStatus("loading");
    setPageNumber(1);
    setNumPages(0);
  }

  useEffect(() => {
    let cancelled = false;
    import("pdfjs-dist").then(async (pdfjsLib) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      try {
        const pdf = await pdfjsLib.getDocument({ url }).promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setPageNumber(1);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("error");
      }
    });
    return () => {
      cancelled = true;
      pdfRef.current?.loadingTask.destroy();
      pdfRef.current = null;
    };
  }, [url]);

  useEffect(() => {
    if (status !== "ready" || !pdfRef.current || !canvasRef.current) return;
    let cancelled = false;

    (async () => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const context = canvas.getContext("2d");
      if (!context) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      renderTaskRef.current?.cancel();
      const task = page.render({ canvas, canvasContext: context, viewport });
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch {
        // A superseded render task throws on cancel — expected when the
        // user flips pages/zooms quickly, not a real error.
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
    };
  }, [status, pageNumber, scale]);

  useEffect(() => {
    function onFullscreenChange() {
      setFullscreen(document.fullscreenElement === containerRef.current);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      containerRef.current?.requestFullscreen();
    }
  }

  return (
    <div ref={containerRef} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface" style={fullscreen ? { height: "100vh" } : undefined}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
            disabled={pageNumber <= 1}
            aria-label="Previous page"
            className="rounded-lg border border-border p-1.5 disabled:opacity-40"
          >
            <CaretLeft size={14} weight="bold" />
          </button>
          <span className="min-w-[5.5rem] text-center text-xs font-medium text-muted">
            {status === "ready" ? `Page ${pageNumber} of ${numPages}` : "—"}
          </span>
          <button
            type="button"
            onClick={() => setPageNumber((p) => Math.min(numPages, p + 1))}
            disabled={pageNumber >= numPages}
            aria-label="Next page"
            className="rounded-lg border border-border p-1.5 disabled:opacity-40"
          >
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setScale((s) => Math.max(MIN_SCALE, s - 0.15))} aria-label="Zoom out" className="rounded-lg border border-border p-1.5">
            <MagnifyingGlassMinus size={14} weight="bold" />
          </button>
          <span className="min-w-[3rem] text-center text-xs font-medium text-muted">{Math.round(scale * 100)}%</span>
          <button type="button" onClick={() => setScale((s) => Math.min(MAX_SCALE, s + 0.15))} aria-label="Zoom in" className="rounded-lg border border-border p-1.5">
            <MagnifyingGlassPlus size={14} weight="bold" />
          </button>
          <button type="button" onClick={toggleFullscreen} aria-label={fullscreen ? "Exit full screen" : "View full screen"} className="rounded-lg border border-border p-1.5">
            {fullscreen ? <X size={14} weight="bold" /> : <ArrowsOut size={14} weight="bold" />}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open in new tab" className="rounded-lg border border-border p-1.5">
            <ArrowSquareOut size={14} weight="bold" />
          </a>
          {downloadable && (
            <a href={url} download aria-label="Download PDF" className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium">
              <DownloadSimple size={14} weight="bold" />
              Download
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center overflow-auto bg-surface-muted/50 p-4">
        {status === "loading" && <p className="text-sm text-muted">Loading paper…</p>}
        {status === "error" && (
          <div className="flex flex-col items-center gap-2 text-center text-sm text-muted">
            <p>This PDF couldn&apos;t be previewed.</p>
            <a href={url} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
              Open it in a new tab instead
            </a>
          </div>
        )}
        <canvas ref={canvasRef} className={`max-w-full rounded-lg shadow-sm ${status === "ready" ? "" : "hidden"}`} />
      </div>
    </div>
  );
}
