"use client";

import { useState } from "react";
import { CaretDown } from "@phosphor-icons/react";

// Simple disclosure used in the PYQ reading page's Solutions tab — keeps
// answers off-screen by default so students can attempt a question before
// seeing it, without a heavier accordion library.
export function AnswerReveal({ children, label = "Show answer" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm font-semibold text-foreground"
      >
        {open ? "Hide answer" : label}
        <CaretDown size={14} weight="bold" className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="border-t border-border px-4 py-3 text-sm text-foreground/90">{children}</div>}
    </div>
  );
}
