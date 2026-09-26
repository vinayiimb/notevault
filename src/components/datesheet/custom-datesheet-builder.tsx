"use client";

import { useMemo, useState } from "react";
import { CalendarBlank, MagnifyingGlass, Trash, FilePdf, CheckCircle } from "@phosphor-icons/react/dist/ssr";
import type { DatesheetEntry, DatesheetProgramme } from "@/lib/datesheet-types";
import { CATEGORY_LABELS } from "@/lib/datesheet-types";

type Props = {
  programmes: DatesheetProgramme[];
  entriesByProgramme: Record<string, DatesheetEntry[]>;
  examSession: string;
};

const ALL_CATEGORIES = "all";
const ALL_SEMESTERS = "all";
const ALL_SUBJECTS = "all";

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
  // Step 1: Course + Subject + Semester — this scopes which DSC (Core)
  // papers get auto-selected, since Core papers are compulsory, not a
  // choice, and are subject-specific (e.g. B.Sc. Hons Zoology's Core
  // papers are different from B.Sc. Hons Botany's).
  const [programmeSlug, setProgrammeSlug] = useState(programmes[0]?.slug ?? "");
  const [courseSubject, setCourseSubject] = useState<string>(ALL_SUBJECTS);
  const [courseSemester, setCourseSemester] = useState<string>(ALL_SEMESTERS);

  // Step 2: manual pool (GE, DSE, SEC, VAC, AEC, SBC…) — these are
  // electives, so students pick papers themselves from whichever
  // programme file actually holds that category.
  const [poolProgrammeSlug, setPoolProgrammeSlug] = useState(programmes[0]?.slug ?? "");
  const [semester, setSemester] = useState<string>(ALL_SEMESTERS);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, DatesheetEntry>>({});

  const entries = useMemo(
    () => entriesByProgramme[programmeSlug] ?? [],
    [entriesByProgramme, programmeSlug]
  );

  const courseSubjects = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.subject) set.add(e.subject);
    return Array.from(set).sort();
  }, [entries]);

  const courseSemesters = useMemo(() => {
    const pool = courseSubject === ALL_SUBJECTS ? entries : entries.filter((e) => e.subject === courseSubject);
    const set = new Set<string>();
    for (const e of pool) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [entries, courseSubject]);

  // Auto-select every DSC paper matching Course + Subject + Semester the
  // moment the student finishes picking them. Core papers are compulsory,
  // not a choice, so this runs as a direct response to each selection
  // (not a useEffect — there's no external system to sync with, just a
  // derived update to make right when the user acts).
  function applyDscAutoSelect(nextProgrammeSlug: string, nextSubject: string, nextSemester: string) {
    if (nextSemester === ALL_SEMESTERS) return;
    const pool = entriesByProgramme[nextProgrammeSlug] ?? [];
    const dscMatches = pool.filter(
      (e) =>
        e.category === "DSC" &&
        e.semester === nextSemester &&
        (nextSubject === ALL_SUBJECTS || e.subject === nextSubject)
    );
    if (dscMatches.length === 0) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const e of dscMatches) next[rowKey(e)] = e;
      return next;
    });
  }

  const poolEntries = useMemo(
    () => entriesByProgramme[poolProgrammeSlug] ?? [],
    [entriesByProgramme, poolProgrammeSlug]
  );

  const semesters = useMemo(() => {
    const set = new Set<string>();
    for (const e of poolEntries) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [poolEntries]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of poolEntries) set.add(e.category);
    return Array.from(set).sort();
  }, [poolEntries]);

  const availablePapers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return poolEntries
      .filter((e) => (semester === ALL_SEMESTERS ? true : e.semester === semester))
      .filter((e) => (category === ALL_CATEGORIES ? true : e.category === category))
      .filter((e) =>
        q ? `${e.subject} ${e.description} ${e.paperCode}`.toLowerCase().includes(q) : true
      );
  }, [poolEntries, semester, category, search]);

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

  const coursePdfHref = `/data/datesheet/source-pdfs/${programmeSlug}.pdf`;
  const poolPdfHref = `/data/datesheet/source-pdfs/${poolProgrammeSlug}.pdf`;
  const dscSelectedCount = selectedList.filter((e) => e.category === "DSC").length;

  return (
    <div className="space-y-6">
      {/* Step 1: Course + auto-selected Core papers */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">1. Your course</h2>
        <p className="mt-1 text-sm text-muted">
          Pick your programme, subject and semester — every Core (DSC) paper for it is added
          automatically since those are compulsory.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Programme / Course</span>
            <select
              value={programmeSlug}
              onChange={(e) => {
                setProgrammeSlug(e.target.value);
                setCourseSubject(ALL_SUBJECTS);
                setCourseSemester(ALL_SEMESTERS);
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

          {courseSubjects.length > 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-muted">Subject</span>
              <select
                value={courseSubject}
                onChange={(e) => {
                  setCourseSubject(e.target.value);
                  setCourseSemester(ALL_SEMESTERS);
                }}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value={ALL_SUBJECTS}>Choose subject</option>
                {courseSubjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-xs font-semibold text-muted">Semester</span>
            <select
              value={courseSemester}
              onChange={(e) => {
                const nextSemester = e.target.value;
                setCourseSemester(nextSemester);
                applyDscAutoSelect(programmeSlug, courseSubject, nextSemester);
              }}
              className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value={ALL_SEMESTERS}>Choose semester</option>
              {courseSemesters.map((s) => (
                <option key={s} value={s}>
                  Semester {s}
                </option>
              ))}
            </select>
          </label>
        </div>

        {dscSelectedCount > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-accent-soft px-3.5 py-2.5 text-sm font-semibold text-accent">
            <CheckCircle size={18} weight="fill" />
            {dscSelectedCount} Core (DSC) paper{dscSelectedCount === 1 ? "" : "s"} added automatically
          </div>
        )}

        <a
          href={coursePdfHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
        >
          <FilePdf size={14} weight="bold" />
          View official source PDF for {programmes.find((p) => p.slug === programmeSlug)?.label}
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: elective picker */}
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="text-lg font-bold text-foreground">2. Add your electives</h2>
          <p className="mt-1 text-sm text-muted">
            Now add your GE, DSE, SEC, VAC and AEC papers — these vary per student, so pick them
            manually. Elective files often cover every programme, so switch the file below if
            your paper isn&apos;t here.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="text-xs font-semibold text-muted">Datesheet file</span>
              <select
                value={poolProgrammeSlug}
                onChange={(e) => {
                  setPoolProgrammeSlug(e.target.value);
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
            href={poolPdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
          >
            <FilePdf size={14} weight="bold" />
            View official source PDF for {programmes.find((p) => p.slug === poolProgrammeSlug)?.label}
          </a>
        </div>

        {/* Right: your personal datesheet */}
        <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-foreground">Your datesheet</h2>
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
            Core papers from step 1 and electives you tick in step 2 both appear here, sorted by
            exam date.
          </p>

          <div className="mt-4 flex items-center gap-1.5 text-sm text-muted">
            <CalendarBlank size={16} weight="bold" />
            {examSession} &middot; {selectedList.length} paper{selectedList.length === 1 ? "" : "s"} selected
          </div>

          {selectedList.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
              No papers selected yet. Choose your course above, then add electives on the left.
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
    </div>
  );
}
