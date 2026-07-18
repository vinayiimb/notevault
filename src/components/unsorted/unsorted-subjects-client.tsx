"use client";

import { useMemo, useState } from "react";
import { moveSubjectsToTermAction } from "@/lib/actions";

type Subject = { id: string; name: string; description: string | null };
type Program = { id: string; name: string; level: string; terms: { id: string; name: string }[] };
type RowState = { programId: string; termId: string };

export function UnsortedSubjectsClient({
  subjects: initialSubjects,
  programs,
}: {
  subjects: Subject[];
  programs: Program[];
}) {
  const [subjects, setSubjects] = useState(initialSubjects);
  const [query, setQuery] = useState("");
  const [rowState, setRowState] = useState<Record<string, RowState>>({});
  const [quickProgramId, setQuickProgramId] = useState("");
  const [quickTermId, setQuickTermId] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMoved, setLastMoved] = useState<number | null>(null);

  const quickProgram = programs.find((p) => p.id === quickProgramId);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)
    );
  }, [subjects, query]);

  const configuredCount = useMemo(
    () => Object.values(rowState).filter((r) => r.termId).length,
    [rowState]
  );

  function setRow(id: string, patch: Partial<RowState>) {
    setRowState((prev) => ({ ...prev, [id]: { ...(prev[id] ?? { programId: "", termId: "" }), ...patch } }));
  }

  // Pre-fills every currently-VISIBLE (i.e. searched-for) row with the same
  // course + semester — the fast path for the common case where a search
  // narrows to a batch of subjects that really do belong together (e.g.
  // "Hindi Gadya"). Each row stays individually editable afterward, so this
  // is a starting point, not a hard requirement that everything match.
  function applyToVisible() {
    if (!quickTermId) return;
    setRowState((prev) => {
      const next = { ...prev };
      for (const s of filtered) next[s.id] = { programId: quickProgramId, termId: quickTermId };
      return next;
    });
  }

  async function deploy() {
    const assignments = Object.entries(rowState)
      .filter(([, r]) => r.termId)
      .map(([subjectId, r]) => ({ subjectId, termId: r.termId }));
    if (assignments.length === 0) return;

    setDeploying(true);
    setError(null);
    setLastMoved(null);
    try {
      const formData = new FormData();
      formData.set("assignments", JSON.stringify(assignments));
      const { moved } = await moveSubjectsToTermAction(formData);
      const movedIds = new Set(assignments.map((a) => a.subjectId));
      setSubjects((prev) => prev.filter((s) => !movedIds.has(s.id)));
      setRowState((prev) => {
        const next = { ...prev };
        movedIds.forEach((id) => delete next[id]);
        return next;
      });
      setLastMoved(moved);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not move those subjects.");
    } finally {
      setDeploying(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or code..."
              className="min-w-[200px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={deploy}
            disabled={deploying || configuredCount === 0}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
          >
            {deploying ? "Deploying..." : `Deploy ${configuredCount} configured →`}
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-3 border-t border-border pt-3">
          <p className="w-full text-xs font-medium text-muted">
            Quick-fill: set the same course + semester for every row currently visible below
            (still editable per row afterward)
          </p>
          <div className="flex flex-col gap-1.5">
            <select
              value={quickProgramId}
              onChange={(e) => {
                setQuickProgramId(e.target.value);
                setQuickTermId("");
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
            <select
              value={quickTermId}
              disabled={!quickProgram}
              onChange={(e) => setQuickTermId(e.target.value)}
              className="min-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
            >
              <option value="">Select semester</option>
              {quickProgram?.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={applyToVisible}
            disabled={!quickTermId}
            className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted disabled:opacity-40"
          >
            Apply to {filtered.length} visible
          </button>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-sm">
        <span className="text-muted">
          {filtered.length} of {subjects.length} shown
        </span>
        {error && <span className="text-red-500">{error}</span>}
        {lastMoved !== null && (
          <span className="text-green">
            Deployed {lastMoved} subject{lastMoved === 1 ? "" : "s"}.
          </span>
        )}
      </div>

      <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-xl border border-border bg-surface">
        {filtered.length === 0 ? (
          <p className="p-4 text-sm text-muted">
            {subjects.length === 0 ? "All subjects have been sorted." : "No subjects match that search."}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {filtered.map((s) => {
              const row = rowState[s.id] ?? { programId: "", termId: "" };
              const rowProgram = programs.find((p) => p.id === row.programId);
              return (
                <li
                  key={s.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-2.5 ${
                    row.termId ? "bg-accent-soft/30" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.name}</p>
                    {s.description && <p className="truncate text-xs text-muted">{s.description}</p>}
                  </div>
                  <select
                    value={row.programId}
                    onChange={(e) => setRow(s.id, { programId: e.target.value, termId: "" })}
                    className="min-w-48 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:border-accent focus:outline-none"
                  >
                    <option value="">Course...</option>
                    {programs.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.termId}
                    disabled={!rowProgram}
                    onChange={(e) => setRow(s.id, { termId: e.target.value })}
                    className="min-w-36 rounded-lg border border-border bg-background px-2 py-1.5 text-xs focus:border-accent focus:outline-none disabled:opacity-40"
                  >
                    <option value="">Sem...</option>
                    {rowProgram?.terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
