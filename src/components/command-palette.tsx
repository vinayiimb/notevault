"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";

type Row = [programme: string, subject: string, papers: number];

/** Ctrl/⌘+K spotlight: type a subject or course, jump straight to its papers page. */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    if (!rows)
      fetch("/data/papers/search-index.json")
        .then((r) => r.json())
        .then(setRows)
        .catch(() => setRows([]));
  }, [open, rows]);

  const results = useMemo(() => {
    const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!rows || tokens.length === 0) return [];
    return rows
      .filter(([p, s]) => {
        const hay = `${s} ${p}`.toLowerCase();
        return tokens.every((t) => hay.includes(t));
      })
      .sort((a, b) => Number(b[1].toLowerCase().startsWith(tokens[0])) - Number(a[1].toLowerCase().startsWith(tokens[0])) || b[2] - a[2])
      .slice(0, 8);
  }, [q, rows]);

  const go = (r: Row) => {
    setOpen(false);
    setQ("");
    router.push(`/papers/${slugify(r[0])}/${slugify(r[1])}`);
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 px-4 pt-[15vh]"
      onMouseDown={() => setOpen(false)}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search papers"
        className="w-full max-w-xl overflow-hidden rounded-xl border border-border bg-surface shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b border-border px-4">
          <MagnifyingGlass size={18} className="shrink-0 text-muted" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) go(results[active]);
            }}
            placeholder="Search a subject or course — e.g. “SEC finance”, “bcom micro”"
            aria-label="Search subjects and courses"
            className="w-full bg-transparent py-3.5 text-sm text-foreground outline-none placeholder:text-muted"
          />
          <kbd className="hidden shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted sm:block">Esc</kbd>
        </div>
        <ul role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {q && results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-muted">
              {rows ? "No matching subject found." : "Loading…"}
            </li>
          )}
          {results.map((r, i) => (
            <li
              key={r[0] + r[1]}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onClick={() => go(r)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm ${i === active ? "bg-accent/10" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate font-medium text-foreground">{r[1]}</span>
                <span className="block truncate text-xs text-muted">{r[0]}</span>
              </span>
              <span className="shrink-0 text-xs text-muted">{r[2]} papers</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
