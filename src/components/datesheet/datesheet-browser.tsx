"use client";

import { useMemo, useState } from "react";
import { CalendarBlank, FilePdf } from "@phosphor-icons/react/dist/ssr";
import type { DatesheetEntry, DatesheetProgramme } from "@/lib/datesheet-types";

type Props = {
  programmes: DatesheetProgramme[];
  entriesByProgramme: Record<string, DatesheetEntry[]>;
  examSession: string;
};

const ALL_SEMESTERS = "all";
const ALL_SUBJECTS = "all";

function formatDate(iso: string, day: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const monthLabel = date.toLocaleDateString("en-IN", { month: "short" });
  return `${d} ${monthLabel} ${y} (${day})`;
}

export function DatesheetBrowser({ programmes, entriesByProgramme, examSession }: Props) {
  const [programmeSlug, setProgrammeSlug] = useState(programmes[0]?.slug ?? "");
  const [subject, setSubject] = useState<string>(ALL_SUBJECTS);
  const [semester, setSemester] = useState<string>(ALL_SEMESTERS);

  const entries = useMemo(
    () => entriesByProgramme[programmeSlug] ?? [],
    [entriesByProgramme, programmeSlug]
  );

  // Many source PDFs (B.A. Hons, B.Sc. Hons, DSE, GE…) bundle dozens of
  // distinct honours subjects into one file — e.g. B.Sc. (Hons) alone
  // covers Zoology, Botany, Chemistry, Physics… each with its own Core
  // papers. Surface a subject picker whenever a programme actually has
  // more than one named subject, so students aren't stuck scanning a
  // combined table for their one subject.
  const subjects = useMemo(() => {
    const set = new Set<string>();
    for (const e of entries) if (e.subject) set.add(e.subject);
    return Array.from(set).sort();
  }, [entries]);

  const semesters = useMemo(() => {
    const pool = subject === ALL_SUBJECTS ? entries : entries.filter((e) => e.subject === subject);
    const set = new Set<string>();
    for (const e of pool) if (e.semester) set.add(e.semester);
    return Array.from(set).sort((a, b) => Number(a) - Number(b));
  }, [entries, subject]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (subject !== ALL_SUBJECTS) rows = rows.filter((e) => e.subject === subject);
    if (semester !== ALL_SEMESTERS) rows = rows.filter((e) => e.semester === semester);
    return [...rows].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });
  }, [entries, subject, semester]);

  const currentProgramme = programmes.find((p) => p.slug === programmeSlug);
  const sourcePdfHref = `/data/datesheet/source-pdfs/${programmeSlug}.pdf`;

  return (
    <div>
      {/* Programme + semester pickers */}
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="block">
            <span className="text-sm font-semibold text-foreground">Programme / Course</span>
            <select
              value={programmeSlug}
              onChange={(e) => {
                setProgrammeSlug(e.target.value);
                setSubject(ALL_SUBJECTS);
                setSemester(ALL_SEMESTERS);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              {programmes.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>

          {subjects.length > 1 && (
            <label className="block">
              <span className="text-sm font-semibold text-foreground">Subject</span>
              <select
                value={subject}
                onChange={(e) => {
                  setSubject(e.target.value);
                  setSemester(ALL_SEMESTERS);
                }}
                className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              >
                <option value={ALL_SUBJECTS}>All subjects</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s}
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
            {examSession} &middot; {filtered.length} paper{filtered.length === 1 ? "" : "s"}
          </span>
          <a
            href={sourcePdfHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 font-semibold text-accent hover:underline"
          >
            <FilePdf size={16} weight="bold" />
            View official source PDF
          </a>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto rounded-2xl border border-border bg-surface">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted">
            No datesheet rows found for {currentProgramme?.label}
            {subject !== ALL_SUBJECTS ? ` — ${subject}` : ""}
            {semester !== ALL_SEMESTERS ? `, Semester ${semester}` : ""}. Check the source PDF above.
          </div>
        ) : (
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-left text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Time</th>
                <th className="px-4 py-3">Paper / Subject</th>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-4 text-xs text-muted">
        Datesheet is tentative and sourced from the official University of Delhi notification (
        {examSession}). Always cross-check dates on the linked source PDF before your exam.
      </p>
    </div>
  );
}
