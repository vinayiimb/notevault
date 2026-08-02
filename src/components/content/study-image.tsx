"use client";

import { useLightbox } from "@/components/content/notes/note-image";

// Plain <img> (not next/image) is a deliberate, existing convention in this
// codebase for admin/content-supplied image URLs of unknown/arbitrary
// origin — see the identical choice (and its rationale) in
// src/components/content/notes/note-image.tsx. next/image requires every
// remote host to be allow-listed via next.config.ts's images.remotePatterns
// up front, which doesn't fit content whose image host isn't known at
// build time; loading="lazy" + explicit alt text cover the requirements
// that matter here without that constraint.
export function StudyImage({
  src,
  alt,
  caption,
  source,
}: {
  src: string;
  alt: string;
  caption?: string;
  source?: string;
}) {
  const { open } = useLightbox();

  return (
    <figure className="nt-figure">
      {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary admin-authored URL, not a static import */}
      <img src={src} alt={alt} loading="lazy" onClick={() => open({ src, alt })} />
      {(caption || source) && (
        <figcaption>
          {caption}
          {caption && source && " — "}
          {source && <span className="italic">Source: {source}</span>}
        </figcaption>
      )}
    </figure>
  );
}
