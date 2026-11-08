"use client";

import { ContentSearch } from "./note-search";
import { ContentDownloadButton } from "./download-button";
import { ContentThemeSwitcher } from "./theme-switcher";
import { ContentDarkModeToggle } from "./dark-mode-toggle";

// A floating glass bar, like the site header above it. It sticks under that header on tablets and up; on a phone it scrolls
// away with the page so the reading area keeps the whole screen.
export function ContentReadingHeader({ title, targetId, downloadable = true }: { title: string; targetId: string; downloadable?: boolean }) {
  return (
    <header className="nt-bar nt-no-print">
      <p className="nt-bar-title">{title}</p>
      <div className="nt-bar-actions">
        <ContentSearch targetId={targetId} />
        {downloadable && <ContentDownloadButton title={title} />}
        <ContentDarkModeToggle />
        <ContentThemeSwitcher />
      </div>
    </header>
  );
}
