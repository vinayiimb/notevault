"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CaretDown, ChartBar, CheckCircle, Funnel, MagnifyingGlass, X, XCircle } from "@phosphor-icons/react";
import { tally } from "@/lib/pyq-analyser";
import { JAM_UNITS, checkAnswer, keyLabel, type JamQuestion, type JamType } from "@/lib/jam-economics";
import { SolutionMarkdown } from "@/components/pyq-analyser/solution-markdown";

// Same workspace as /papers/analyser (filters left, one question at a time),
// plus JAM's three question types with tap-to-answer practice.

type Filters = { q: string; years: string[]; types: string[]; units: string[]; topics: string[]; marks: string[] };
type Sort = "paper" | "oldest" | "marks";
type Attempt = { picked: string[]; nat: string; result?: boolean | null; reveal?: boolean };

const EMPTY: Filters = { q: "", years: [], types: [], units: [], topics: [], marks: [] };

const TYPE_INFO: Record<JamType, { label: string; rule: string; chip: string }> = {
  MCQ: { label: "MCQ", rule: "One correct option · −⅓ (1 mark) / −⅔ (2 marks) for a wrong answer", chip: "bg-sky-50 text-sky-700" },
  MSQ: { label: "MSQ", rule: "One or more correct options · all must be picked · no negative marking", chip: "bg-amber-50 text-amber-700" },
  NAT: { label: "NAT", rule: "Type a number · no options · no negative marking", chip: "bg-emerald-50 text-emerald-700" },
};

