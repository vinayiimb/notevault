"use client";

import Link from "next/link";
import { ArrowRight, Check, FunnelSimple, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";

export type ArchivePaperData = {
  id: string;
  title: string;
  year: number | null;
  academicYear: string | null;
  pageCount: number | null;
  subject: {
    id: string;
    name: string;
    term: {
      id: string;
      name: string;
      order: number;
      program: { name: string; slug: string };
    };
  };
};

type ProgramGroup = {
  name: string;
  slug: string;
  papers: ArchivePaperData[];
  subjects: SubjectGroup[];
};

type SubjectGroup = {
  id: string;
  name: string;
  termName: string;
  termOrder: number;
  papers: ArchivePaperData[];
};

const ALL = "all";

function paperYear(paper: ArchivePaperData) {
  return paper.academicYear ?? (paper.year ? String(paper.year) : "Year not set");
}

function termKey(paper: ArchivePaperData) {
  return `${paper.subject.term.order}:${paper.subject.term.name}`;
}

function sortYears(a: string, b: string) {
  const aYear = Number(a.match(/\d{4}/)?.[0] ?? 0);
  const bYear = Number(b.match(/\d{4}/)?.[0] ?? 0);
  return bYear - aYear || b.localeCompare(a);
}

function subjectYearRange(subject: SubjectGroup) {
  const years = [...new Set(subject.papers.map(paperYear))].sort(sortYears);
  if (years.length === 1) return years[0];
  return `${years[years.length - 1]} to ${years[0]}`;
}

export function ArchiveBrowser({ papers }: { papers: ArchivePaperData[] }) {
  const [course, setCourse] = useState(ALL);
  const [semester, setSemester] = useState(ALL);
  const [year, setYear] = useState(ALL);

  const courses = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const paper of papers) {
      bySlug.set(paper.subject.term.program.slug, paper.subject.term.program.name);
    }
    return [...bySlug].sort((a, b) => a[1].localeCompare(b[1]));
  }, [papers]);

  const coursePapers = useMemo(
    () =>
      course === ALL
        ? papers
        : papers.filter((paper) => paper.subject.term.program.slug === course),
    [course, papers],
  );

  const semesterOptions = useMemo(() => {
    const terms = new Map<string, { name: string; order: number }>();
    for (const paper of coursePapers) {
      terms.set(termKey(paper), {
        name: paper.subject.term.name,
        order: paper.subject.term.order,
      });
    }
    return [...terms].sort((a, b) => a[1].order - b[1].order || a[1].name.localeCompare(b[1].name));
  }, [coursePapers]);

  const semesterPapers = useMemo(
    () =>
      semester === ALL
        ? coursePapers
        : coursePapers.filter((paper) => termKey(paper) === semester),
    [coursePapers, semester],
  );

  const yearOptions = useMemo(
    () => [...new Set(semesterPapers.map(paperYear))].sort(sortYears),
    [semesterPapers],
  );

  const filteredPapers = useMemo(
    () =>
      year === ALL
        ? semesterPapers
        : semesterPapers.filter((paper) => paperYear(paper) === year),
    [semesterPapers, year],
  );

  const showSubjectIndex = semester === ALL && year === ALL;

  const compactSemesterOptions = useMemo(
    () => [
      { value: ALL, label: "All", accessibleLabel: "All semesters" },
      ...semesterOptions.map(([value, term]) => ({
        value,
        label: term.order >= 1 && term.order <= 6 ? String(term.order) : term.name,
        accessibleLabel: term.name,
      })),
    ],
    [semesterOptions],
  );

  const programs = useMemo(() => {
    const groups = new Map<string, Omit<ProgramGroup, "subjects">>();
    for (const paper of filteredPapers) {
      const { name, slug } = paper.subject.term.program;
      const existing = groups.get(slug);
      if (existing) existing.papers.push(paper);
      else groups.set(slug, { name, slug, papers: [paper] });
    }

    return [...groups.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((program) => {
        const sortedPapers = program.papers.toSorted(
          (a, b) =>
            a.subject.term.order - b.subject.term.order ||
            a.subject.name.localeCompare(b.subject.name) ||
            sortYears(paperYear(a), paperYear(b)) ||
            a.title.localeCompare(b.title),
        );
        const subjects = new Map<string, SubjectGroup>();
        for (const paper of sortedPapers) {
          const existing = subjects.get(paper.subject.id);
          if (existing) existing.papers.push(paper);
          else {
            subjects.set(paper.subject.id, {
              id: paper.subject.id,
              name: paper.subject.name,
              termName: paper.subject.term.name,
              termOrder: paper.subject.term.order,
              papers: [paper],
            });
          }
        }

        return {
          ...program,
          papers: sortedPapers,
          subjects: [...subjects.values()].sort(
            (a, b) => a.termOrder - b.termOrder || a.name.localeCompare(b.name),
          ),
        };
      });
  }, [filteredPapers]);

  const visibleSubjectCount = programs.reduce((total, program) => total + program.subjects.length, 0);

  function selectCourse(nextCourse: string) {
    setCourse(nextCourse);
    setSemester(ALL);
    setYear(ALL);
  }

  function selectSemester(nextSemester: string) {
    setSemester(nextSemester);
    setYear(ALL);
  }

  function clearFilters() {
    setCourse(ALL);
    setSemester(ALL);
    setYear(ALL);
  }

  return (
    <>
      <section
        aria-labelledby="archive-filters-title"
        className="mt-10 rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FunnelSimple aria-hidden="true" size={18} weight="bold" />
          </span>
          <div>
            <h2 id="archive-filters-title" className="font-semibold">
              Find your question paper
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Every choice updates the archive immediately. You do not need to press Done.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.8fr)_minmax(180px,0.6fr)] lg:items-start">
          <div>
            <label htmlFor="archive-course" className="block text-sm font-semibold">
              1. Course
            </label>
            <select
              id="archive-course"
              value={course}
              onChange={(event) => selectCourse(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value={ALL}>All courses</option>
              {courses.map(([slug, name]) => (
                <option key={slug} value={slug}>
                  {name}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-muted">
              Selecting a course shows all of its available papers first.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">2. Semester</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {compactSemesterOptions.map(
                ({ value, label, accessibleLabel }) => (
                  <label key={value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="archive-semester"
                      value={value}
                      aria-label={accessibleLabel}
                      checked={semester === value}
                      onChange={() => selectSemester(value)}
                      className="peer sr-only"
                    />
                    <span className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl border border-border bg-background px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 peer-checked:border-accent peer-checked:bg-accent-soft peer-checked:text-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent">
                      <span className="flex size-4 items-center justify-center rounded border border-current" aria-hidden="true">
                        {semester === value ? <Check size={12} weight="bold" /> : null}
                      </span>
                      {label}
                    </span>
                  </label>
                ),
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">Choose directly—semester options are not hidden in a menu.</p>
          </fieldset>

          <div>
            <label htmlFor="archive-year" className="block text-sm font-semibold">
              3. Year
            </label>
            <select
              id="archive-year"
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value={ALL}>All years</option>
              {yearOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-muted">
              Choosing a semester shows its papers from all years first.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite" aria-atomic="true">
          {showSubjectIndex ? (
            <>
              Browsing <strong className="font-semibold text-foreground">{visibleSubjectCount}</strong> subject
              {visibleSubjectCount === 1 ? "" : "s"} across {programs.length} course
              {programs.length === 1 ? "" : "s"}.
            </>
          ) : (
            <>
              Showing <strong className="font-semibold text-foreground">{filteredPapers.length}</strong> paper
              {filteredPapers.length === 1 ? "" : "s"} across {programs.length} course
              {programs.length === 1 ? "" : "s"}.
            </>
          )}
        </p>
        {(course !== ALL || semester !== ALL || year !== ALL) && (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Clear all filters
          </button>
        )}
      </div>

      {programs.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
          <p className="font-semibold">No papers match these filters.</p>
          <p className="mt-2 text-sm text-muted">Try another semester or choose All years.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground outline-none transition hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Show the full archive
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-8">
          {programs.map((program) => (
            <section key={program.slug} aria-labelledby={`course-${program.slug}`} className="overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-4 sm:px-6">
                <div>
                  <h2 id={`course-${program.slug}`} className="flex items-center gap-2 text-lg font-semibold">
                    <GraduationCap aria-hidden="true" size={19} weight="bold" className="text-accent" />
                    {program.name}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {showSubjectIndex ? (
                      <>{program.subjects.length} subject{program.subjects.length === 1 ? "" : "s"}</>
                    ) : (
                      <>{program.papers.length} paper{program.papers.length === 1 ? "" : "s"}</>
                    )}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted">
                  {showSubjectIndex ? "Select a subject to open its latest paper" : "Select a subject to read the full paper"}
                </span>
              </div>

              {showSubjectIndex ? <SubjectIndexTable program={program} /> : <PaperTable papers={program.papers} />}
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function SubjectIndexTable({ program }: { program: ProgramGroup }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/35 text-xs text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Subject</th>
            <th scope="col" className="px-4 py-3 font-semibold">Semester</th>
            <th scope="col" className="px-4 py-3 font-semibold">Years available</th>
            <th scope="col" className="px-4 py-3 font-semibold">Papers</th>
            <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Open latest paper</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {program.subjects.map((subject) => {
            const latestPaper = subject.papers[0];
            return (
              <tr key={subject.id} className="transition-colors hover:bg-accent-soft/35 focus-within:bg-accent-soft/35">
                <th scope="row" className="px-5 py-4 font-medium sm:px-6">
                  <Link
                    href={`/pyq-notes/${latestPaper.id}`}
                    className="rounded-sm text-foreground outline-none transition hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {subject.name}
                    <span className="sr-only"> — open latest available paper</span>
                  </Link>
                </th>
                <td className="px-4 py-4 text-muted">{subject.termName}</td>
                <td className="px-4 py-4 text-muted">{subjectYearRange(subject)}</td>
                <td className="px-4 py-4 text-muted">{subject.papers.length}</td>
                <td className="px-4 py-4 text-right">
                  <Link
                    href={`/pyq-notes/${latestPaper.id}`}
                    aria-label={`Open latest ${subject.name} paper`}
                    className="inline-flex size-9 items-center justify-center rounded-lg text-muted outline-none transition hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    <ArrowRight aria-hidden="true" size={17} weight="bold" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PaperTable({ papers }: { papers: ArchivePaperData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/35 text-xs text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Subject</th>
            <th scope="col" className="px-4 py-3 font-semibold">Semester</th>
            <th scope="col" className="px-4 py-3 font-semibold">Academic year</th>
            <th scope="col" className="px-4 py-3 font-semibold">Paper</th>
            <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Open paper</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {papers.map((paper) => (
            <tr key={paper.id} className="transition-colors hover:bg-accent-soft/35 focus-within:bg-accent-soft/35">
              <th scope="row" className="px-5 py-4 font-medium sm:px-6">
                <Link
                  href={`/pyq-notes/${paper.id}`}
                  className="rounded-sm text-foreground outline-none transition hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {paper.subject.name}
                  <span className="sr-only"> — {paper.title}, {paperYear(paper)}</span>
                </Link>
              </th>
              <td className="px-4 py-4 text-muted">{paper.subject.term.name}</td>
              <td className="px-4 py-4 text-muted">{paperYear(paper)}</td>
              <td className="max-w-sm px-4 py-4 text-muted">
                <span className="line-clamp-2">{paper.title}</span>
                {paper.pageCount ? <span className="mt-1 block text-xs">{paper.pageCount} pages</span> : null}
              </td>
              <td className="px-4 py-4 text-right">
                <Link
                  href={`/pyq-notes/${paper.id}`}
                  aria-label={`Open full ${paper.subject.name} paper for ${paperYear(paper)}`}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted outline-none transition hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <ArrowRight aria-hidden="true" size={17} weight="bold" />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
