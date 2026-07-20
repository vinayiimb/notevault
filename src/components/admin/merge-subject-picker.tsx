"use client";

import { useEffect, useRef, useState } from "react";
import { WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { mergeSubjectsAction } from "@/lib/actions";

type Suggestion = { id: string; name: string; context: string };

// Lets an admin fold a duplicate subject (same subject filed twice under a
// slightly different name — a common side effect of the CSV deploy/match
// tools) into another. Search-as-you-type reuses the same suggestions API
// as the site search bar, then requires an explicit confirm step since
// merging deletes the source subject.
export function MergeSubjectPicker({
  subjectId,
  subjectName,
}: {
  subjectId: string;
  subjectName: string;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<Suggestion | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/search-suggestions?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => res.json())
        .then((data: { results: Suggestion[] }) => {
          setSuggestions(data.results.filter((s) => s.id !== subjectId));
          setOpen(true);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, subjectId]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  if (target) {
    return (
      <form action={mergeSubjectsAction} className="rounded-lg border border-warning/40 bg-warning/10 p-3">
        <input type="hidden" name="sourceId" value={subjectId} />
        <input type="hidden" name="targetId" value={target.id} />
        <p className="flex items-start gap-2 text-sm">
          <WarningCircle size={18} weight="bold" className="mt-0.5 shrink-0 text-warning" />
          <span>
            Merge <strong>{subjectName}</strong> into <strong>{target.name}</strong>? All files and
            questions move over, notes are combined, and <strong>{subjectName}</strong> is deleted. This
            can&apos;t be undone.
          </span>
        </p>
        <label className="mt-3 block text-xs font-medium text-muted">
          Name for the merged subject
          <input
            type="text"
            name="mergedName"
            defaultValue={target.name}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </label>
        <div className="mt-3 flex gap-2">
          <button
            type="submit"
            className="rounded-lg bg-warning px-4 py-2 text-xs font-semibold text-white transition hover:opacity-90"
          >
            Confirm merge
          </button>
          <button
            type="button"
            onClick={() => setTarget(null)}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-muted transition hover:text-foreground"
          >
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder="Find the subject to merge this into..."
        autoComplete="off"
        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      {open && query.trim() && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1.5 max-h-64 w-full overflow-y-auto rounded-xl border border-border bg-surface shadow-[0_10px_30px_rgba(15,23,42,.08)]">
          {suggestions.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => {
                  setTarget(s);
                  setOpen(false);
                }}
                className="flex w-full flex-col items-start gap-0.5 p-3 text-left transition hover:bg-surface-muted"
              >
                <span className="text-sm font-medium">{s.name}</span>
                <span className="text-xs text-muted">{s.context}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
