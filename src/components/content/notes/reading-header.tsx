"use client";

import { ContentSearch } from "./note-search";
import { ContentPrintButton } from "./print-button";
import { ContentThemeSwitcher } from "./theme-switcher";

export function ContentReadingHeader({ title, targetId }: { title: string; targetId: string }) {
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
          <ContentPrintButton />
          <ContentThemeSwitcher />
        </div>
      </div>
    </header>
  );
}
