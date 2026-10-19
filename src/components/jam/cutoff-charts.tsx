"use client";

import { useState } from "react";
import { CUTOFF_CATEGORIES, type JamCutoffYear } from "@/data/jam-economics/cutoffs";

type Tab = "category" | "years" | "applicants";
type Bar = { label: string; value: number; color: string };

const APPLICANT_SERIES = [
  { key: "registered", label: "Registered", color: "#8b80dc" },
  { key: "appeared", label: "Appeared", color: "#7fcd99" },
  { key: "qualified", label: "Qualified", color: "#f7c35c" },
] as const;

const fmt = (n: number) => n.toLocaleString("en-IN");

/** Grouped vertical bars with the value printed inside each bar (AfterBoards style). */
function BarChart({ groups, max, ticks }: { groups: { label: string; sub?: string; bars: Bar[] | null }[]; max: number; ticks: number[] }) {
  return (
    <div className="mt-5">
      <div className="relative ml-10 h-60">
        {ticks.map((t) => (
          <div key={t} className="absolute inset-x-0 border-t border-border/70" style={{ bottom: `${(t / max) * 100}%` }}>
            <span className="absolute -left-10 -top-2 w-8 text-right text-[11px] text-muted">{fmt(t)}</span>
          </div>
        ))}
        <div className="absolute inset-0 flex justify-around gap-2">
          {groups.map((g) => (
            <div key={g.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-1.5">
              {g.bars ? (
                g.bars.map((b) => (
                  <div
                    key={b.label}
                    title={`${b.label}: ${fmt(b.value)}`}
                    className="relative flex w-full min-w-3 max-w-11 justify-center rounded-t-lg pt-1.5 text-[11px] font-semibold text-white"
                    style={{ height: `${Math.max(2, (b.value / max) * 100)}%`, background: b.color }}
                  >
                    <span className="hidden sm:inline">{fmt(b.value)}</span>
                  </div>
                ))
              ) : (
                <span className="mb-2 text-center text-xs text-muted">Not published</span>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="ml-10 flex justify-around gap-2 pt-2">
        {groups.map((g) => (
          <div key={g.label} className="min-w-0 flex-1 text-center">
            <p className="text-[13px] text-foreground">{g.label}</p>
            {g.bars && <p className="text-[11px] font-medium text-foreground sm:hidden">{g.bars.map((b) => fmt(b.value)).join(" · ")}</p>}
            {g.sub && <p className="text-[11px] text-muted">{g.sub}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Legend({ items }: { items: readonly { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs">
      {items.map((i) => (
        <span key={i.label} className="flex items-center gap-1.5" style={{ color: i.color }}>
          <span className="size-2 rounded-full" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

export function CutoffCharts({ data }: { data: JamCutoffYear[] }) {
  const published = data.filter((d) => d.cutoff);
  const [tab, setTab] = useState<Tab>("category");
  const [year, setYear] = useState(published[0].year);
  const sel = data.find((d) => d.year === year) ?? published[0];
  const chrono = [...data].sort((a, b) => a.year - b.year);
  const withCounts = chrono.filter((d) => d.candidates);

  const tabs: [Tab, string][] = [
    ["category", "By category"],
    ["years", "Across years"],
    ["applicants", "Applicants by year"],
  ];

  return (
    <section className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-foreground">Cutoff Distribution</h2>
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1" role="tablist">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition ${tab === key ? "bg-surface text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab === "category" && (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm text-muted">
              Paper
              <div className="mt-1.5 flex items-center justify-between rounded-xl border border-border px-3 py-2.5 text-[15px] text-foreground">
                Economics (EN) <span className="text-xs text-muted">100 marks · 60 questions</span>
              </div>
            </label>
            <label className="text-sm text-muted">
              Year
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-[15px] text-foreground focus:border-accent focus:outline-none"
              >
                {published.map((d) => (
                  <option key={d.year} value={d.year}>
                    {d.year}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <BarChart
            max={50}
            ticks={[0, 10, 20, 30, 40, 50]}
            groups={CUTOFF_CATEGORIES.map((c) => ({
              label: c.label,
              // PwD candidates are also counted inside GEN/OBC/SC/ST in the official reports, so they are not added here.
              sub: sel.qualifiedBy ? `${fmt(c.key === "gen" ? sel.qualifiedBy.GEN : c.key === "obc" ? sel.qualifiedBy["OBC-NCL"] + sel.qualifiedBy.EWS : sel.qualifiedBy.SC + sel.qualifiedBy.ST)} qualified` : undefined,
              bars: sel.cutoff ? [{ label: c.label, value: sel.cutoff[c.key], color: c.color }] : null,
            }))}
          />
          <p className="mt-1 text-center text-xs text-muted">Qualifying marks out of 100 in JAM {sel.year}</p>
        </>
      )}

      {tab === "years" && (
        <>
          <BarChart
            max={50}
            ticks={[0, 10, 20, 30, 40, 50]}
            groups={chrono.map((d) => ({
              label: String(d.year),
              bars: d.cutoff ? CUTOFF_CATEGORIES.map((c) => ({ label: c.label, value: d.cutoff![c.key], color: c.color })) : null,
            }))}
          />
          <Legend items={CUTOFF_CATEGORIES} />
        </>
      )}

      {tab === "applicants" && (
        <>
          <BarChart
            max={4000}
            ticks={[0, 1000, 2000, 3000, 4000]}
            groups={withCounts.map((d) => ({
              label: String(d.year),
              sub: `${((d.candidates!.qualified / d.candidates!.appeared) * 100).toFixed(1)}% of appeared qualified`,
              bars: APPLICANT_SERIES.map((s) => ({ label: s.label, value: d.candidates![s.key], color: s.color })),
            }))}
          />
          <Legend items={APPLICANT_SERIES} />
          <p className="mt-2 text-center text-xs text-muted">Official candidate counts are shown for the years whose statistical report is published.</p>
        </>
      )}

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
        {[
          ["Registered", sel.candidates ? fmt(sel.candidates.registered) : "—"],
          ["Appeared", sel.candidates ? fmt(sel.candidates.appeared) : "—"],
          ["Total qualified", sel.candidates ? fmt(sel.candidates.qualified) : "—"],
          ["Highest raw mark", sel.raw ? String(sel.raw.max) : "—"],
        ].map(([k, v]) => (
          <div key={k}>
            <p className="text-xs text-muted">
              {k} ({sel.year})
            </p>
            <p className="mt-0.5 text-2xl font-semibold text-foreground">{v}</p>
          </div>
        ))}
      </div>

      {sel.raw && sel.cutoff && (
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm font-medium text-foreground">Where the cutoff sits in JAM {sel.year}</p>
          <p className="text-xs text-muted">
            Raw marks ranged from {sel.raw.min} to {sel.raw.max}. Each marker is a category&apos;s qualifying mark.
          </p>
          <div className="relative mx-2 mb-10 mt-12 h-3 rounded-full bg-surface-muted">
            {(() => {
              const lo = Math.floor(sel.raw.min / 10) * 10;
              const hi = 100;
              const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`;
              return (
                <>
                  <div className="absolute inset-y-0 rounded-full bg-orange-300/70" style={{ left: at(sel.raw.min), right: `calc(100% - ${at(sel.raw.max)})` }} />
                  {CUTOFF_CATEGORIES.map((c, i) => (
                    <div key={c.key} className="absolute -top-2 h-7 w-0.5" style={{ left: at(sel.cutoff![c.key]), background: c.color }}>
                      <span
                        className="absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded px-1 text-[11px] font-semibold"
                        style={{ color: c.color, top: i % 2 ? "1.9rem" : "-1.35rem" }}
                      >
                        {sel.cutoff![c.key]}
                      </span>
                    </div>
                  ))}
                  <span className="absolute -bottom-6 left-0 text-[11px] text-muted">{lo}</span>
                  <span className="absolute -bottom-6 right-0 text-[11px] text-muted">{hi}</span>
                </>
              );
            })()}
          </div>
          <Legend items={CUTOFF_CATEGORIES} />
        </div>
      )}
    </section>
  );
}
