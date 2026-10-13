"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowsClockwise, ChartBar, Funnel, MagnifyingGlass, Repeat } from "@phosphor-icons/react";
import { tally, type AnalyserQuestion } from "@/lib/pyq-analyser";
import { ContentThemeProvider } from "@/components/content/notes/theme-provider";
import { ContentLightboxProvider } from "@/components/content/notes/note-image";
import { NotesMarkdown } from "@/components/content/notes/notes-markdown";

export type AnalyserSubject = {
  id: string;
  name: string;
  term: string;
  termOrder: number;
  program: string;
  count: number;
};

type Sort = "repeated" | "recent" | "marks";
type Filters = {
  q: string;
  years: string[];
  sections: string[];
  marks: string[];
  difficulty: string[];
  topics: string[];
  repeatedOnly: boolean;
};

const EMPTY: Filters = { q: "", years: [], sections: [], marks: [], difficulty: [], topics: [], repeatedOnly: false };
const DIFFICULTY_LABEL: Record<string, string> = { EASY: "Easy", MEDIUM: "Medium", HARD: "Hard" };
const DIFFICULTY_CLASS: Record<string, string> = {
  EASY: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  MEDIUM: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  HARD: "bg-red-500/10 text-red-700 dark:text-red-400",
};

function toggle(list: string[], value: string) {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function matches(q: AnalyserQuestion, f: Filters, skip?: keyof Filters) {
  if (skip !== "q" && f.q && !q.text.toLowerCase().includes(f.q.toLowerCase())) return false;
  if (skip !== "years" && f.years.length && !q.years.some((y) => f.years.includes(y))) return false;
  if (skip !== "sections" && f.sections.length && !f.sections.includes(q.section ?? "")) return false;
  if (skip !== "marks" && f.marks.length && !f.marks.includes(String(q.marks ?? ""))) return false;
  if (skip !== "difficulty" && f.difficulty.length && !f.difficulty.includes(q.difficulty ?? "")) return false;
  if (skip !== "topics" && f.topics.length && !q.topics.some((t) => f.topics.includes(t))) return false;
  if (skip !== "repeatedOnly" && f.repeatedOnly && q.repeatCount < 2) return false;
  return true;
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
  const [sort, setSort] = useState<Sort>("repeated");

  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));
  const pick = (id: string) => {
    setFilters(EMPTY);
    router.push(id ? `/papers/analyser?subject=${id}` : "/papers/analyser", { scroll: false });
  };

  const filtered = useMemo(() => {
    const list = questions.filter((q) => matches(q, filters));
    const latest = (q: AnalyserQuestion) => q.years.at(-1) ?? "";
    return list.sort((a, b) =>
      sort === "repeated"
        ? b.repeatCount - a.repeatCount || latest(b).localeCompare(latest(a))
        : sort === "recent"
          ? latest(b).localeCompare(latest(a))
          : (b.marks ?? 0) - (a.marks ?? 0),
    );
  }, [questions, filters, sort]);

  // Each facet counts questions matching every *other* filter, so options never dead-end.
  const facet = (key: keyof Filters, values: (q: AnalyserQuestion) => string[]) =>
    tally(questions.filter((q) => matches(q, filters, key)).map(values)).filter((o) => o.key);
  const yearOpts = facet("years", (q) => q.years).sort((a, b) => b.key.localeCompare(a.key));
  const sectionOpts = facet("sections", (q) => [q.section ?? ""]).sort((a, b) => a.key.localeCompare(b.key));
  const marksOpts = facet("marks", (q) => [String(q.marks ?? "")]).sort((a, b) => Number(a.key) - Number(b.key));
  const difficultyOpts = facet("difficulty", (q) => [q.difficulty ?? ""]);
  const topicOpts = facet("topics", (q) => q.topics);

  const topicBars = tally(filtered.map((q) => q.topics)).slice(0, 10);
  const yearBars = tally(filtered.map((q) => q.years)).sort((a, b) => a.key.localeCompare(b.key));
  const allYears = [...new Set(questions.flatMap((q) => q.years))].sort();
  const repeated = questions.filter((q) => q.repeatCount > 1).length;
  const activeCount =
    filters.years.length + filters.sections.length + filters.marks.length + filters.difficulty.length + filters.topics.length + (filters.repeatedOnly ? 1 : 0) + (filters.q ? 1 : 0);

  const picker = (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-3 shadow-2xs sm:flex-row sm:items-center">
      <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Course
        <select
          value={program}
          onChange={(e) => setProgram(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-accent focus:outline-none"
        >
          {programs.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </label>
      <label className="flex min-w-0 flex-[2] flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
        Subject
        <select
          value={selected?.program === program ? selected.id : ""}
          onChange={(e) => pick(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground focus:border-accent focus:outline-none"
        >
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
      </label>
    </div>
  );

  if (!subjects.length) {
    return (
      <div className="rounded-2xl border border-border bg-surface px-5 py-10 text-center text-sm text-muted">
        Topic-wise analysis is being prepared. Check back soon, or browse the full papers archive meanwhile.
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="space-y-5">
        {picker}
        <div>
          <h2 className="text-sm font-semibold text-foreground">Subjects with topic-wise analysis</h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {programSubjects.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => pick(s.id)}
                  className="flex w-full items-start justify-between gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-accent/60 hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{s.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">{s.term}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">{s.count} Qs</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  const chip = (active: boolean) =>
    `rounded-full border px-2.5 py-1 text-xs transition ${
      active ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background text-foreground hover:border-accent/60"
    }`;

  const chipGroup = (title: string, opts: { key: string; count: number }[], active: string[], key: keyof Filters, label?: (k: string) => string) =>
    opts.length > 0 && (
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {opts.map((o) => (
            <button key={o.key} type="button" onClick={() => set({ [key]: toggle(active, o.key) })} className={chip(active.includes(o.key))}>
              {label ? label(o.key) : o.key} <span className="opacity-60">{o.count}</span>
            </button>
          ))}
        </div>
      </div>
    );

  const filterPanel = (
    <div className="space-y-5">
      <div className="relative">
        <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="search"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search questions…"
          className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-2 text-sm text-foreground outline-none focus:border-accent"
        />
      </div>
      <label className="flex cursor-pointer items-center justify-between gap-3 text-sm text-foreground">
        <span className="flex items-center gap-2">
          <Repeat size={16} className="text-accent" /> Repeated questions only
        </span>
        <input type="checkbox" checked={filters.repeatedOnly} onChange={(e) => set({ repeatedOnly: e.target.checked })} className="size-4 accent-accent" />
      </label>
      {chipGroup("Year", yearOpts, filters.years, "years")}
      {chipGroup("Section", sectionOpts, filters.sections, "sections")}
      {chipGroup("Marks", marksOpts, filters.marks, "marks", (k) => `${k} marks`)}
      {chipGroup("Difficulty", difficultyOpts, filters.difficulty, "difficulty", (k) => DIFFICULTY_LABEL[k] ?? k)}
      {topicOpts.length > 0 && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">Topics</p>
          <ul className="mt-2 max-h-72 space-y-1 overflow-y-auto pr-1">
            {topicOpts.map((o) => (
              <li key={o.key}>
                <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-muted">
                  <input type="checkbox" checked={filters.topics.includes(o.key)} onChange={() => set({ topics: toggle(filters.topics, o.key) })} className="size-4 shrink-0 accent-accent" />
                  <span className="min-w-0 flex-1">{o.key}</span>
                  <span className="shrink-0 text-xs text-muted">{o.count}</span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
      {activeCount > 0 && (
        <button type="button" onClick={() => setFilters(EMPTY)} className="flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline">
          <ArrowsClockwise size={14} /> Clear all filters
        </button>
      )}
    </div>
  );

  const maxTopic = topicBars[0]?.count ?? 1;
  const maxYear = Math.max(1, ...yearBars.map((y) => y.count));

  return (
    <div className="space-y-5">
      {picker}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Questions", value: questions.length },
          { label: "Years covered", value: allYears.length ? `${allYears[0]}–${allYears.at(-1)}` : "—" },
          { label: "Repeated", value: repeated },
          { label: "Top topic", value: tally(questions.map((q) => q.topics))[0]?.key ?? "—" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-surface p-3">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 truncate text-lg font-semibold text-foreground" title={String(s.value)}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Mobile: filters collapse into a drawer above the results. */}
        <details className="rounded-2xl border border-border bg-surface p-4 lg:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 text-sm font-semibold text-foreground">
            <Funnel size={16} /> Filters{activeCount ? ` (${activeCount})` : ""}
          </summary>
          <div className="mt-4">{filterPanel}</div>
        </details>
        <aside className="hidden lg:block">
          <div className="sticky top-20 rounded-2xl border border-border bg-surface p-4">{filterPanel}</div>
        </aside>

        <div className="min-w-0 space-y-5">
          {topicBars.length > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <ChartBar size={16} className="text-accent" /> Topic-wise weightage
              </h2>
              <p className="mt-0.5 text-xs text-muted">Questions per topic in the current filter. Tap a topic to filter by it.</p>
              <ul className="mt-3 space-y-2">
                {topicBars.map((t) => (
                  <li key={t.key}>
                    <button type="button" onClick={() => set({ topics: toggle(filters.topics, t.key) })} className="group block w-full text-left">
                      <span className="flex items-baseline justify-between gap-3 text-xs">
                        <span className={`min-w-0 truncate ${filters.topics.includes(t.key) ? "font-semibold text-accent" : "text-foreground"}`}>{t.key}</span>
                        <span className="shrink-0 text-muted">{t.count}</span>
                      </span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-muted">
                        <span className="block h-full rounded-full bg-accent transition-all group-hover:opacity-80" style={{ width: `${(t.count / maxTopic) * 100}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {yearBars.length > 1 && (
                <>
                  <h3 className="mt-5 text-xs font-semibold uppercase tracking-wider text-muted">Year-wise</h3>
                  <div className="mt-2 flex h-24 items-end gap-1.5">
                    {yearBars.map((y) => (
                      <button
                        key={y.key}
                        type="button"
                        onClick={() => set({ years: toggle(filters.years, y.key) })}
                        className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1"
                        title={`${y.key}: ${y.count} questions`}
                      >
                        <span className="text-[10px] text-muted">{y.count}</span>
                        <span className={`w-full rounded-t ${filters.years.includes(y.key) ? "bg-accent" : "bg-accent/40"}`} style={{ height: `${(y.count / maxYear) * 70}%` }} />
                        <span className="text-[10px] text-muted">{y.key}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </section>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">
              <span className="font-semibold text-foreground">{filtered.length}</span> of {questions.length} questions
            </p>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-lg border border-border bg-surface px-2 py-1.5 text-xs text-foreground focus:border-accent focus:outline-none"
              aria-label="Sort questions"
            >
              <option value="repeated">Most repeated</option>
              <option value="recent">Most recent</option>
              <option value="marks">Highest marks</option>
            </select>
          </div>

          <ul className="space-y-3">
            {filtered.map((q) => (
              <li key={q.id} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  {q.number && <span className="font-semibold text-foreground">Q{q.number}</span>}
                  {q.section && <span>· {q.section}</span>}
                  {q.marks ? <span>· {q.marks} marks</span> : null}
                  {q.difficulty && <span className={`rounded-full px-2 py-0.5 font-medium ${DIFFICULTY_CLASS[q.difficulty]}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>}
                  {q.repeatCount > 1 && (
                    <span className="ml-auto flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-semibold text-accent">
                      <Repeat size={12} /> Asked {q.repeatCount}×
                    </span>
                  )}
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground">{q.text}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {q.years.map((y) => (
                    <span key={y} className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                      {y}
                    </span>
                  ))}
                  {q.topics.map((t) => (
                    <button key={t} type="button" onClick={() => set({ topics: toggle(filters.topics, t) })} className="rounded-md border border-border px-1.5 py-0.5 text-[11px] text-muted transition hover:border-accent hover:text-accent">
                      #{t}
                    </button>
                  ))}
                </div>
                {q.answer && <Answer markdown={q.answer} />}
              </li>
            ))}
            {filtered.length === 0 && (
              <li className="rounded-2xl border border-border bg-surface p-6 text-center text-sm text-muted">No questions match these filters.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Mounted only when opened: KaTeX + markdown for every card up front would
// make a 50-question subject slow on phones.
function Answer({ markdown }: { markdown: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-3 border-t border-border pt-3">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-xs font-semibold text-accent hover:underline" aria-expanded={open}>
        {open ? "Hide answer" : "Show answer"}
      </button>
      {open && (
        <div className="@container mt-3">
          <ContentThemeProvider>
            <ContentLightboxProvider>
              <NotesMarkdown content={markdown} />
            </ContentLightboxProvider>
          </ContentThemeProvider>
        </div>
      )}
    </div>
  );
}
