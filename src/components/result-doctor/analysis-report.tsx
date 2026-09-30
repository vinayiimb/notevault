"use client";

import { useState } from "react";
import { CheckCircle, Info, Warning, WarningOctagon } from "@phosphor-icons/react";
import {
  COMPONENT_NAME,
  cgpaToPercent,
  estimateEndSem,
  requiredSgpa,
  theoryMaxima,
  type Analysis,
  type Level,
  type PaperView,
} from "@/lib/marksheet";

const LEVEL_STYLE: Record<Level, { label: string; chip: string; Icon: typeof Info }> = {
  critical: { label: "Action needed", chip: "bg-red-500/10 text-red-600 dark:text-red-400", Icon: WarningOctagon },
  warning: { label: "Check this", chip: "bg-warning/15 text-notes-amber-dark dark:text-warning", Icon: Warning },
  good: { label: "Good news", chip: "bg-success-soft text-success", Icon: CheckCircle },
  info: { label: "Insight", chip: "bg-sky-soft text-sky-dark", Icon: Info },
};

const CARD = "rounded-2xl border border-border bg-surface p-5 sm:p-6";

function Bar({ value, max = 10 }: { value: number; max?: number }) {
  return (
    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
      <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
    </div>
  );
}

function GradeCell({ grade }: { grade: string | null }) {
  return grade ? <span className="font-semibold">{grade}</span> : <span className="text-muted/50">—</span>;
}

function PaperFlags({ paper }: { paper: PaperView }) {
  return (
    <>
      {paper.anomaly && (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-[11px] font-bold text-notes-amber-dark dark:text-warning">
          Check grade
        </span>
      )}
      {paper.weakComponent && (
        <span className="rounded-full bg-sky-soft px-2 py-0.5 text-[11px] font-bold text-sky-dark">
          Low {COMPONENT_NAME[paper.weakComponent.key].toLowerCase()}
        </span>
      )}
      {paper.finalGrade === "F" && (
        <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-bold text-red-600 dark:text-red-400">Not cleared</span>
      )}
    </>
  );
}

