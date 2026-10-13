"use client";

import { useRef, useState } from "react";
import { ArrowsIn, ArrowsOut, MagnifyingGlassMinus, MagnifyingGlassPlus, X } from "@phosphor-icons/react";

const STEPS = [1, 1.5, 2, 3, 4];

/**
 * Wraps a diagram with a zoom button that opens it in a full-screen native
 * <dialog> (Esc / backdrop close, focus handled by the browser). Zoom widens
 * the inner box so the dialog scrolls; drag pans.
 */
export function ZoomableFigure({ children, label = "diagram" }: { children: React.ReactNode; label?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const [step, setStep] = useState(0);
  const [open, setOpen] = useState(false);

  const show = () => {
    setStep(0);
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();
  const zoom = (d: number) => setStep((s) => Math.min(STEPS.length - 1, Math.max(0, s + d)));

  const tool = "flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition hover:bg-surface-muted disabled:opacity-40";

  return (
    <div className="pyq-zoomable group relative">
      {children}
      <button
        type="button"
        onClick={show}
        aria-label={`Zoom ${label}`}
        className="no-print absolute right-1 top-1 flex size-8 items-center justify-center rounded-lg border border-border bg-surface/90 text-foreground opacity-80 shadow-xs transition hover:opacity-100 focus-visible:opacity-100"
      >
        <ArrowsOut size={16} />
      </button>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && close()}
        onKeyDown={(e) => {
          if (e.key === "+" || e.key === "=") zoom(1);
          if (e.key === "-") zoom(-1);
        }}
        aria-label={`${label} (zoomed)`}
        className="no-print m-auto h-[92dvh] w-[min(96vw,1200px)] max-w-none overflow-hidden rounded-2xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/60"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3 py-2">
              <button type="button" className={tool} onClick={() => zoom(-1)} disabled={step === 0} aria-label="Zoom out">
                <MagnifyingGlassMinus size={18} />
              </button>
              <span className="w-12 text-center text-sm tabular-nums text-muted">{Math.round(STEPS[step] * 100)}%</span>
              <button type="button" className={tool} onClick={() => zoom(1)} disabled={step === STEPS.length - 1} aria-label="Zoom in">
                <MagnifyingGlassPlus size={18} />
              </button>
              <button type="button" className={tool} onClick={() => setStep(0)} disabled={step === 0} aria-label="Reset zoom">
                <ArrowsIn size={18} />
              </button>
              <span className="ml-auto hidden text-xs text-muted sm:block">Drag to move · Esc to close</span>
              <button type="button" className={`${tool} ml-auto sm:ml-2`} onClick={close} aria-label="Close" autoFocus>
                <X size={18} />
              </button>
            </div>
            <div
              ref={bodyRef}
              className="pyq-zoom-body min-h-0 flex-1 cursor-grab touch-pan-x touch-pan-y overflow-auto bg-white p-4 active:cursor-grabbing"
              onPointerDown={(e) => {
                const el = bodyRef.current;
                if (!el || e.pointerType !== "mouse") return;
                drag.current = { x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop };
              }}
              onPointerMove={(e) => {
                const el = bodyRef.current;
                if (!el || !drag.current) return;
                el.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
                el.scrollTop = drag.current.top - (e.clientY - drag.current.y);
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerLeave={() => (drag.current = null)}
            >
              <div className="mx-auto" style={{ width: `${STEPS[step] * 100}%` }}>
                {children}
              </div>
            </div>
          </div>
        )}
      </dialog>
    </div>
  );
}
