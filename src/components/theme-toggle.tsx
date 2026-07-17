"use client";

import { Moon, Sun } from "@phosphor-icons/react/dist/ssr";

export function ThemeToggle() {
  function toggle() {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("notevault-theme", next ? "dark" : "light");
  }

  return (
    <button
      onClick={toggle}
      aria-label="Toggle dark mode"
      className="flex size-9 items-center justify-center rounded-lg border border-border text-foreground/70 transition hover:bg-surface-muted hover:text-foreground active:scale-95"
    >
      <Sun size={18} weight="bold" className="hidden dark:block" />
      <Moon size={18} weight="bold" className="block dark:hidden" />
    </button>
  );
}
