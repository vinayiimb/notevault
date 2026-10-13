"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CaretDown, ChartBar, Funnel, MagnifyingGlass, Repeat, X } from "@phosphor-icons/react";
import { tally, type AnalyserQuestion } from "@/lib/pyq-analyser";
import { SolutionMarkdown } from "./solution-markdown";

export type AnalyserSubject = {
  id: string;
  name: string;
  term: string;
  termOrder: number;
  program: string;
  count: number;
};

type Sort = "paper" | "repeated" | "recent" | "marks";
type Filters = {
  q: string;
  years: string[];
  marks: string[];
  difficulty: string[];
  topics: string[];
  repeatedOnly: boolean;
};

const EMPTY: Filters = { q: "", years: [], marks: [], difficulty: [], topics: [], repeatedOnly: false };
const DIFFICULTY_LABEL: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const DIFFICULTY_CHIP: Record<string, string> = {
  EASY: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  MEDIUM: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  HARD: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function matches(q: AnalyserQuestion, f: Filters, skip?: keyof Filters) {
  if (skip !== "q" && f.q && !`${q.text} ${q.answer}`.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (skip !== "years" && f.years.length && !q.years.some((y) => f.years.includes(y))) return false;
  if (skip !== "marks" && f.marks.length && !f.marks.includes(String(q.marks ?? ""))) return false;
  if (skip !== "difficulty" && f.difficulty.length && !f.difficulty.includes(q.difficulty ?? "")) return false;
  if (skip !== "topics" && f.topics.length && !q.topics.some((t) => f.topics.includes(t))) return false;
  if (skip !== "repeatedOnly" && f.repeatedOnly && q.repeatCount < 2) return false;
  return true;
}

// "2(b)" < "10(a)": numeric part first, then the rest.
function byNumber(a: AnalyserQuestion, b: AnalyserQuestion) {
  const na = parseInt(a.number ?? "", 10);
  const nb = parseInt(b.number ?? "", 10);
  if (na !== nb) return (Number.isNaN(na) ? 999 : na) - (Number.isNaN(nb) ? 999 : nb);
  return (a.number ?? "").localeCompare(b.number ?? "");
}

const card = "rounded-2xl border border-border bg-surface";
const check = "size-4 shrink-0 rounded accent-accent";

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-t border-border py-3 first:border-t-0">
      <summary className="flex cursor-pointer list-none items-center gap-2 text-[15px] font-medium text-foreground">
        <CaretDown size={14} className="-rotate-90 transition group-open:rotate-0" />
        {title}
      </summary>
      <div className="mt-3 pl-1">{children}</div>
    </details>
  );
}

