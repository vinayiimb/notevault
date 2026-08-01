"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ArrowsOut, Check, Copy, DownloadSimple, X } from "@phosphor-icons/react";
import { useContentTheme } from "./theme-provider";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";

function mermaidThemeVariables(tokens: NotesLabColorTokens) {
  return {
    background: tokens.surface,
    primaryColor: withAlpha(tokens.primary, 0.12),
    primaryTextColor: tokens.text,
    primaryBorderColor: tokens.primary,
    secondaryColor: withAlpha(tokens.secondary, 0.12),
    secondaryBorderColor: tokens.secondary,
    tertiaryColor: withAlpha(tokens.accent, 0.12),
    tertiaryBorderColor: tokens.accent,
    lineColor: tokens.textMuted,
    textColor: tokens.text,
    mainBkg: tokens.surface,
    nodeBorder: tokens.primary,
    clusterBkg: tokens.surfaceMuted,
    clusterBorder: tokens.border,
    titleColor: tokens.text,
    edgeLabelBackground: tokens.surface,
    // Sequence diagrams
    actorBkg: tokens.surface,
    actorBorder: tokens.primary,
    actorTextColor: tokens.text,
    signalColor: tokens.textMuted,
    signalTextColor: tokens.text,
    // Pie charts
    pie1: tokens.primary, pie2: tokens.secondary, pie3: tokens.accent,
    pie4: tokens.success, pie5: tokens.warning, pie6: tokens.error,
    pieOuterStrokeColor: tokens.border,
    pieTitleTextColor: tokens.text,
    pieSectionTextColor: tokens.text,
    // Gantt
    taskBkgColor: withAlpha(tokens.primary, 0.18),
    taskBorderColor: tokens.primary,
    taskTextColor: tokens.text,
    activeTaskBkgColor: withAlpha(tokens.accent, 0.25),
    activeTaskBorderColor: tokens.accent,
    gridColor: tokens.border,
    todayLineColor: tokens.error,
    // Mind maps / class
    fillType0: withAlpha(tokens.primary, 0.14),
    fillType1: withAlpha(tokens.secondary, 0.14),
    fillType2: withAlpha(tokens.accent, 0.14),
  };
}

function withAlpha(hex: string, alpha: number) {
  const m = hex.replace("#", "");
  const bigint = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  const r = (bigint >> 16) & 255, g = (bigint >> 8) & 255, b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function ContentMermaidBlock({ chart }: { chart: string }) {
  const rawId = useId().replace(/:/g, "-");
  const canvasRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const { tokens, resolvedMode } = useContentTheme();

  useEffect(() => {
    let cancelled = false;
    import("mermaid").then(async (mod) => {
      const mermaid = mod.default;
      mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        darkMode: resolvedMode === "dark",
        themeVariables: mermaidThemeVariables(tokens),
        securityLevel: "strict",
      });
      try {
        const { svg: rendered } = await mermaid.render(`nt-mermaid-${rawId}`, chart);
        if (!cancelled) {
          setSvg(rendered);
          setError(null);
        }
      } catch {
        if (!cancelled) setError("This diagram's Mermaid syntax couldn't be parsed. The original source is shown below.");
      }
    });
    return () => {
      cancelled = true;
    };
    // Re-render whenever the chart source or the resolved color theme changes.
  }, [chart, rawId, tokens, resolvedMode]);

  async function copyCode() {
    await navigator.clipboard.writeText(chart);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function downloadSvg() {
    if (!svg) return;
    const blob = new Blob([svg], { type: "image/svg+xml" });
    triggerDownload(blob, "diagram.svg");
  }

  function downloadPng() {
    const svgEl = (fullscreen ? fullscreenRef : canvasRef).current?.querySelector("svg");
    if (!svgEl) return;
    const serialized = new XMLSerializer().serializeToString(svgEl);
    const svgBlob = new Blob([serialized], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const bbox = svgEl.getBoundingClientRect();
      const scale = 2; // export at 2x for crisp PNGs
      const canvas = document.createElement("canvas");
      canvas.width = bbox.width * scale;
      canvas.height = bbox.height * scale;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = tokens.surface;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, bbox.width, bbox.height);
        canvas.toBlob((blob) => blob && triggerDownload(blob, "diagram.png"));
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }

  const toolbar = (
    <div className="nt-mermaid-toolbar">
      <button type="button" className="nt-copy-btn" onClick={copyCode} aria-label="Copy Mermaid source">
        {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
        {copied ? "Copied" : "Copy code"}
      </button>
      {svg && (
        <>
          <button type="button" className="nt-copy-btn" onClick={downloadSvg} aria-label="Download as SVG">
            <DownloadSimple size={13} weight="bold" /> SVG
          </button>
          <button type="button" className="nt-copy-btn" onClick={downloadPng} aria-label="Download as PNG">
            <DownloadSimple size={13} weight="bold" /> PNG
          </button>
        </>
      )}
      <button
        type="button"
        className="nt-copy-btn"
        onClick={() => setFullscreen((v) => !v)}
        aria-label={fullscreen ? "Exit full screen" : "View full screen"}
      >
        {fullscreen ? <X size={13} weight="bold" /> : <ArrowsOut size={13} weight="bold" />}
        {fullscreen ? "Close" : "Full screen"}
      </button>
    </div>
  );

  const body = error ? (
    <div className="nt-mermaid-error">
      <p>{error}</p>
      <pre className="mt-2 overflow-x-auto rounded-lg p-3 text-xs" style={{ background: "var(--nt-surface-muted)" }}>{chart}</pre>
    </div>
  ) : svg ? (
    // React forbids passing both `children` and `dangerouslySetInnerHTML` on
    // one element (even conditionally) — the loading state below is a
    // separate element entirely, not a child hidden inside this one.
    <div className="nt-mermaid-canvas" ref={fullscreen ? fullscreenRef : canvasRef} dangerouslySetInnerHTML={{ __html: svg }} />
  ) : (
    <div className="nt-mermaid-canvas" ref={fullscreen ? fullscreenRef : canvasRef}>
      <p className="text-sm" style={{ color: "var(--nt-text-muted)" }}>Rendering diagram…</p>
    </div>
  );

  if (fullscreen) {
    return (
      <div className="nt-mermaid-fullscreen" role="dialog" aria-modal="true" aria-label="Diagram, full screen">
        {toolbar}
        <div className="flex flex-1 items-center justify-center overflow-auto p-6">{body}</div>
      </div>
    );
  }

  return (
    <div className="nt-mermaid-wrap">
      {toolbar}
      {body}
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
