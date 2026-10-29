"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, CircleNotch, FilePdf } from "@phosphor-icons/react/dist/ssr";
import type { DatesheetEntry, DatesheetGroup, DatesheetProgramme } from "@/lib/datesheet-types";
import { compareByDateTime } from "@/lib/datesheet-types";
import { fetchProgrammeEntries } from "@/lib/datesheet-fetch-client";

type Props = {
  programmes: DatesheetProgramme[];
  examSession: string;
};

const ALL_SEMESTERS = "all";
const ALL_COURSES = "all";

// NEP is what most students sit and is the default; SOL and CBCS are the other
// two sections of DU's own datesheet page.
const GROUPS: { id: DatesheetGroup; label: string; hint: string }[] = [
  { id: "nep", label: "NEP", hint: "NEP-UGCF-2022 \u00b7 regular students of colleges" },
  { id: "sol", label: "SOL", hint: "School of Open Learning \u00b7 NEP and CBCS sheets" },
  { id: "cbcs", label: "CBCS", hint: "CBCS-LOCF \u00b7 2020 & 2021 admissions \u00b7 North and South Campus" },
];

function formatDate(iso: string, day: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const monthLabel = date.toLocaleDateString("en-IN", { month: "short" });
  return `${d} ${monthLabel} ${y} (${day})`;
}

