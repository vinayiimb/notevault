"use client";

import { useMemo, useRef, useState } from "react";
import { computeCGPA } from "@/lib/calculator";

// DU's 10-point scale only ever awards these grade points.
const GRADE_POINTS = [10, 9, 8, 7, 6, 5, 4, 0];

type Row = { id: number; name: string; credits: number; gradePoint: number };

const startRows = (): Row[] =>
  [4, 4, 4, 2, 2].map((credits, i) => ({ id: i + 1, name: "", credits, gradePoint: 8 }));

/** Semester SGPA = Σ(credits × grade point) ÷ Σ credits — the same weighted average as CGPA, over one semester. */
export default function SgpaCalculator() {
  const [rows, setRows] = useState<Row[]>(startRows);
  const nextId = useRef(6);

  // computeCGPA is the site's one credit-weighted average (also used by the Marks & CGPA calculator).
  const result = useMemo(() => computeCGPA(rows.map((r) => ({ ...r, id: String(r.id) }))), [rows]);

  const update = (id: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const inputClass =
    "w-full rounded-lg border border-border bg-surface-muted px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/40";

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="hidden grid-cols-[1fr_88px_96px_56px] gap-3 px-1 pb-2 text-xs font-medium uppercase tracking-wide text-muted sm:grid">
        <span>Paper (optional)</span>
        <span className="text-center">Credits</span>
        <span className="text-center">Grade point</span>
        <span />
      </div>

      <div className="space-y-3">
        {rows.map((r, i) => (
          <div key={r.id} className="grid grid-cols-[1fr_72px_80px] items-end gap-2 sm:grid-cols-[1fr_88px_96px_56px] sm:gap-3">
            <input
              value={r.name}
              onChange={(e) => update(r.id, { name: e.target.value })}
              placeholder={`Paper ${i + 1}`}
              aria-label={`Paper ${i + 1} name`}
              className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
            <label className="text-[10px] uppercase tracking-wide text-muted sm:text-[0px]">
              <span className="sm:sr-only">Credits</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={10}
                value={r.credits}
                onChange={(e) => update(r.id, { credits: Math.min(10, Math.max(0, Number(e.target.value) || 0)) })}
                aria-label={`Paper ${i + 1} credits`}
                className={inputClass}
              />
            </label>
            <label className="text-[10px] uppercase tracking-wide text-muted sm:text-[0px]">
              <span className="sm:sr-only">Grade point</span>
              <select
                value={r.gradePoint}
                onChange={(e) => update(r.id, { gradePoint: Number(e.target.value) })}
                aria-label={`Paper ${i + 1} grade point`}
                className={inputClass}
              >
                {GRADE_POINTS.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setRows((prev) => (prev.length > 1 ? prev.filter((x) => x.id !== r.id) : prev))}
              disabled={rows.length === 1}
              aria-label={`Remove paper ${i + 1}`}
              className="col-span-3 justify-self-end text-xs text-muted underline-offset-2 hover:text-foreground hover:underline disabled:opacity-40 sm:col-span-1 sm:justify-self-center"
            >
              Remove
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((prev) => [...prev, { id: nextId.current++, name: "", credits: 4, gradePoint: 8 }])}
        className="mt-4 text-sm font-medium text-accent underline-offset-2 hover:underline"
      >
        + Add a paper
      </button>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-accent-soft p-5" aria-live="polite">
        <div>
          <p className="text-sm text-muted">Your SGPA</p>
          <p className="text-4xl font-bold tracking-tight">{result.totalCredits > 0 ? result.cgpa.toFixed(2) : "—"}</p>
        </div>
        <dl className="text-right text-sm text-muted">
          <div>
            <dt className="inline">Total credits: </dt>
            <dd className="inline font-medium text-foreground">{result.totalCredits}</dd>
          </div>
          <div>
            <dt className="inline">Σ credits × grade point: </dt>
            <dd className="inline font-medium text-foreground">{result.weightedSum}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
