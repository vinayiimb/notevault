"use client";

import { ContentSearch } from "./note-search";
import { ContentDownloadButton } from "./download-button";
import { ContentThemeSwitcher } from "./theme-switcher";
import { ContentDarkModeToggle } from "./dark-mode-toggle";

export function ContentReadingHeader({ title, targetId, downloadable = true }: { title: string; targetId: string; downloadable?: boolean }) {
  return (
    <header
      className="nt-no-print sticky top-0 z-40 border-b"
      style={{
        borderColor: "var(--nt-border)",
        background: "color-mix(in srgb, var(--nt-background) 88%, transparent)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <p className="truncate text-sm font-semibold" style={{ color: "var(--nt-text)" }}>{title}</p>
        <div className="flex items-center gap-2">
          <ContentSearch targetId={targetId} />
          {downloadable && <ContentDownloadButton title={title} />}
          <ContentDarkModeToggle />
          <ContentThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