export function DatesheetBrowser({ programmes, examSession }: Props) {
  const [group, setGroup] = useState<DatesheetGroup>("nep");
  const [programmeSlug, setProgrammeSlug] = useState(
    (programmes.find((p) => p.group === "nep") ?? programmes[0])?.slug ?? ""
  );
  const [course, setCourse] = useState<string>(ALL_COURSES);
  const [semester, setSemester] = useState<string>(ALL_SEMESTERS);
  const [entries, setEntries] = useState<DatesheetEntry[]>([]);
  // Tracks which programme the current `entries` actually belong to, so
  // "loading" is a derived comparison (loadedSlug !== programmeSlug)
  // rather than a setState called synchronously inside the effect body —
  // the effect only ever calls setState from its async .then()/.finally(),
  // which is the pattern react-hooks/set-state-in-effect wants.
  const [loadedSlug, setLoadedSlug] = useState<string | null>(null);
  const loading = loadedSlug !== programmeSlug;

  // Each programme's rows are fetched on demand (from the static JSON at
  // /data/datesheet/<slug>.json) instead of the server shipping all 19
  // files (6.7MB combined) up front — that was slow enough on mobile data
  // to look like the page had crashed.
  useEffect(() => {
    if (!programmeSlug) return;
    let cancelled = false;
    fetchProgrammeEntries(programmeSlug)
      .then((data) => {
        if (cancelled) return;
        setEntries(data);
        setLoadedSlug(programmeSlug);
      })
      .catch(() => {
        if (cancelled) return;
        setEntries([]);
        setLoadedSlug(programmeSlug);
      });
    return () => {
      cancelled = true;
    };
  }, [programmeSlug]);

  // Many source PDFs (B.A. Hons, B.Sc. Hons, DSE, GE…) bundle dozens of
  // distinct honours courses into one file — e.g. B.Sc. (Hons) alone
  // covers Zoology, Botany, Chemistry, Physics… each with its own Core
  // papers, same as B.A. (Hons) covers Political Science, History,
  // English… Surface a Course picker whenever a programme actually has
  // more than one, so students aren't stuck scanning a combined table.
  const courses = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.subject) set.add(e.subject);
    return Array.from(set).sort();
  }, [entries]);

  // Repeating the subject that nearly every row carries (B.Com (Prog) is all "Commerce")
  // adds nothing, so the prefix is dropped for that dominant subject only.
  const commonSubject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) if (e.subject) counts.set(e.subject, (counts.get(e.subject) ?? 0) + 1);
    const [top, n] = [...counts].sort((a, b) => b[1] - a[1])[0] ?? ["", 0];
    return n >= entries.length * 0.8 ? top : "";
  }, [entries]);
  const showSubject = (e: DatesheetEntry) => Boolean(e.subject) && e.subject !== commonSubject;

  const semesters = useMemo(() => {
    const pool = course === ALL_COURSES ? entries : entries.filter((e) => e.subject === course);
    const set = new Set<string>();
    for (const e of pool) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [entries, course]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (course !== ALL_COURSES) rows = rows.filter((e) => e.subject === course);
    if (semester !== ALL_SEMESTERS) rows = rows.filter((e) => e.semester === semester);
    return [...rows].sort(compareByDateTime);
  }, [entries, course, semester]);

  const groupProgrammes = useMemo(() => programmes.filter((p) => p.group === group), [programmes, group]);
  const currentProgramme = programmes.find((p) => p.slug === programmeSlug);

  function pickGroup(next: DatesheetGroup) {
    if (next === group) return;
    setGroup(next);
    setProgrammeSlug(programmes.find((p) => p.group === next)?.slug ?? "");
    setCourse(ALL_COURSES);
    setSemester(ALL_SEMESTERS);
  }

  return (
    <div>
      {/* Programme + course + semester pickers */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div role="group" aria-label="Datesheet type" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background p-1 sm:inline-grid sm:w-96">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id}
              onClick={() => pickGroup(g.id)}
              className={`min-h-11 rounded-lg px-4 text-sm font-semibold transition ${
                group === g.id ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">{GROUPS.find((g) => g.id === group)?.hint}</p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Programme</span>
            <select
              value={programmeSlug}
              onChange={(e) => {
                setProgrammeSlug(e.target.value);
                setCourse(ALL_COURSES);
                setSemester(ALL_SEMESTERS);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {groupProgrammes.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {courses.length > 1 && (
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Course</span>
              <select
                value={course}
                onChange={(e) => {
                  setCourse(e.target.value);
                  setSemester(ALL_SEMESTERS);
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value={ALL_COURSES}>All courses</option>
                {courses.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="block">
            <span className="text-sm font-semibold text-foreground">Semester</span>
            <select
              value={semester}
              onChange={(e) => setSemester(e.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
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

        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlank size={16} weight="bold" />
            {examSession} &middot; {loading ? "loading…" : `${filtered.length} paper${filtered.length === 1 ? "" : "s"}`}
          </span>
          {currentProgramme?.sourceUrl ? (
            <a
              href={currentProgramme.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-sky-dark hover:underline"
            >
              <FilePdf size={16} weight="bold" />
              Official DU PDF
            </a>
          ) : null}
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface p-10 text-sm text-muted">
          <CircleNotch size={18} className="animate-spin" />
          Loading datesheet…
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-8 text-center text-sm text-muted">
          No datesheet rows found for {currentProgramme?.label}
          {course !== ALL_COURSES ? ` — ${course}` : ""}
          {semester !== ALL_SEMESTERS ? `, Semester ${semester}` : ""}. Check the official PDF above.
        </div>
      ) : (
        <>
          {/* Mobile: one card per paper — a 6-column table has no room on a
              phone screen without cutting columns off or truncating text
              mid-word, so below `sm` we show a stacked card instead. */}
          <ul className="mt-6 space-y-3 sm:hidden">
            {filtered.map((e, i) => (
              <li key={`${e.paperCode}-${i}`} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{formatDate(e.date, e.day)}</p>
                    <p className="text-xs text-muted">{e.startTime}</p>
                  </div>
                  {e.category !== "OTHER" ? (
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                      {e.category}
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-sm text-foreground">
                  {showSubject(e) ? <span className="text-muted">{e.subject} &middot; </span> : null}
                  {e.description}
                </p>
                <p className="mt-1 text-xs text-muted">
                  Sem {e.semester ?? "—"} &middot; <span className="font-mono">{e.paperCode}</span>
                </p>
              </li>
            ))}
          </ul>

          {/* Desktop/tablet: full table */}
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-border bg-surface sm:block">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Paper / Course</th>
                  <th className="px-4 py-3">Paper Code</th>
                  <th className="px-4 py-3">Sem</th>
                  <th className="px-4 py-3">Category</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <tr
                    key={`${e.paperCode}-${i}`}
                    className="border-b border-border last:border-0 hover:bg-accent-soft/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 font-medium text-foreground">
                      {formatDate(e.date, e.day)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{e.startTime}</td>
                    <td className="px-4 py-3 text-foreground">
                      {showSubject(e) ? <span className="text-muted">{e.subject} &middot; </span> : null}
                      {e.description}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-muted">{e.paperCode}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{e.semester ?? "—"}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {e.category !== "OTHER" ? (
                        <span className="inline-flex rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent">
                          {e.category}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-4 text-xs text-muted">
        Datesheet is tentative and sourced from the official University of Delhi notification (
        {examSession}). Always cross-check dates on the linked official PDF before your exam.
      </p>
    </div>
  );
}
