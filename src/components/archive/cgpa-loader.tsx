"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "@phosphor-icons/react";

const LINES = [
  "Loading your 8+ CGPA…",
  "Finding papers your seniors survived…",
  "Asking toppers for their secrets…",
  "Sorting papers so you don't have to…",
  "Charging night-before-exam mode…",
  "9-pointer energy loading…",
];

// Shown wherever /papers waits on the network: course data, a PDF, a ZIP.
export function CgpaLoader({ label, className = "" }: { label?: string; className?: string }) {
  const [line, setLine] = useState(0);
  const [cgpa, setCgpa] = useState(6.2);

  useEffect(() => {
    const lines = setInterval(() => setLine((n) => (n + 1) % LINES.length), 1800);
    // Ticks up toward a 9.9 and starts again, like a very optimistic result.
    const score = setInterval(() => setCgpa((g) => (g >= 9.8 ? 6.2 : Math.round((g + 0.1) * 10) / 10)), 90);
    return () => {
      clearInterval(lines);
      clearInterval(score);
    };
  }, []);

  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 px-6 text-center ${className}`}>
      <div className="flex items-center gap-2.5">
        <GraduationCap size={30} weight="duotone" className="text-accent motion-safe:animate-bounce" />
        <span className="font-mono text-2xl font-bold tabular-nums text-foreground" aria-hidden="true">
          {cgpa.toFixed(1)}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wider text-muted" aria-hidden="true">
          CGPA
        </span>
      </div>
      <div className="h-1.5 w-48 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
        <div className="cgpa-fill h-full rounded-full bg-accent [animation:cgpa-fill_2.4s_ease-in-out_infinite]" />
      </div>
      <p className="text-sm font-semibold text-foreground">{label ?? LINES[line]}</p>
      {label && <p className="text-xs text-muted">{LINES[line]}</p>}
    </div>
  );
}
