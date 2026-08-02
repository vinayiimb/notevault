"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DownloadSimple, X } from "@phosphor-icons/react";

type LightboxState = { src: string; alt: string } | null;
const LightboxContext = createContext<{ open: (s: LightboxState) => void } | null>(null);

export function ContentLightboxProvider({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState<LightboxState>(null);

  useEffect(() => {
    if (!active) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setActive(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  return (
    <LightboxContext.Provider value={{ open: setActive }}>
      {children}
      {active && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={active.alt || "Image preview"}
          className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-black/85 p-4"
          onClick={() => setActive(null)}
        >
          <div className="nt-no-print absolute top-4 right-4 flex gap-2">
            <a
              href={active.src}
              download
              onClick={(e) => e.stopPropagation()}
              className="nt-btn nt-btn-ghost !border-white/30 !text-white"
              aria-label="Download image"
            >
              <DownloadSimple size={16} weight="bold" />
            </a>
            <button
              type="button"
              onClick={() => setActive(null)}
              className="nt-btn nt-btn-ghost !border-white/30 !text-white"
              aria-label="Close"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element -- lightbox needs the original, un-optimized asset */}
          <img
            src={active.src}
            alt={active.alt}
            className="max-h-[85vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          {active.alt && <p className="nt-no-print mt-3 max-w-2xl text-center text-sm text-white/80">{active.alt}</p>}
        </div>
      )}
    </LightboxContext.Provider>
  );
}

export function useLightbox() {
  const ctx = useContext(LightboxContext);
  if (!ctx) throw new Error("useLightbox must be used inside ContentLightboxProvider");
  return ctx;
}

// react-markdown's `img` renderer only gets src/alt/title — captions and
// left/right alignment both ride on the standard Markdown title syntax:
// ![alt](src "caption | align-left"), since GFM has no native caption or
// alignment syntax for images.
export function NoteImage({ src, alt, title }: { src?: string; alt?: string; title?: string }) {
  const { open } = useLightbox();
  if (!src) return null;

  const [caption, alignToken] = (title ?? "").split("|").map((s) => s.trim());
  const align = alignToken === "align-left" ? "align-left" : alignToken === "align-right" ? "align-right" : "";

  return (
    <figure className={`nt-figure ${align}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- content images come from arbitrary admin-authored URLs, not static imports */}
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        onClick={() => open({ src, alt: alt ?? "" })}
      />
      {caption && <figcaption>{caption}</figcaption>}
    </figure>
  );
}