const card = "rounded-2xl border border-border bg-surface";
const check = "size-4 shrink-0 rounded accent-accent";
const select =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:border-accent focus:outline-none";

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function matches(q: JamQuestion, f: Filters, skip?: keyof Filters) {
  if (skip !== "q" && f.q && !`${q.stem} ${q.options.map((o) => o.text).join(" ")} ${q.solution}`.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (skip !== "years" && f.years.length && !f.years.includes(q.year)) return false;
  if (skip !== "types" && f.types.length && !f.types.includes(q.type)) return false;
  if (skip !== "units" && f.units.length && !f.units.includes(q.unit)) return false;
  if (skip !== "topics" && f.topics.length && !f.topics.includes(q.topic)) return false;
  if (skip !== "marks" && f.marks.length && !f.marks.includes(String(q.marks))) return false;
  return true;
}

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

function CheckList({ options, selected, onToggle, label = (k: string) => k }: { options: { key: string; count: number }[]; selected: string[]; onToggle: (k: string) => void; label?: (k: string) => string }) {
  return (
    <ul className="space-y-2">
      {options.map((o) => (
        <li key={o.key}>
          <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
            <input type="checkbox" className={`${check} mt-0.5`} checked={selected.includes(o.key)} onChange={() => onToggle(o.key)} />
            <span className="min-w-0 flex-1">{label(o.key)}</span>
            <span className="shrink-0 text-xs text-muted">{o.count}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function JamAnalyserClient({ questions }: { questions: JamQuestion[] }) {
  const [filters, setFilters] = useState<Filters>(EMPTY);
  const [sort, setSort] = useState<Sort>("paper");
  const [idx, setIdx] = useState(0);
  const [attempts, setAttempts] = useState<Record<string, Attempt>>({});
  const [showDistribution, setShowDistribution] = useState(false);
  const pillsRef = useRef<HTMLDivElement>(null);

  const set = (patch: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...patch }));
    setIdx(0);
  };

  const filtered = useMemo(() => {
    const list = questions.filter((q) => matches(q, filters));
    return list.sort((a, b) =>
      sort === "marks" ? b.marks - a.marks || b.year.localeCompare(a.year) || a.number - b.number
      : sort === "oldest" ? a.year.localeCompare(b.year) || a.number - b.number
      : b.year.localeCompare(a.year) || a.number - b.number,
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
  const facet = (key: keyof Filters, values: (q: JamQuestion) => string[]) =>
    tally(questions.filter((q) => matches(q, filters, key)).map(values)).filter((o) => o.key);
  const yearOpts = facet("years", (q) => [q.year]).sort((a, b) => b.key.localeCompare(a.key));
  const typeOpts = facet("types", (q) => [q.type]).sort((a, b) => a.key.localeCompare(b.key));
  const unitOpts = facet("units", (q) => [q.unit]).sort((a, b) => JAM_UNITS.indexOf(a.key as never) - JAM_UNITS.indexOf(b.key as never));
  const topicOpts = facet("topics", (q) => [q.topic]);
  const marksOpts = facet("marks", (q) => [String(q.marks)]).sort((a, b) => Number(a.key) - Number(b.key));
  const unitOfTopic = useMemo(() => new Map(questions.map((q) => [q.topic, q.unit])), [questions]);
  const activeCount = Object.values(filters).reduce((n, v) => n + (Array.isArray(v) ? v.length : v ? 1 : 0), 0);

  const done = filtered.filter((q) => attempts[q.id]?.result !== undefined);
  const correct = done.filter((q) => attempts[q.id]?.result === true).length;

  const attempt = current ? (attempts[current.id] ?? { picked: [], nat: "" }) : null;
  const update = (patch: Partial<Attempt>) => current && setAttempts((a) => ({ ...a, [current.id]: { ...(a[current.id] ?? { picked: [], nat: "" }), ...patch } }));
  const submit = (picked: string[], nat: string) => current && update({ picked, nat, result: checkAnswer(current, current.type === "NAT" ? nat : picked), reveal: true });

  const filterPanel = (
    <>
      <div className={`${card} p-5`}>
        <p className="text-base font-semibold text-foreground">Years</p>
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

      <div className={`${card} px-5 py-2`}>
        <p className="pb-1 pt-3 text-base font-semibold text-foreground">Questions</p>
        <Section title="Search" defaultOpen={!!filters.q}>
          <div className="relative">
            <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={filters.q} onChange={(e) => set({ q: e.target.value })} placeholder="Search questions…" className={`${select} pl-8`} />
          </div>
        </Section>
        <Section title="Question type" defaultOpen>
          <CheckList options={typeOpts} selected={filters.types} onToggle={(k) => set({ types: toggle(filters.types, k) })} label={(k) => `${k} — ${k === "MCQ" ? "single correct" : k === "MSQ" ? "multiple select" : "numerical answer"}`} />
        </Section>
        <Section title="Syllabus units" defaultOpen>
          <CheckList options={unitOpts} selected={filters.units} onToggle={(k) => set({ units: toggle(filters.units, k) })} />
        </Section>
        <Section title="Topics">
          <ul className="max-h-72 space-y-3 overflow-y-auto pr-1">
            {JAM_UNITS.map((unit) => {
              const opts = topicOpts.filter((o) => unitOfTopic.get(o.key) === unit).sort((a, b) => a.key.localeCompare(b.key));
              if (!opts.length) return null;
              return (
                <li key={unit}>
                  <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{unit}</p>
                  <CheckList options={opts} selected={filters.topics} onToggle={(k) => set({ topics: toggle(filters.topics, k) })} />
                </li>
              );
            })}
          </ul>
        </Section>
        <Section title="Marks">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {marksOpts.map((o) => (
              <label key={o.key} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input type="checkbox" className={check} checked={filters.marks.includes(o.key)} onChange={() => set({ marks: toggle(filters.marks, o.key) })} />
                {o.key} mark{o.key === "1" ? "" : "s"} <span className="text-xs text-muted">{o.count}</span>
              </label>
            ))}
          </div>
        </Section>
        {activeCount > 0 && (
          <button type="button" onClick={() => set(EMPTY)} className="mb-3 mt-1 flex items-center gap-1 text-xs font-medium text-muted hover:text-foreground">
            <X size={12} /> Clear filters ({activeCount})
          </button>
        )}
      </div>
    </>
  );

  const unitBars = JAM_UNITS.map((unit) => {
    const inUnit = filtered.filter((q) => q.unit === unit);
    return { unit, count: inUnit.length, topics: tally(inUnit.map((q) => [q.topic])) };
  }).filter((u) => u.count);
  const maxTopic = Math.max(1, ...unitBars.flatMap((u) => u.topics.map((t) => t.count)));

  const optionClass = (label: string) => {
    if (!current || !attempt) return "";
    const picked = attempt.picked.includes(label);
    const shown = attempt.result !== undefined && current.key !== "all";
    const right = current.key.split(",").includes(label);
    if (shown && right) return "border-emerald-500 bg-emerald-50";
    if (shown && picked) return "border-red-400 bg-red-50";
    return picked ? "border-foreground bg-surface-muted" : "border-border hover:bg-surface-muted";
  };

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-4 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:pb-2">
        <div className={`${card} p-5`}>
          <p className="text-base font-semibold text-foreground">IIT JAM Economics (EN)</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {questions.length} questions · {new Set(questions.map((q) => q.year)).size} papers · answers checked against the official IIT keys
          </p>
        </div>
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
            {filtered.map((q, i) => {
              const r = attempts[q.id]?.result;
              return (
                <button
                  key={q.id}
                  type="button"
                  data-i={i}
                  onClick={() => setIdx(i)}
                  aria-label={`Question ${i + 1}`}
                  aria-current={i === idx}
                  className={`h-10 min-w-10 shrink-0 rounded-xl px-3 text-sm font-medium transition ${
                    i === idx ? "bg-foreground text-background" : r === true ? "bg-emerald-100 text-emerald-800" : r === false ? "bg-red-100 text-red-800" : "bg-surface-muted text-foreground hover:bg-border"
                  }`}
                >
                  {i + 1}
                </button>
              );
            })}
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
            {done.length > 0 && ` · ${correct}/${done.length} correct`}
          </span>
          <span className="flex items-center gap-2">
            <button type="button" onClick={() => setShowDistribution((v) => !v)} className="flex items-center gap-1 text-foreground sm:hidden" aria-label="Topic distribution">
              <ChartBar size={16} />
            </button>
            <select value={sort} onChange={(e) => (setSort(e.target.value as Sort), setIdx(0))} className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground" aria-label="Order">
              <option value="paper">Newest paper first</option>
              <option value="oldest">Oldest paper first</option>
              <option value="marks">Highest marks</option>
            </select>
          </span>
        </div>

        {showDistribution && (
          <section className={`${card} p-5`}>
            <h2 className="text-base font-semibold text-foreground">Topic distribution</h2>
            <p className="mt-0.5 text-xs text-muted">Questions per syllabus unit and topic in the current filter. Tap a topic to filter by it.</p>
            <div className="mt-4 space-y-5">
              {unitBars.map((u) => (
                <div key={u.unit}>
                  <p className="flex items-baseline justify-between text-sm font-semibold text-foreground">
                    {u.unit}
                    <span className="text-xs font-normal text-muted">
                      {u.count} · {Math.round((u.count / Math.max(1, filtered.length)) * 100)}%
                    </span>
                  </p>
                  <ul className="mt-2 space-y-2.5">
                    {u.topics.map((t) => (
                      <li key={t.key}>
                        <button type="button" onClick={() => set({ topics: toggle(filters.topics, t.key) })} className="block w-full text-left">
                          <span className="flex items-baseline justify-between gap-3 text-sm">
                            <span className={`min-w-0 ${filters.topics.includes(t.key) ? "font-semibold text-foreground" : "text-foreground/80"}`}>{t.key}</span>
                            <span className="shrink-0 text-xs text-muted">{t.count}</span>
                          </span>
                          <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-surface-muted">
                            <span className="block h-full rounded-full bg-foreground/80" style={{ width: `${(t.count / maxTopic) * 100}%` }} />
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {current && attempt ? (
          <article className={`${card} pyq-paper space-y-4 p-4 sm:p-6`}>
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-violet-50 px-3 py-1 text-violet-700">JAM {current.year} · Economics (EN)</span>
              <span className={`rounded-full px-3 py-1 font-medium ${TYPE_INFO[current.type].chip}`}>{current.type}</span>
              <span className="rounded-full bg-surface-muted px-3 py-1 text-foreground">
                {current.unit} · {current.topic}
              </span>
              <span className="ml-auto text-xs text-muted">
                Q{current.number} · {current.marks} mark{current.marks === 1 ? "" : "s"}
              </span>
            </div>
            <p className="text-xs text-muted">{TYPE_INFO[current.type].rule}</p>

            <div className="rounded-2xl border border-border p-4 sm:p-6">
              <SolutionMarkdown key={`q-${current.id}`} content={current.stem} />

              {current.type !== "NAT" ? (
                <div className="mt-4 space-y-2">
                  {current.options.map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      aria-pressed={attempt.picked.includes(o.label)}
                      onClick={() => {
                        if (current.type === "MCQ") submit([o.label], "");
                        else update({ picked: toggle(attempt.picked, o.label), result: undefined });
                      }}
                      className={`flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition ${optionClass(o.label)}`}
                    >
                      <span className="mt-0.5 shrink-0 text-sm font-semibold text-foreground">({o.label})</span>
                      <span className="min-w-0 flex-1 [&_.nt-root]:!bg-transparent [&_.pyq-solution]:text-[15px] [&_.pyq-solution_p]:!my-0">
                        <SolutionMarkdown content={o.text} />
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <form
                  className="mt-4 flex flex-wrap items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submit([], attempt.nat);
                  }}
                >
                  <input
                    value={attempt.nat}
                    onChange={(e) => update({ nat: e.target.value, result: undefined })}
                    inputMode="decimal"
                    placeholder="Your answer"
                    aria-label="Numerical answer"
                    className="w-44 rounded-xl border border-border bg-white px-4 py-2.5 text-base text-foreground focus:border-foreground focus:outline-none"
                  />
                  <button type="submit" disabled={!attempt.nat.trim()} className="rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40">
                    Check
                  </button>
                </form>
              )}

              {current.type === "MSQ" && (
                <button
                  type="button"
                  onClick={() => submit(attempt.picked, "")}
                  disabled={!attempt.picked.length}
                  className="mt-3 rounded-xl bg-foreground px-4 py-2.5 text-sm font-medium text-background disabled:opacity-40"
                >
                  Check answer
                </button>
              )}

              {attempt.result !== undefined && (
                <p className={`mt-4 flex items-center gap-2 text-sm font-medium ${attempt.result === false ? "text-red-700" : "text-emerald-700"}`}>
                  {attempt.result === false ? <XCircle size={18} weight="fill" /> : <CheckCircle size={18} weight="fill" />}
                  {attempt.result === null ? "Marks to all — IIT accepted every answer" : attempt.result ? "Correct" : "Not quite"} · Answer: {keyLabel(current)}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-border p-4 sm:p-6">
              {attempt.reveal ? (
                <>
                  <p className="mb-2 flex items-center gap-2 text-base font-semibold text-foreground">
                    <CheckCircle size={20} weight="fill" className="text-emerald-600" aria-hidden /> Solution · Answer: {keyLabel(current)}
                  </p>
                  <SolutionMarkdown key={current.id} content={current.solution} />
                </>
              ) : (
                <button type="button" onClick={() => update({ reveal: true })} className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <CheckCircle size={18} className="text-emerald-600" aria-hidden /> Show answer and solution
                </button>
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
