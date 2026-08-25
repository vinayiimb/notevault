"use client";

import React from "react";

export const KeyboardShortcutsHint: React.FC = () => {
  return (
    <div className="bg-muted/40 border-y border-border/60 py-1.5 px-4 text-[11px] text-muted-foreground hidden md:block">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4 flex-wrap">
          <span className="font-semibold text-foreground/80 flex items-center gap-1">
            ⌨️ Shortcuts:
          </span>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono shadow-xs">
              ←
            </kbd>
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono shadow-xs">
              →
            </kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono shadow-xs">
              S
            </kbd>
            <span>Solution</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono shadow-xs">
              B
            </kbd>
            <span>Bookmark</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono shadow-xs">
              1-4
            </kbd>
            <span>Select (a)-(d)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 rounded bg-background border border-border text-[10px] font-mono shadow-xs">
              F
            </kbd>
            <span>Focus Mode</span>
          </div>
        </div>
        <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
          Source: PYQ_GS_English_2013-25.pdf
        </div>
      </div>
    </div>
  );
};
