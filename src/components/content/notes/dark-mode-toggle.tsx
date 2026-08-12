"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { useContentTheme } from "./theme-provider";

// A single click to flip light/dark, sitting next to the fuller Theme
// menu (palette + system/light/dark) — that one takes 2 clicks (open,
// then pick), which isn't a "direct" toggle for the common case of just
// wanting to flip modes.
export function ContentDarkModeToggle() {
  const { resolvedMode, setMode } = useContentTheme();
  const isDark = resolvedMode === "dark";

  return (
    <button
      type="button"
      className="nt-btn nt-btn-ghost"
      onClick={() => setMode(isDark ? "light" : "dark")}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={16} weight="bold" /> : <Moon size={16} weight="bold" />}
      <span className="hidden sm:inline">{isDark ? "Light" : "Dark"}</span>
    </button>
  );
}
