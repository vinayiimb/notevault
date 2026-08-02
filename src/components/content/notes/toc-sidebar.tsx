"use client";

import { useEffect, useState } from "react";
import type { ContentHeading } from "@/lib/content/toc";

export function ContentTocSidebar({ headings }: { headings: ContentHeading[] }) {
  const [activeSlug, setActiveSlug] = useState<string | null>(headings[0]?.slug ?? null);

  useEffect(() => {
    if (headings.length === 0) return;
    const elements = headings
      .map((h) => document.getElementById(h.slug))
      .filter((el): el is HTMLElement => el !== null);

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveSlug(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );
    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="nt-no-print hidden lg:block">
      <nav className="nt-toc" aria-label="Table of contents">
        <p className="mb-2 px-2 text-xs font-semibold tracking-wide uppercase" style={{ color: "var(--nt-text-muted)" }}>
          On this page
        </p>
        {headings.map((h) => (
          <a
            key={h.slug}
            href={`#${h.slug}`}
            data-active={activeSlug === h.slug}
            className={`nt-toc-link ${h.level === 3 ? "level-3" : ""}`}
          >
            {h.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
