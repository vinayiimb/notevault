"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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
const ALL_COURSES = "all";

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
  // Step 1: Programme + Course + Semester — this scopes which DSC (Core)
  // papers get auto-selected, since Core papers are compulsory, not a
  // choice, and are course-specific (e.g. within B.Sc. (Hons), Zoology's
  // Core papers are different from Botany's — Zoology and Botany are the
  // "Course" here, same as Political Science or History within B.A.
  // (Hons)).
  const [programmeSlug, setProgrammeSlug] = useState(programmes[0]?.slug ?? "");
  const [selectedCourse, setSelectedCourse] = useState<string>(ALL_COURSES);
  const [courseSemester, setCourseSemester] = useState<string>(ALL_SEMESTERS);

  // Step 2: manual pool (GE, DSE, SEC, VAC, AEC, SBC…) — these are
  // electives. Most categories each live in their OWN standalone PDF/file
  // (AEC papers are only in aec.json, GE only in ge.json, etc — see
  // scripts/datesheet/extract.py's FILES list), not spread across every
  // programme file. So the elective picker searches across ALL programme
  // files at once rather than being pinned to one "Datesheet file" — a
  // student clicking the AEC pill would otherwise see an empty list
  // whenever the currently-selected file wasn't aec.json.
  const [semester, setSemester] = useState<string>(ALL_SEMESTERS);
  const [category, setCategory] = useState<string>(ALL_CATEGORIES);
  const [electiveCourse, setElectiveCourse] = useState<string>(ALL_COURSES);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Record<string, DatesheetEntry>>({});

  const entries = useMemo(
    () => entriesByProgramme[programmeSlug] ?? [],
    [entriesByProgramme, programmeSlug]
  );

  const courseOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.subject) set.add(e.subject);
    return Array.from(set).sort();
  }, [entries]);

  const courseSemesters = useMemo(() => {
    const pool = selectedCourse === ALL_COURSES ? entries : entries.filter((e) => e.subject === selectedCourse);
    const set = new Set<string>();
    for (const e of pool) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [entries, selectedCourse]);

  // Auto-select every DSC paper matching Programme + Course + Semester the
  // moment the student finishes picking them. Core papers are compulsory,
  // not a choice, so this runs as a direct response to each selection
  // (not a useEffect — there's no external system to sync with, just a
  // derived update to make right when the user acts).
  function applyDscAutoSelect(nextProgrammeSlug: string, nextCourse: string, nextSemester: string) {
    if (nextSemester === ALL_SEMESTERS) return;
    const pool = entriesByProgramme[nextProgrammeSlug] ?? [];
    const dscMatches = pool.filter(
      (e) =>
        e.category === "DSC" &&
        e.semester === nextSemester &&
        (nextCourse === ALL_COURSES || e.subject === nextCourse)
    );
    if (dscMatches.length === 0) return;
    setSelected((prev) => {
      const next = { ...prev };
      for (const e of dscMatches) next[rowKey(e)] = e;
      return next;
    });
  }

  // Every programme file's rows, deduplicated by paper code — a paper
  // like a GE course can legitimately appear in more than one file (a
  // programme's own file AND the standalone GE file), and we only want
  // one checkbox for it.
  const allEntries = useMemo(() => {
    const byCode = new Map<string, DatesheetEntry & { sourceProgrammeSlug: string }>();
    for (const p of programmes) {
      for (const e of entriesByProgramme[p.slug] ?? []) {
        if (!byCode.has(e.paperCode)) {
          byCode.set(e.paperCode, { ...e, sourceProgrammeSlug: p.slug });
        }
      }
    }
    return Array.from(byCode.values());
  }, [programmes, entriesByProgramme]);

  const semesters = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [allEntries]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) set.add(e.category);
    return Array.from(set).sort();
  }, [allEntries]);

  // Course/subject options narrow as soon as a category is picked, since
  // "Course" means something different per category (GE's course list is
  // completely different from DSE's).
  const electiveCourseOptions = useMemo(() => {
    const set = new Set<string>();
    for (const e of allEntries) {
      if (category !== ALL_CATEGORIES && e.category !== category) continue;
      if (e.subject) set.add(e.subject);
    }
    return Array.from(set).sort();
  }, [allEntries, category]);

  const availablePapers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allEntries
      .filter((e) => (semester === ALL_SEMESTERS ? true : e.semester === semester))
      .filter((e) => (category === ALL_CATEGORIES ? true : e.category === category))
      .filter((e) => (electiveCourse === ALL_COURSES ? true : e.subject === electiveCourse))
      .filter((e) =>
        q ? `${e.subject} ${e.description} ${e.paperCode}`.toLowerCase().includes(q) : true
      );
  }, [allEntries, semester, category, electiveCourse, search]);

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
  const dscSelectedCount = selectedList.filter((e) => e.category === "DSC").length;

  return (
    <div className="space-y-6">
      {/* Print-only stylesheet: printing shows exactly the "Your
          datesheet" grid below (the actual on-screen table the student
          built) instead of a separately-authored print layout — hide the
          Step 1/Step 2 picker UI and the per-row action buttons, and
          stretch the grid card to fill the page since it's the only thing
          left on it. */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 1.2cm; }
          .datesheet-picker-steps,
          .datesheet-grid-actions,
          .datesheet-row-action { display: none !important; }
          .datesheet-grid-card {
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            max-width: none !important;
          }
          .datesheet-grid-scroll {
            overflow: visible !important;
            border: none !important;
            border-radius: 0 !important;
          }
          /* Landscape + full page width gives the grid room to breathe
             whether it's 3 rows or 30 — the table just fills whatever
             width the page gives it instead of staying pinned to its
             on-screen 720px min-width. */
          .datesheet-grid-table {
            width: 100% !important;
            min-width: 0 !important;
            font-size: 12px;
          }
          .datesheet-grid-table th,
          .datesheet-grid-table td { padding: 6px 8px !important; }
          tr { break-inside: avoid; }
        }
      `}</style>

      <div className="datesheet-picker-steps space-y-6">
      {/* Step 1: Course + auto-selected Core papers */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-lg font-bold text-foreground">1. Your course</h2>
        <p className="mt-1 text-sm text-muted">
          Pick your programme, course and semester — every Core (DSC) paper for it is added
          automatically since those are compulsory.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-muted">Programme</span>
            <select
              value={programmeSlug}
              onChange={(e) => {
                setProgrammeSlug(e.target.value);
                setSelectedCourse(ALL_COURSES);
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

          {courseOptions.length > 1 && (
            <label className="block">
              <span className="text-xs font-semibold text-muted">Course</span>
              <select
                value={selectedCourse}
                onChange={(e) => {
                  setSelectedCourse(e.target.value);
                  setCourseSemester(ALL_SEMESTERS);
                }}
                className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value={ALL_COURSES}>Choose course</option>
                {courseOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
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
                applyDscAutoSelect(programmeSlug, selectedCourse, nextSemester);
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
            manually. Searches across every datesheet at once, so it doesn&apos;t matter which
            file a paper actually lives in.
          </p>

          {/* Category pills — each elective category mostly lives in its
              own standalone file (AEC papers only in aec.json, GE only in
              ge.json, etc), so this searches allEntries (every programme
              file combined) rather than being scoped to one file. */}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setCategory(ALL_CATEGORIES);
                setElectiveCourse(ALL_COURSES);
              }}
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
                onClick={() => {
                  setCategory(c);
                  setElectiveCourse(ALL_COURSES);
                }}
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

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {electiveCourseOptions.length > 1 && (
              <label className="block">
                <span className="text-xs font-semibold text-muted">Course / subject</span>
                <select
                  value={electiveCourse}
                  onChange={(e) => setElectiveCourse(e.target.value)}
                  className="mt-1.5 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
                >
                  <option value={ALL_COURSES}>All courses</option>
                  {electiveCourseOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
            )}

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
                  const rowPdfHref = `/data/datesheet/source-pdfs/${e.sourceProgrammeSlug}.pdf`;
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
                          <span className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted">
                            {e.subject ? <span>{e.subject}</span> : null}
                            <span>Sem {e.semester ?? "—"}</span>
                            <span className="font-mono">{e.paperCode}</span>
                            <span>{formatDate(e.date, e.day)}</span>
                            <span>{e.startTime}</span>
                            <a
                              href={rowPdfHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(evt) => evt.stopPropagation()}
                              className="inline-flex items-center gap-1 font-semibold text-accent hover:underline"
                            >
                              <FilePdf size={12} weight="bold" />
                              Source
                            </a>
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
        </div>
      </div>
      </div>

      {/* Your personal datesheet — a real spreadsheet-style grid, not a
          card list, so it actually reads like a datesheet. This is the
          exact block that prints (see the @media print rule above): the
          grid the student sees on screen, stretched to the page, nothing
          re-authored separately for print. */}
      <div className="datesheet-grid-card rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Image src="/logo.png" alt="DU PYQ Online" width={36} height={20} className="h-5 w-auto" />
            <h2 className="text-lg font-bold text-foreground">Your datesheet</h2>
          </div>
          {selectedList.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="datesheet-grid-actions inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-foreground"
            >
              <Trash size={14} />
              Clear all
            </button>
          )}
        </div>
        <p className="datesheet-grid-actions mt-1 text-sm text-muted">
          Core papers from step 1 and electives you tick in step 2 both appear here as rows,
          sorted by exam date.
        </p>

        <div className="mt-4 flex items-center gap-1.5 text-sm text-muted">
          <CalendarBlank size={16} weight="bold" />
          {examSession} &middot; {selectedList.length} paper{selectedList.length === 1 ? "" : "s"} selected
        </div>

        {selectedList.length === 0 ? (
          <div className="mt-4 rounded-xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
            No papers selected yet. Choose your course above, then add electives above.
          </div>
        ) : (
          <div className="datesheet-grid-scroll mt-4 overflow-x-auto rounded-xl border border-border">
            <table className="datesheet-grid-table w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Paper</th>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Sem</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="datesheet-grid-actions px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {selectedList.map((e) => (
                  <tr key={rowKey(e)} className="border-b border-border last:border-0 hover:bg-accent-soft/40">
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {formatDate(e.date, e.day)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{e.startTime}</td>
                    <td className="px-4 py-3 text-foreground">
                      {e.subject ? <span className="text-muted">{e.subject} &middot; </span> : null}
                      {e.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{e.paperCode}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{e.semester ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                        {e.category}
                      </span>
                    </td>
                    <td className="datesheet-row-action whitespace-nowrap px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => toggle(e)}
                        className="text-xs font-semibold text-muted hover:text-red-600"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedList.length > 0 && (
          <button
            type="button"
            onClick={() => window.print()}
            className="datesheet-grid-actions mt-5 min-h-11 w-full rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover sm:w-auto"
          >
            Print / Save as PDF
          </button>
        )}
      </div>
    </div>
  );
}
