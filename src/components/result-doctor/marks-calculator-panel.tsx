"use client";

import { useState } from "react";
import { PATTERNS, calc, getNextGradeTarget } from "@/lib/calculator";

const CARD = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

export function MarksCalculatorPanel() {
  const [patternId, setPatternId] = useState("3-1-0");
  const [marks, setMarks] = useState<Record<string, string>>({});
  const pattern = PATTERNS[patternId];

  const filled = pattern.components.some((c) => (marks[c.id] ?? "") !== "");
  const result = calc(
    patternId,
    Object.fromEntries(pattern.components.map((c) => [c.id, Number(marks[c.id] || 0)])),
  );
  const next = getNextGradeTarget(result.percentage);
  const marksForNext = next ? Math.max(0, Math.ceil((next.target / 100) * result.totalMax - result.totalObtained)) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
      <section className={CARD}>
        <h2 className="text-lg font-semibold">Enter your marks</h2>
        <p className="mt-1 text-sm text-muted">
          Pick your paper&apos;s structure (lecture-tutorial-practical credits), then fill in what you scored or expect to score.
        </p>

        <label className="mt-4 flex flex-col gap-1.5 text-xs font-medium text-muted" htmlFor="calc-pattern">
          Paper structure
          <select
            id="calc-pattern"
            value={patternId}
            onChange={(e) => {
              setPatternId(e.target.value);
              setMarks({});
            }}
            className="rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus:border-brand focus:outline-none"
          >
            {Object.values(PATTERNS).map((p) => (
              <option key={p.id} value={p.id}>
                {p.label} — {p.description}
              </option>
            ))}
          </select>
        </label>

        <div className="mt-4 flex flex-col gap-3">
          {pattern.components.map((c) => (
            <label key={c.id} className="flex items-center justify-between gap-3 text-sm" htmlFor={`calc-${patternId}-${c.id}`}>
              <span className="font-medium">{c.label}</span>
              <span className="flex items-center gap-2 text-muted">
                <input
                  id={`calc-${patternId}-${c.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={c.maxMarks}
                  value={marks[c.id] ?? ""}
                  onChange={(e) => setMarks((m) => ({ ...m, [c.id]: e.target.value }))}
                  className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-right text-base text-foreground tabular-nums focus:border-brand focus:outline-none"
                />
                / {c.maxMarks}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-semibold">Your result</h2>
        {!filled ? (
          <p className="mt-3 text-sm text-muted">Fill in at least one component to see your total, grade and pass status.</p>
        ) : (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-muted">Total</p>
                <p className="text-xl font-bold tabular-nums">
                  {result.totalObtained}
                  <span className="text-sm font-medium text-muted">/{result.totalMax}</span>
                </p>
              </div>
              <div className="rounded-xl bg-surface-muted p-3">
                <p className="text-xs text-muted">Percentage</p>
                <p className="text-xl font-bold tabular-nums">{result.percentage.toFixed(1)}%</p>
              </div>
              <div className="rounded-xl bg-brand-soft p-3">
                <p className="text-xs text-brand">Grade</p>
                <p className="text-xl font-bold text-brand">
                  {result.grade.grade} <span className="text-sm font-medium">({result.grade.gradePoint})</span>
                </p>
              </div>
            </div>

            <ul className="mt-4 divide-y divide-border text-sm">
              {result.components.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <span>{c.label}</span>
                  <span className={c.passed ? "text-success" : "font-semibold text-red-600 dark:text-red-400"}>
                    {c.obtained}/{c.max} · {c.passed ? "cleared" : `needs ${c.passThreshold} to pass`}
                  </span>
                </li>
              ))}
            </ul>

            <p className="mt-4 rounded-xl bg-surface-muted p-3 text-sm">
              {!result.passed
                ? `Not cleared yet: every component needs at least 40%${result.failedComponents.length ? ` (short in ${result.failedComponents.join(", ")})` : ""}.`
                : next
                  ? `${marksForNext} more mark${marksForNext === 1 ? "" : "s"} would take you to ${next.grade}.`
                  : "That’s the top grade — nothing more to gain here."}
            </p>
          </>
        )}
      </section>
    </div>
  );
}
