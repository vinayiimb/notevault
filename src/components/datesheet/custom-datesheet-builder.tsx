"use client";

import { useMemo, useState } from "react";
import { CalendarBlank, MagnifyingGlass, Trash, FilePdf } from "@phosphor-icons/react/dist/ssr";
import type { DatesheetEntry, DatesheetProgramme } from "@/lib/datesheet-types";
import { CATEGORY_LABELS } from "@/lib/datesheet-types";

type Props = {
  programmes: DatesheetProgramme[];
  entriesByProgramme: Record<string, DatesheetEntry[]>;
  examSession: string;
};

const ALL_CATEGORIES = "all";
const ALL_SEMESTERS = "all";

function formatDate(iso: string, day: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const monthLabel = date.toLocaleDateString("en-IN", { month: "short" });
  return `${d} ${monthLabel} ${y} (${day})`;
}

function rowKey(e: DatesheetEntry) {
  return e.paperCode;
}

export function CustomDatesheetBuilder({ programmes, entriesByProgramme, examSession }: Props) {
  const [programmeSlug, setProgrammeSlug] = useState(programmes[0]?.slug ?? "");
  const [semester, setSemester] = useState<string>(ALL_SEMESTERS);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, DatesheetEntry>>({});

  const entries = useMemo(
    () => entriesByProgramme[programmeSlug] ?? [],
    [entriesByProgramme, programmeSlug]
  );

  const semesters = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [entries]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) set.add(e.category);
    return Array.from(set).sort();
  }, [entries]);

  const availablePapers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries
      .filter((e) => (semester === ALL_SEMESTERS ? true : e.semester === semester))
      .filter((e) => (category === ALL_CATEGORIES ? true : e.category === category))
      .filter((e) =>
        q ? `${e.subject} ${e.description} ${e.paperCode}`.toLowerCase().includes(q) : true
      );
  }, [entries, semester, category, search]);

  const selectedList = useMemo(() => {
    return Object.values(selected).sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }, [selected]);

  function toggle(entry: DatesheetEntry) {
    setSelected((prev) => {
      const key = rowKey(entry);
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = entry;
      }
      return next;
    });
  }

  function clearAll() {
    setSelected({});
  }

  const sourcePdfHref = `/data/datesheet/source-pdfs/${programmeSlug}.pdf`;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      {/* Left: paper picker */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">1. Pick your papers</h2>
        <p className="mt-1 text-sm text-muted">
          Filter by programme, semester and category, then tick the papers you&apos;re actually taking.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Programme / Course</span>
            <select
              value={programmeSlug}
              onChange={(e) => {
                setProgrammeSlug(e.target.value);
                setSemester(ALL_SEMESTERS);
                setCategory(ALL_CATEGORIES);
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {programmes.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="text-xs font-semibold text-muted">Semester</span>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value={ALL_SEMESTERS}>All semesters</option>
              {semesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* Category pills */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCategory(ALL_CATEGORIES)}
            className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              category === ALL_CATEGORIES
                ? "border-accent bg-accent text-accent-foreground"
                : "border-border bg-background text-muted hover:border-accent hover:text-accent"
            }`}
          >
            All categories
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-9 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                category === c
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-background text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {CATEGORY_LABELS[c] ?? c}
            </button>
          ))}
        </div>

        <label className="mt-3 flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
          <MagnifyingGlass size={16} className="text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search subject, paper name or code…"
            className="min-h-11 w-full bg-transparent text-sm text-foreground outline-none"
          />
        </label>

        <div className="mt-4 max-h-[520px] overflow-y-auto rounded-xl border border-border">
          {availablePapers.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">No papers match these filters.</div>
          ) : (
            <ul className="divide-y divide-border">
              {availablePapers.map((e) => {
                const key = rowKey(e);
                const isChecked = Boolean(selected[key]);
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-accent-soft/40">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggle(e)}
                        className="mt-1 size-4 shrink-0 accent-[var(--accent,#0284c7)]"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">
                          {e.description}
                        </span>
                        <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
                          {e.subject ? <span>{e.subject}</span> : null}
                          <span>Sem {e.semester ?? "—"}</span>
                          <span className="font-mono">{e.paperCode}</span>
                          <span>{formatDate(e.date, e.day)}</span>
                          <span>{e.startTime}</span>
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                        {e.category}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <a
          href={sourcePdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          <FilePdf size={14} weight="bold" />
          View official source PDF for {programmes.find((p) => p.slug === programmeSlug)?.label}
        </a>
      </div>

      {/* Right: your personal datesheet */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-foreground">2. Your datesheet</h2>
          {selectedList.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground"
            >
              <Trash size={14} />
              Clear all
            </button>
          )}
        </div>
        <p className="mt-1 text-sm text-muted">
          Papers you tick appear here automatically, sorted by exam date.
        </p>

        <div className="mt-4 flex items-center gap-1.5 text-sm text-muted">
          <CalendarBlank size={16} weight="bold" />
          {examSession} &middot; {selectedList.length} paper{selectedList.length === 1 ? "" : "s"} selected
        </div>

        {selectedList.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
            No papers selected yet. Tick papers on the left to build your personal datesheet.
          </div>
        ) : (
          <ol className="mt-4 space-y-3">
            {selectedList.map((e) => (
              <li
                key={rowKey(e)}
                className="rounded-xl border border-border bg-background p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">{formatDate(e.date, e.day)}</p>
                    <p className="text-xs text-muted">{e.startTime}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent">
                    {e.category}
                  </span>
                </div>
                <p className="mt-2 text-sm text-foreground">{e.description}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {e.subject ? `${e.subject} · ` : ""}Sem {e.semester ?? "—"} · <span className="font-mono">{e.paperCode}</span>
                </p>
                <button
                  type="button"
                  onClick={() => toggle(e)}
                  className="mt-2 text-xs font-semibold text-muted hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}

        {selectedList.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="mt-5 min-h-11 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Print / Save as PDF
          </button>
        )}
      </div>
    </div>
  );
}
