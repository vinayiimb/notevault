"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, MagnifyingGlass, Notebook } from "@phosphor-icons/react/dist/ssr";

type Suggestion = { id: string; name: string; context: string };

export function SearchBar({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced live typeahead — fetches as the user types instead of only
  // showing anything once they submit and land on the full /search page.
  useEffect(() => {
    const query = value.trim();
    if (!query) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search-suggestions?q=${encodeURIComponent(query)}`, {
        signal: controller.signal,
      })
        .then((res) => res.json())
        .then((data: { results: Suggestion[] }) => {
          setSuggestions(data.results);
          setOpen(true);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSuggestions([]);
          setOpen(false);
        });
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    setOpen(false);
    router.push(`/search?q=${encodeURIComponent(value.trim())}`);
  }

  return (
    <div ref={containerRef} className={`relative ${compact ? "w-full max-w-xs" : "w-full max-w-2xl mx-auto"}`}>
      <form onSubmit={onSubmit} className="relative">
        <label className="relative block">
          <span className="sr-only">Search subjects, notes, PYQs</span>
          <MagnifyingGlass
            size={compact ? 17 : 20}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={value}
            onChange={(e) => {
              const nextValue = e.target.value;
              setValue(nextValue);
              if (!nextValue.trim()) {
                setSuggestions([]);
                setOpen(false);
              }
            }}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            placeholder="Search a subject, program, or topic..."
            autoComplete="off"
            className={`w-full rounded-2xl border border-border/80 bg-surface text-foreground shadow-sm transition-all duration-200 placeholder:text-muted focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 hover:border-brand/40 ${
              compact ? "h-11 pl-10 pr-3 py-2 text-sm rounded-xl" : "h-14 pl-12 pr-16 py-3.5 text-base shadow-md shadow-black/5"
            }`}
          />
        </label>
        {!compact && (
          <button
            type="submit"
            aria-label="Search"
            disabled={!value.trim()}
            className="absolute top-1/2 right-2 flex size-10 -translate-y-1/2 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-md transition-all hover:bg-brand-hover hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 disabled:shadow-none"
          >
            <ArrowRight size={18} weight="bold" />
          </button>
        )}
      </form>

      {open && value.trim() && (
        <div className="absolute z-20 mt-1.5 w-full overflow-hidden rounded-xl border border-border bg-surface shadow-[0_10px_30px_rgba(15,23,42,.08)]">
          {suggestions.length > 0 ? (
            <ul className="max-h-80 divide-y divide-border overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      setValue(s.name);
                      router.push(`/subjects/${s.id}`);
                    }}
                    className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-surface-muted"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                      <Notebook size={14} weight="bold" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{s.name}</span>
                      <span className="block truncate text-xs text-muted">{s.context}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="p-3 text-sm text-muted">No subjects matched &quot;{value.trim()}&quot;.</p>
          )}
        </div>
      )}
    </div>
  );
}