function TargetPlanner({ analysis }: { analysis: Analysis }) {
  const done = analysis.semesters.length;
  const avgCredits = Math.round(analysis.totalCredits / Math.max(1, done));
  const [target, setTarget] = useState(Math.min(10, Math.ceil((analysis.cgpa + 0.3) * 2) / 2));
  const [length, setLength] = useState(done > 6 ? 8 : 6);
  const [credits, setCredits] = useState(avgCredits || 22);
  const remaining = Math.max(0, length - done);

  const need = (t: number) =>
    requiredSgpa({
      currentCreditPoints: analysis.totalCreditPoints,
      currentCredits: analysis.totalCredits,
      target: t,
      remainingSemesters: remaining,
      creditsPerSemester: credits,
    });
  const needed = need(target);

  return (
    <section className={CARD}>
      <h2 className="text-lg font-semibold">Plan your target CGPA</h2>
      <p className="mt-1 text-sm text-muted">What you need to average in the semesters you have left.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted" htmlFor="target-cgpa">
          Target CGPA
          <input
            id="target-cgpa"
            type="number"
            min={4}
            max={10}
            step={0.1}
            value={target}
            onChange={(e) => setTarget(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus:border-brand focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted" htmlFor="degree-length">
          Degree length
          <select
            id="degree-length"
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus:border-brand focus:outline-none"
          >
            <option value={6}>3 years (6 semesters)</option>
            <option value={8}>4 years (8 semesters)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-xs font-medium text-muted" htmlFor="future-credits">
          Credits per semester
          <input
            id="future-credits"
            type="number"
            min={1}
            max={40}
            value={credits}
            onChange={(e) => setCredits(Number(e.target.value) || 1)}
            className="rounded-xl border border-border bg-background px-3 py-2 text-base text-foreground focus:border-brand focus:outline-none"
          />
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-surface-muted p-4 text-sm">
        {remaining === 0 || needed === null ? (
          <p>You&apos;ve finished all {length} semesters — your final CGPA is {analysis.cgpa.toFixed(2)}.</p>
        ) : needed > 10 ? (
          <p>
            A {target.toFixed(1)} CGPA is out of reach: it would take an SGPA of {needed.toFixed(2)} (the maximum is 10) in each of
            your {remaining} remaining semesters. Try a lower target.
          </p>
        ) : needed <= 0 ? (
          <p>You&apos;ve already locked in a {target.toFixed(1)} CGPA — just clear your remaining papers.</p>
        ) : (
          <p>
            Average an SGPA of <strong className="text-lg text-brand tabular-nums">{needed.toFixed(2)}</strong> in each of your{" "}
            {remaining} remaining semester{remaining > 1 ? "s" : ""} to finish with a {target.toFixed(1)} CGPA (≈{" "}
            {cgpaToPercent(target)}%).
          </p>
        )}
      </div>

      {remaining > 0 && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[0.5, 1, 1.5, 2].map((step) => Math.min(10, Math.floor(analysis.cgpa * 2) / 2 + step)).filter((t, i, all) => all.indexOf(t) === i).map((t) => {
            const n = need(t);
            return (
              <div key={t} className="rounded-xl border border-border px-3 py-2 text-sm">
                <p className="text-xs text-muted">For {t.toFixed(1)} CGPA</p>
                <p className="font-semibold tabular-nums">
                  {n === null ? "—" : n > 10 ? "Not possible" : n <= 0 ? "Already there" : `SGPA ${n.toFixed(2)}`}
                </p>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function InternalEstimator({ papers }: { papers: PaperView[] }) {
  const eligible = papers.filter((p) => theoryMaxima(p));
  const [internals, setInternals] = useState<Record<string, string>>({});
  if (!eligible.length) return null;

  return (
    <details className={`${CARD} group`}>
      <summary className="cursor-pointer list-none">
        <span className="text-lg font-semibold">Know your internal marks? Find your end-semester score</span>
        <span className="mt-1 block text-sm text-muted">
          Optional. Your marksheet only shows grades — add the internal assessment marks your college gave you and we&apos;ll
          work out what you scored in the written exam. <span className="font-semibold text-brand group-open:hidden">Open →</span>
        </span>
      </summary>

      <p className="mt-4 rounded-xl bg-surface-muted p-3 text-xs text-muted">
        Assumes the DU UGCF theory component: end-semester exam out of 90 plus internal assessment out of 30 for 4-credit papers
        (50 + 25 for 2-credit papers). A range is shown because a grade covers a band of marks.
      </p>

      <ul className="mt-4 divide-y divide-border">
        {eligible.map((p) => {
          const maxima = theoryMaxima(p)!;
          const raw = internals[p.id] ?? "";
          const value = raw === "" ? null : Number(raw);
          const estimate = value === null ? null : estimateEndSem(p, value);
          return (
            <li key={p.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{p.title}</p>
                <p className="text-xs text-muted">
                  Sem {p.semester} · Theory grade {p.gradeL}
                </p>
              </div>
              <label className="flex items-center gap-2 text-xs text-muted" htmlFor={`ia-${p.id}`}>
                Internal
                <input
                  id={`ia-${p.id}`}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  max={maxima.ia}
                  value={raw}
                  onChange={(e) => setInternals((s) => ({ ...s, [p.id]: e.target.value }))}
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm text-foreground focus:border-brand focus:outline-none"
                />
                / {maxima.ia}
              </label>
              <p className="text-sm sm:w-48 sm:text-right">
                {value === null ? (
                  <span className="text-muted">—</span>
                ) : estimate ? (
                  <>
                    End-sem <strong className="tabular-nums">{estimate.low === estimate.high ? estimate.low : `${estimate.low}–${estimate.high}`}</strong> / {estimate.max}
                  </>
                ) : (
                  <span className="text-notes-amber-dark dark:text-warning">Doesn&apos;t fit this grade — recheck the number</span>
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function AnalysisReport({ analysis }: { analysis: Analysis }) {
  const semLabel = analysis.semesters.length === 1 ? "semester" : "semesters";

  return (
    <div className="flex flex-col gap-6">
      {(analysis.programme || analysis.examSession) && (
        <p className="text-sm text-muted">{[analysis.programme, analysis.examSession].filter(Boolean).join(" · ")}</p>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Cumulative CGPA", value: analysis.cgpa.toFixed(2), sub: `${analysis.semesters.length} ${semLabel}` },
          { label: "Percentage", value: `${cgpaToPercent(analysis.cgpa)}%`, sub: "CGPA × 9.5" },
          { label: "Credits earned", value: String(analysis.totalCredits), sub: `${analysis.totalCreditPoints} credit points` },
          { label: "Papers", value: String(analysis.papers.length), sub: `${analysis.papers.filter((p) => p.gp !== null && p.gp >= 9).length} with A+ or O` },
        ].map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-surface p-4">
            <p className="text-xs font-medium text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{s.value}</p>
            <p className="mt-0.5 text-xs text-muted">{s.sub}</p>
          </div>
        ))}
      </div>

      <section className={CARD}>
        <h2 className="text-lg font-semibold">What we found</h2>
        <ul className="mt-4 flex flex-col gap-4">
          {analysis.findings.map((f, i) => {
            const style = LEVEL_STYLE[f.level];
            return (
              <li key={i} className="flex gap-3">
                <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${style.chip}`}>
                  <style.Icon size={18} weight="bold" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    <span className={`mr-2 rounded-full px-2 py-0.5 text-[11px] font-bold ${style.chip}`}>{style.label}</span>
                    {f.title}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-muted">{f.detail}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={CARD}>
        <h2 className="text-lg font-semibold">SGPA by semester</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {analysis.semesters.map((s) => (
            <li key={s.semester} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 text-muted">Sem {s.semester}</span>
              <Bar value={s.sgpa} />
              <span className="w-10 shrink-0 text-right font-semibold tabular-nums">{s.sgpa.toFixed(2)}</span>
              <span className="hidden w-40 shrink-0 text-xs sm:block">
                {s.matches === true && <span className="text-success">Matches marksheet</span>}
                {s.matches === false && <span className="text-notes-amber-dark dark:text-warning">Marksheet says {s.printedSgpa?.toFixed(2)}</span>}
                {s.yearCgpa !== null && <span className="block text-muted">Year CGPA {s.yearCgpa.toFixed(2)}</span>}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className={CARD}>
          <h2 className="text-lg font-semibold">By paper type</h2>
          <p className="mt-1 text-sm text-muted">Average grade point, and each type&apos;s share of your credits.</p>
          <ul className="mt-4 flex flex-col gap-3">
            {analysis.byType.map((t) => (
              <li key={t.type} className="flex items-center gap-3 text-sm">
                <span className="w-12 shrink-0 font-semibold">{t.type}</span>
                <Bar value={t.avgGp} />
                <span className="w-10 shrink-0 text-right tabular-nums">{t.avgGp.toFixed(2)}</span>
                <span className="w-10 shrink-0 text-right text-xs text-muted tabular-nums">{Math.round((t.credits / analysis.totalCredits) * 100)}%</span>
              </li>
            ))}
          </ul>
        </section>
        <section className={CARD}>
          <h2 className="text-lg font-semibold">By component</h2>
          <p className="mt-1 text-sm text-muted">Average grade point in each part of your papers.</p>
          <ul className="mt-4 flex flex-col gap-3">
            {analysis.byComponent.map((c) => (
              <li key={c.key} className="flex items-center gap-3 text-sm">
                <span className="w-20 shrink-0 font-semibold">{COMPONENT_NAME[c.key]}</span>
                <Bar value={c.avgGp} />
                <span className="w-10 shrink-0 text-right tabular-nums">{c.avgGp.toFixed(2)}</span>
                <span className="w-16 shrink-0 text-right text-xs text-muted">{c.papers} papers</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <TargetPlanner analysis={analysis} />

      <div className="grid gap-6 sm:grid-cols-2">
        {[
          { title: "Your strongest papers", papers: analysis.strongest },
          { title: "Where to focus", papers: analysis.weakest },
        ].map((group) => (
          <section key={group.title} className={CARD}>
            <h2 className="text-lg font-semibold">{group.title}</h2>
            <ul className="mt-3 divide-y divide-border">
              {group.papers.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.title}</span>
                    <span className="text-xs text-muted">
                      Sem {p.semester} · {p.credits} credits
                    </span>
                  </span>
                  <span className="shrink-0 rounded-lg bg-surface-muted px-2.5 py-1 font-bold">{p.finalGrade}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <InternalEstimator papers={analysis.papers} />

      <section className={CARD}>
        <h2 className="text-lg font-semibold">Paper by paper</h2>

        {/* Mobile: stacked cards */}
        <ul className="mt-4 flex flex-col gap-3 sm:hidden">
          {analysis.papers.map((p) => (
            <li key={p.id} className="rounded-xl border border-border p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.title}</p>
                  <p className="text-xs text-muted">
                    Sem {p.semester} · {p.type ?? "—"} · {p.credits} credits
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-surface-muted px-2.5 py-1 text-sm font-bold">{p.finalGrade ?? "—"}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                {p.components.map((c) => (
                  <span key={c.key}>
                    {COMPONENT_NAME[c.key]} <GradeCell grade={c.grade} />
                  </span>
                ))}
                <span>GP {p.gp ?? "—"}</span>
                <PaperFlags paper={p} />
              </div>
            </li>
          ))}
        </ul>

        {/* Desktop: table */}
        <div className="mt-4 hidden overflow-x-auto sm:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-2 pr-3 font-medium">Sem</th>
                <th className="py-2 pr-3 font-medium">Paper</th>
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 text-right font-medium">Credits</th>
                <th className="py-2 pr-3 text-center font-medium">Theory</th>
                <th className="py-2 pr-3 text-center font-medium">Tutorial</th>
                <th className="py-2 pr-3 text-center font-medium">Practical</th>
                <th className="py-2 pr-3 text-center font-medium">Grade</th>
                <th className="py-2 pr-3 text-right font-medium">GP</th>
                <th className="py-2 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border tabular-nums">
              {analysis.papers.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3 text-muted">{p.semester}</td>
                  <td className="py-2.5 pr-3 font-medium">{p.title}</td>
                  <td className="py-2.5 pr-3 text-muted">{p.type ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-right">{p.credits}</td>
                  <td className="py-2.5 pr-3 text-center"><GradeCell grade={p.gradeL} /></td>
                  <td className="py-2.5 pr-3 text-center"><GradeCell grade={p.gradeT} /></td>
                  <td className="py-2.5 pr-3 text-center"><GradeCell grade={p.gradeP} /></td>
                  <td className="py-2.5 pr-3 text-center font-bold">{p.finalGrade ?? "—"}</td>
                  <td className="py-2.5 pr-3 text-right">{p.gp ?? "—"}</td>
                  <td className="py-2.5">
                    <span className="flex flex-wrap gap-1">
                      <PaperFlags paper={p} />
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
