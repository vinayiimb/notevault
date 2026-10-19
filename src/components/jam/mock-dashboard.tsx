"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, CaretDown, Info } from "@phosphor-icons/react";
import { JAM_UNITS } from "@/lib/jam-economics";
import { readAttempts, type MockAttempt, type MockKind, type MockTest } from "@/lib/jam-mock";

const card = "rounded-3xl border border-border bg-surface";
const REVIEW_TABS: [MockKind, string][] = [
  ["full", "full-length"],
  ["section", "sectionals"],
  ["topic", "topic-tests"],
];

const date = (t: number) => new Date(t).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function JamMockDashboard({ tests }: { tests: MockTest[] }) {
  const [attempts, setAttempts] = useState<MockAttempt[]>([]);
  const [unit, setUnit] = useState<string>(JAM_UNITS[0]);
  const [reviewTab, setReviewTab] = useState<MockKind>("full");

  // Attempts are stored in this browser only.
  useEffect(() => {
    Promise.resolve().then(() => setAttempts(readAttempts()));
  }, []);

  const years = [...new Set(tests.filter((t) => t.year).map((t) => t.year!))];
  const answered = useMemo(() => new Set(attempts.flatMap((a) => Object.entries(a.responses).filter(([, r]) => r.picked.length || r.nat.trim()).map(([id]) => id))), [attempts]);
  const best = (testId: string) => {
    const mine = attempts.filter((a) => a.testId === testId);
    return mine.length ? mine.reduce((b, a) => (a.score > b.score ? a : b)) : null;
  };
  const topicTests = tests.filter((t) => t.kind === "topic" && t.unit === unit).sort((a, b) => a.title.localeCompare(b.title));
  const reviews = attempts.filter((a) => a.kind === reviewTab);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className={`${card} flex flex-col p-5 sm:p-8 lg:h-[30rem]`}>
          <h2 className="text-lg font-semibold text-foreground">Full Length/Sectional Mocks</h2>
          <ul className="mt-5 space-y-3 overflow-y-auto pr-1 lg:flex-1">
            {years.map((year) => {
              const full = tests.find((t) => t.id === `full-${year}`)!;
              const sections = tests.filter((t) => t.kind === "section" && t.year === year);
              const top = best(full.id);
              return (
                <li key={year} className="flex items-center gap-3 rounded-2xl border border-border px-5 py-5 sm:px-7">
                  <span className="text-2xl font-medium text-foreground">{year}</span>
                  {top && (
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
                      best {top.score}/{top.max}
                    </span>
                  )}
                  <details className="group relative ml-auto">
                    <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full bg-surface-muted px-3.5 py-1.5 text-sm text-muted transition hover:text-foreground">
                      attempt <CaretDown size={12} className="transition group-open:rotate-180" />
                    </summary>
                    <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-2xl border border-border bg-surface py-1.5 shadow-lg">
                      {[full, ...sections].map((t) => (
                        <Link key={t.id} href={`/jameco/mock/${t.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-surface-muted">
                          <span className="text-sm font-medium text-foreground">{t.kind === "full" ? "Full length" : t.title.split(" · ").slice(1).join(" · ")}</span>
                          <span className="shrink-0 text-xs text-muted">
                            {t.questionIds.length} Q · {t.minutes} min
                          </span>
                        </Link>
                      ))}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </section>

        <section className={`${card} flex flex-col p-5 sm:p-8 lg:h-[30rem]`}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Topic Test</h2>
            <span title="Every past JAM question on one syllabus topic. Submit each answer to check it and see the solution." className="text-muted">
              <Info size={18} aria-label="About topic tests" />
            </span>
            <label className="relative">
              <span className="sr-only">Syllabus unit</span>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="appearance-none rounded-full bg-emerald-50 py-1.5 pl-4 pr-9 text-[15px] font-medium text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-300"
              >
                {JAM_UNITS.map((u) => (
                  <option key={u}>{u}</option>
                ))}
              </select>
              <CaretDown size={14} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-700" />
            </label>
          </div>
          <div className="mt-5 grid grid-cols-[1fr_5rem_4.5rem] gap-2 pb-2 text-xs text-muted sm:text-sm">
            <span>Subtopic</span>
            <span className="text-center">Done/Total</span>
            <span className="text-center">Attempt</span>
          </div>
          <ul className="overflow-y-auto pr-1 lg:flex-1">
            {topicTests.map((t) => (
              <li key={t.id} className="grid grid-cols-[1fr_5rem_4.5rem] items-center gap-2 border-b border-border py-3 last:border-0">
                <span className="text-[15px] text-foreground">{t.title}</span>
                <span className="text-center text-sm text-muted">
                  {t.questionIds.filter((id) => answered.has(id)).length}/{t.questionIds.length}
                </span>
                <Link
                  href={`/jameco/mock/${t.id}`}
                  aria-label={`Attempt ${t.title}`}
                  className="mx-auto flex h-8 w-16 items-center justify-center rounded-full bg-surface-muted text-muted transition hover:bg-foreground hover:text-background"
                >
                  <ArrowRight size={14} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className={`${card} p-5 sm:p-8`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Review</h2>
          <div className="flex flex-wrap gap-2">
            {REVIEW_TABS.map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setReviewTab(k)}
                aria-pressed={reviewTab === k}
                className={`rounded-full px-4 py-1.5 text-sm transition ${reviewTab === k ? "bg-foreground text-background" : "bg-surface-muted text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {reviews.length ? (
          <ul className="mt-5 divide-y divide-border">
            {reviews.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-foreground">{a.title}</p>
                  <p className="text-xs text-muted">
                    {date(a.at)} · {a.correct} correct · {a.wrong} wrong · {a.skipped} skipped · {Math.round(a.usedSec / 60)} min
                  </p>
                </div>
                <span className="text-lg font-semibold text-foreground">
                  {a.score}
                  <span className="text-sm font-normal text-muted">/{a.max}</span>
                </span>
                <Link href={`/jameco/mock/${a.testId}?review=${a.id}`} className="flex items-center gap-1 rounded-full bg-surface-muted px-3.5 py-1.5 text-sm font-medium text-foreground hover:bg-border">
                  Review <ArrowRight size={13} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[15px] text-muted">No {REVIEW_TABS.find(([k]) => k === reviewTab)![1]} attempts yet. Attempts you submit appear here.</p>
        )}
      </section>
    </div>
  );
}
