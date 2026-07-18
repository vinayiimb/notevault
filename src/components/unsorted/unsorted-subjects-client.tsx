"use client";

import { useMemo, useState } from "react";
import { moveSubjectsToTermAction } from "@/lib/actions";

type Subject = { id: string; name: string; description: string | null };
type Program = { id: string; name: string; level: string; terms: { id: string; name: string }[] };

export function UnsortedSubjectsClient({
  subjects: initialSubjects,
  programs,
}: {
  subjects: Subject[];
  programs: Program[];
}) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMoved, setLastMoved] = useState<number | null>(null);

  const program = programs.find((p) => p.id === programId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)
    );
  }, [subjects, query]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelected((prev) => {
      const next = new Set(prev);
      filtered.forEach((s) => next.add(s.id));
      return next;
    });
  }

  function clearSelection() {
    setSelected(new Set());
  }

  async function move() {
    if (!termId || selected.size === 0) return;
    setMoving(true);
    setError(null);
    setLastMoved(null);
    try {
      const formData = new FormData();
      formData.set("termId", termId);
      selected.forEach((id) => formData.append("subjectIds", id));
      const { moved } = await moveSubjectsToTermAction(formData);
      setSubjects((prev) => prev.filter((s) => !selected.has(s.id)));
      setSelected(new Set());
      setLastMoved(moved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move those subjects.");
    } finally {
      setMoving(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Search</label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name or code..."
            className="min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Move to course</label>
          <select
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setTermId("");
            }}
            className="min-w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Select course</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Semester</label>
          <select
            value={termId}
            disabled={!program}
            onChange={(e) => setTermId(e.target.value)}
            className="min-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
          >
            <option value="">Select semester</option>
            {program?.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={move}
          disabled={moving || !termId || selected.size === 0}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {moving ? "Moving..." : `Move ${selected.size} selected →`}
        </button>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <div className="flex items-center gap-3">
          <button type="button" onClick={selectAllVisible} className="text-accent hover:underline">
            Select all {filtered.length} visible
          </button>
          {selected.size > 0 && (
            <button type="button" onClick={clearSelection} className="text-muted hover:underline">
              Clear selection ({selected.size})
            </button>
          )}
        </div>
        <span className="text-muted">
          {filtered.length} of {subjects.length} shown
        </span>
      </div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
      {lastMoved !== null && (
        <p className="mt-2 text-sm text-green">Moved {lastMoved} subject{lastMoved === 1 ? "" : "s"}.</p>
      )}

      <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            {subjects.length === 0 ? "All subjects have been sorted." : "No subjects match that search."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {filtered.map((s) => (
              <li key={s.id} className="flex items-start gap-3 px-4 py-2.5">
                <input
                  type="checkbox"
                  checked={selected.has(s.id)}
                  onChange={() => toggle(s.id)}
                  className="mt-1 accent-accent"
                />
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="block truncate text-left text-sm font-medium hover:text-accent"
                  >
                    {s.name}
                  </button>
                  {s.description && <p className="truncate text-xs text-muted">{s.description}</p>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
