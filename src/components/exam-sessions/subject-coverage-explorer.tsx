"use client";

import { useMemo, useState } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

type Session = { order: number; label: string };
type Row = { id: string; name: string; programName: string; fileCount: number; sessionOrders: number[] };

const PAGE_SIZE = 200;

export function SubjectCoverageExplorer({ sessions, rows }: { sessions: Session[]; rows: Row[] }) {
  const [query, setQuery] = useState("");
  const [minCoverage, setMinCoverage] = useState(1);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => r.sessionOrders.length >= minCoverage)
      .filter((r) => !q || r.name.toLowerCase().includes(q) || r.programName.toLowerCase().includes(q))
      .sort(
        (a, b) =>
          b.sessionOrders.length - a.sessionOrders.length ||
          a.programName.localeCompare(b.programName) ||
          a.name.localeCompare(b.name)
      );
  }, [rows, query, minCoverage]);

  const shown = filtered.slice(0, visible);

  return (
    <div className="mt-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE_SIZE);
            }}
            placeholder="Search subject or course…"
            className="w-full rounded-lg border border-border bg-surface py-2 pr-3 pl-9 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          Present in at least
          <select
            value={minCoverage}
            onChange={(e) => {
              setMinCoverage(Number(e.target.value));
              setVisible(PAGE_SIZE);
            }}
            className="rounded-lg border border-border bg-surface px-2 py-2 text-sm focus:border-accent focus:outline-none"
          >
            {Array.from({ length: sessions.length }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} year{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="mt-3 text-xs text-muted">
        {filtered.length} subject{filtered.length === 1 ? "" : "s"} match — sorted by how many years they
        appear in, most first.
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-surface-muted/55 text-xs text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Course</th>
                <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                <th scope="col" className="w-20 px-4 py-3 text-right font-semibold">Years</th>
                <th scope="col" className="px-4 py-3 font-semibold" title="Newest on the left, oldest on the right">
                  Coverage
                </th>
                <th scope="col" className="w-20 px-5 py-3 text-right font-semibold sm:px-6">Files</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((row) => {
                const full = row.sessionOrders.length === sessions.length;
                return (
                  <tr key={row.id} className="transition-colors hover:bg-accent-soft/30">
                    <td className="px-5 py-3 align-top text-xs text-muted sm:px-6">{row.programName}</td>
                    <th scope="row" className="px-4 py-3 align-top font-medium text-foreground">
                      {row.name}
                    </th>
                    <td className="px-4 py-3 text-right align-top">
                      <span
                        className={
                          full
                            ? "rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent"
                            : "text-xs text-muted"
                        }
                      >
                        {row.sessionOrders.length}/{sessions.length}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="flex gap-0.5">
                        {sessions.map((s) => (
                          <span
                            key={s.order}
                            title={s.label}
                            className={`h-3 w-3 rounded-sm ${
                              row.sessionOrders.includes(s.order) ? "bg-accent" : "bg-surface-muted"
                            }`}
                          />
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right align-top text-xs text-muted sm:px-6">{row.fileCount}</td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted">
                    No subjects match that search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {visible < filtered.length && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="mt-3 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent/60 hover:text-accent"
        >
          Show {Math.min(PAGE_SIZE, filtered.length - visible)} more (of {filtered.length})
        </button>
      )}
    </div>
  );
}