export function PyqAnalyserClient({
  subjects,
  selected,
  questions,
}: {
  subjects: AnalyserSubject[];
  selected: AnalyserSubject | null;
  questions: AnalyserQuestion[];
}) {
  const router = useRouter();
  const programs = useMemo(() => [...new Set(subjects.map((s) => s.program))], [subjects]);
  const [program, setProgram] = useState(selected?.program ?? programs[0] ?? "");
  const programSubjects = subjects.filter((s) => s.program === program);
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<Sort>("paper");
  const [idx, setIdx] = useState(0);
  const [showDistribution, setShowDistribution] = useState(false);
  const pillsRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setIdx(0);
  };
  const pick = (id: string) => {
    setFilters(EMPTY);
    setIdx(0);
    router.push(id ? `/papers/analyser?subject=${id}` : "/papers/analyser", { scroll: false });
  };

  const filtered = useMemo(() => {
    const list = questions.filter((q) => matches(q, filters));
    const latest = (q: AnalyserQuestion) => q.years.at(-1) ?? "";
    return list.sort((a, b) =>
      sort === "paper"
        ? latest(b).localeCompare(latest(a)) || byNumber(a, b)
        : sort === "repeated"
          ? b.repeatCount - a.repeatCount || byNumber(a, b)
          : sort === "recent"
            ? latest(b).localeCompare(latest(a))
            : (b.marks ?? 0) - (a.marks ?? 0),
    );
  }, [questions, filters, sort]);
  const current = filtered[Math.min(idx, filtered.length - 1)];

  useEffect(() => {
    pillsRef.current?.querySelector<HTMLElement>(`[data-i="${idx}"]`)?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest("input, textarea, select")) return;
      if (e.key === "ArrowRight") setIdx((i) => Math.min(i + 1, filtered.length - 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(i - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [filtered.length]);

  // Each facet counts questions matching every *other* filter, so options never dead-end.
  const facet = (key: keyof Filters, values: (q: AnalyserQuestion) => string[]) =>
    tally(questions.filter((q) => matches(q, filters, key)).map(values)).filter((o) => o.key);
  const yearOpts = facet("years", (q) => q.years).sort((a, b) => a.key.localeCompare(b.key));
  const marksOpts = facet("marks", (q) => [String(q.marks ?? "")]).sort((a, b) => Number(a.key) - Number(b.key));
  const difficultyOpts = facet("difficulty", (q) => [q.difficulty ?? ""]);
  const topicOpts = facet("topics", (q) => q.topics).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  const activeCount =
    filters.years.length + filters.marks.length + filters.difficulty.length + filters.topics.length + (filters.repeatedOnly ? 1 : 0) + (filters.q ? 1 : 0);

  const select =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

  const subjectPicker = (
    <div className={`${card} space-y-3 p-5`}>
      <p className="text-base font-semibold text-foreground">Paper</p>
      <select value={program} onChange={(e) => setProgram(e.target.value)} className={select} aria-label="Course">
        {programs.map((p) => (
          <option key={p}>{p}</option>
        ))}
      </select>
      <select value={selected?.program === program ? selected.id : ""} onChange={(e) => pick(e.target.value)} className={select} aria-label="Subject">
        <option value="">Select a subject…</option>
        {[...new Set(programSubjects.map((s) => s.term))].map((term) => (
          <optgroup key={term} label={term}>
            {programSubjects
              .filter((s) => s.term === term)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.count})
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );

  if (!subjects.length) {
    return <div className={`${card} px-5 py-10 text-center text-sm text-muted`}>Topic-wise analysis is being prepared. Check back soon.</div>;
  }

  if (!selected) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <div>{subjectPicker}</div>
        <ul className="grid grid-cols-1 content-start gap-2 sm:grid-cols-2">
          {programSubjects.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => pick(s.id)}
                className={`${card} flex w-full items-start justify-between gap-3 p-4 text-left transition hover:border-foreground/30`}
              >
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">{s.name}</span>
                  <span className="mt-0.5 block text-xs text-muted">{s.term}</span>
                </span>
                <span className="shrink-0 rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-foreground">{s.count} Qs</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const allYears = yearOpts.map((o) => o.key);
  const filterPanel = (
    <>
      <div className={`${card} p-5`}>
        <p className="text-base font-semibold text-foreground">Years</p>
        <div className="mt-3 border-t border-border pt-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className={check}
              checked={allYears.length > 0 && allYears.every((y) => filters.years.includes(y))}
              onChange={(e) => set({ years: e.target.checked ? allYears : [] })}
            />
            Select all
          </label>
          <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-border pt-3">
            {yearOpts.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className={check} checked={filters.years.includes(o.key)} onChange={() => set({ years: toggle(filters.years, o.key) })} />
                {o.key}
                <span className="text-xs text-muted">{o.count}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className={`${card} px-5 py-2`}>
        <p className="pb-1 pt-3 text-base font-semibold text-foreground">Questions</p>
        <Section title="Search" defaultOpen={!!filters.q}>
          <div className="relative">
            <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search questions…" className={`${select} pl-8`} />
          </div>
        </Section>
        {topicOpts.length > 0 && (
          <Section title="Units & topics" defaultOpen>
            <ul className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {topicOpts.map((o) => (
                <li key={o.key}>
                  <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                    <input type="checkbox" className={`${check} mt-0.5`} checked={filters.topics.includes(o.key)} onChange={() => set({ topics: toggle(filters.topics, o.key) })} />
                    <span className="min-w-0 flex-1">{o.key}</span>
                    <span className="shrink-0 text-xs text-muted">{o.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          </Section>
        )}
        {marksOpts.length > 0 && (
          <Section title="Marks">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {marksOpts.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" className={check} checked={filters.marks.includes(o.key)} onChange={() => set({ marks: toggle(filters.marks, o.key) })} />
                  {o.key} marks <span className="text-xs text-muted">{o.count}</span>
                </label>
              ))}
            </div>
          </Section>
        )}
        {difficultyOpts.length > 0 && (
          <Section title="Difficulty">
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {difficultyOpts.map((o) => (
                <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" className={check} checked={filters.difficulty.includes(o.key)} onChange={() => set({ difficulty: toggle(filters.difficulty, o.key) })} />
                  {DIFFICULTY_LABEL[o.key] ?? o.key} <span className="text-xs text-muted">{o.count}</span>
                </label>
              ))}
            </div>
          </Section>
        )}
        <Section title="Repeated" defaultOpen={filters.repeatedOnly}>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" className={check} checked={filters.repeatedOnly} onChange={(e) => set({ repeatedOnly: e.target.checked })} />
            Only questions asked more than once
          </label>
        </Section>
        {activeCount > 0 && (
          <button type="button" onClick={() => set(EMPTY)} className="mb-3 mt-1 flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground">
            <X size={12} /> Clear filters ({activeCount})
          </button>
        )}
      </div>
    </>
  );

  const topicBars = tally(filtered.map((q) => q.topics)).sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  const maxTopic = Math.max(1, ...topicBars.map((t) => t.count));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
        {subjectPicker}
        {/* Phone: filters fold into one drawer above the question. */}
        <details className={`${card} p-4 lg:hidden`}>
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
            <Funnel size={16} /> Filters{activeCount ? ` (${activeCount})` : ""}
          </summary>
          <div className="mt-4 space-y-4">{filterPanel}</div>
        </details>
        <div className="hidden space-y-4 lg:block">{filterPanel}</div>
      </aside>

      <div className="min-w-0 space-y-4">
        <div className="flex items-center gap-3">
          <div ref={pillsRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
            {filtered.map((q, i) => (
              <button
                key={q.id}
                type="button"
                data-i={i}
                onClick={() => setIdx(i)}
                aria-label={`Question ${i + 1}`}
                aria-current={i === idx}
                className={`h-10 min-w-10 shrink-0 rounded-xl px-3 text-sm font-medium transition ${
                  i === idx ? "bg-foreground text-background" : "bg-surface-muted text-foreground hover:bg-border"
                }`}
              >
                {i + 1}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setShowDistribution((v) => !v)}
            className={`${card} hidden shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium text-foreground transition hover:border-foreground/30 sm:flex`}
          >
            {showDistribution ? "Hide" : "View"} topic distribution <ArrowRight size={14} />
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 text-sm text-muted">
          <span>
            {filtered.length ? `Question ${idx + 1} of ${filtered.length}` : "No questions"}
            {filtered.length !== questions.length && ` · filtered from ${questions.length}`}
          </span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setShowDistribution((v) => !v)} className="flex items-center gap-1 text-foreground sm:hidden" aria-label="Topic distribution">
              <ChartBar size={16} />
            </button>
            <select value={sort} onChange={(e) => (setSort(e.target.value as Sort), setIdx(0))} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground" aria-label="Order">
              <option value="paper">Paper order</option>
              <option value="repeated">Most repeated</option>
              <option value="recent">Most recent</option>
              <option value="marks">Highest marks</option>
            </select>
          </span>
        </div>

        {showDistribution && (
          <section className={`${card} p-5`}>
            <h2 className="text-base font-semibold text-foreground">Topic distribution</h2>
            <p className="mt-0.5 text-xs text-muted">Questions per unit/topic in the current filter. Tap one to filter by it.</p>
            <ul className="mt-4 space-y-3">
              {topicBars.map((t) => (
                <li key={t.key}>
                  <button type="button" onClick={() => set({ topics: toggle(filters.topics, t.key) })} className="block w-full text-left">
                    <span className="flex items-baseline justify-between gap-3 text-sm">
                      <span className={`min-w-0 ${filters.topics.includes(t.key) ? "font-semibold text-foreground" : "text-foreground/80"}`}>{t.key}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {t.count} · {Math.round((t.count / Math.max(1, filtered.length)) * 100)}%
                      </span>
                    </span>
                    <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                      <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${(t.count / maxTopic) * 100}%` }} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {current ? (
          <article className={`${card} space-y-4 p-4 sm:p-6`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                {selected.name.replace(/^[A-Z]+-[\d.]+\s*—\s*/, "")} {current.years.join(", ")}
              </span>
              {current.topics.slice(0, 2).map((t) => (
                <span key={t} className="rounded-full bg-sky-50 px-3 py-1 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
                  {t}
                </span>
              ))}
              {current.difficulty && <span className={`rounded-full px-3 py-1 ${DIFFICULTY_CHIP[current.difficulty]}`}>{DIFFICULTY_LABEL[current.difficulty]}</span>}
              {current.repeatCount > 1 && (
                <span className="flex items-center gap-1 rounded-full bg-surface-muted px-3 py-1 text-foreground">
                  <Repeat size={13} /> Asked {current.repeatCount}×
                </span>
              )}
              {(current.number || current.marks) && (
                <span className="ml-auto text-xs text-muted">
                  {current.number && `Q${current.number}`}
                  {current.number && current.marks ? " · " : ""}
                  {current.marks ? `${current.marks} marks` : ""}
                </span>
              )}
            </div>

            <div className="rounded-2xl border border-border p-4 text-[15px] leading-7 text-foreground sm:p-6">
              <p className="whitespace-pre-line">{current.text}</p>
            </div>

            <div className="rounded-2xl border border-border p-4 sm:p-6">
              <p className="mb-3 text-[15px] font-semibold text-foreground">Solution</p>
              {current.answer ? (
                <SolutionMarkdown key={current.id} content={current.answer} />
              ) : (
                <p className="text-sm text-muted">Solution coming soon.</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <button
                type="button"
                onClick={() => setIdx((i) => Math.max(i - 1, 0))}
                disabled={idx === 0}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Previous
              </button>
              <button
                type="button"
                onClick={() => setIdx((i) => Math.min(i + 1, filtered.length - 1))}
                disabled={idx >= filtered.length - 1}
                className="flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90 disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </article>
        ) : (
          <div className={`${card} p-8 text-center text-sm text-muted`}>No questions match these filters.</div>
        )}
      </div>
    </div>
  );
}
