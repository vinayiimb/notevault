"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, FunnelSimple, GraduationCap } from "@phosphor-icons/react/dist/ssr";
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
};

type DirectorySemester = {
  key: string;
  name: string;
  order: number;
};

type DirectorySubject = {
  key: string;
  courseName: string;
  courseSlug: string;
  name: string;
  papers: ArchivePaperData[];
  semesters: DirectorySemester[];
};

const ALL = "all";
const DIRECTORY_SEMESTERS = [1, 2, 3, 4, 5, 6];

function paperYear(paper: ArchivePaperData) {
  return paper.academicYear ?? (paper.year ? String(paper.year) : "Year not set");
}

function termKey(paper: ArchivePaperData) {
  return `${paper.subject.term.order}:${paper.subject.term.name}`;
}

function subjectKey(paper: ArchivePaperData) {
  return `${paper.subject.term.program.slug}:${paper.subject.name.trim().toLocaleLowerCase()}`;
}

function sortYears(a: string, b: string) {
  const aYear = Number(a.match(/\d{4}/)?.[0] ?? 0);
  const bYear = Number(b.match(/\d{4}/)?.[0] ?? 0);
  return bYear - aYear || b.localeCompare(a);
}

function sortPapers(a: ArchivePaperData, b: ArchivePaperData) {
  return (
    a.subject.term.order - b.subject.term.order ||
    a.subject.name.localeCompare(b.subject.name) ||
    sortYears(paperYear(a), paperYear(b)) ||
    a.title.localeCompare(b.title)
  );
}

export function ArchiveBrowser({ papers }: { papers: ArchivePaperData[] }) {
  const [course, setCourse] = useState(ALL);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
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

  const directorySubjects = useMemo(() => {
    const groups = new Map<
      string,
      Omit<DirectorySubject, "semesters"> & { semesterMap: Map<string, DirectorySemester> }
    >();

    for (const paper of coursePapers) {
      const key = subjectKey(paper);
      const existing = groups.get(key);
      const semesterOption = {
        key: termKey(paper),
        name: paper.subject.term.name,
        order: paper.subject.term.order,
      };

      if (existing) {
        existing.papers.push(paper);
        existing.semesterMap.set(semesterOption.key, semesterOption);
      } else {
        groups.set(key, {
          key,
          courseName: paper.subject.term.program.name,
          courseSlug: paper.subject.term.program.slug,
          name: paper.subject.name,
          papers: [paper],
          semesterMap: new Map([[semesterOption.key, semesterOption]]),
        });
      }
    }

    return [...groups.values()]
      .map(({ semesterMap, ...subject }) => ({
        ...subject,
        papers: subject.papers.toSorted(sortPapers),
        semesters: [...semesterMap.values()].sort(
          (a, b) => a.order - b.order || a.name.localeCompare(b.name),
        ),
      }))
      .sort(
        (a, b) =>
          a.courseName.localeCompare(b.courseName) || a.name.localeCompare(b.name),
      );
  }, [coursePapers]);

  const subjectPapers = useMemo(
    () =>
      selectedSubjectKey
        ? coursePapers.filter((paper) => subjectKey(paper) === selectedSubjectKey)
        : coursePapers,
    [coursePapers, selectedSubjectKey],
  );

  const semesterOptions = useMemo(() => {
    const terms = new Map<string, { name: string; order: number }>();
    for (const paper of subjectPapers) {
      terms.set(termKey(paper), {
        name: paper.subject.term.name,
        order: paper.subject.term.order,
      });
    }
    return [...terms].sort(
      (a, b) => a[1].order - b[1].order || a[1].name.localeCompare(b[1].name),
    );
  }, [subjectPapers]);

  const semesterPapers = useMemo(
    () =>
      semester === ALL
        ? subjectPapers
        : subjectPapers.filter((paper) => termKey(paper) === semester),
    [semester, subjectPapers],
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
    const groups = new Map<string, ProgramGroup>();
    for (const paper of filteredPapers) {
      const { name, slug } = paper.subject.term.program;
      const existing = groups.get(slug);
      if (existing) existing.papers.push(paper);
      else groups.set(slug, { name, slug, papers: [paper] });
    }

    return [...groups.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((program) => ({ ...program, papers: program.papers.toSorted(sortPapers) }));
  }, [filteredPapers]);

  const selectedSubjectName = selectedSubjectKey
    ? coursePapers.find((paper) => subjectKey(paper) === selectedSubjectKey)?.subject.name
    : undefined;
  const showSubjectDirectory = !selectedSubjectKey && semester === ALL && year === ALL;
  const directoryCourseCount = new Set(
    directorySubjects.map((subject) => subject.courseSlug),
  ).size;

  function selectCourse(nextCourse: string) {
    setCourse(nextCourse);
    setSelectedSubjectKey("");
    setSemester(ALL);
    setYear(ALL);
  }

  function selectSemester(nextSemester: string) {
    setSemester(nextSemester);
    setYear(ALL);
  }

  function openSubject(subject: DirectorySubject, nextSemester = ALL) {
    setCourse(subject.courseSlug);
    setSelectedSubjectKey(subject.key);
    setSemester(nextSemester);
    setYear(ALL);
  }

  function backToSubjectList() {
    setSelectedSubjectKey("");
    setSemester(ALL);
    setYear(ALL);
  }

  function clearFilters() {
    setCourse(ALL);
    setSelectedSubjectKey("");
    setSemester(ALL);
    setYear(ALL);
  }

  const hasResults = showSubjectDirectory ? directorySubjects.length > 0 : programs.length > 0;

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
              Choose from the filters or use a subject row below. Every choice updates immediately.
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
              Select a course to shorten the subject table.
            </p>
          </div>

          <fieldset>
            <legend className="text-sm font-semibold">2. Semester</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {compactSemesterOptions.map(({ value, label, accessibleLabel }) => (
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
                    <span
                      className="flex size-4 items-center justify-center rounded border border-current"
                      aria-hidden="true"
                    >
                      {semester === value ? <Check size={12} weight="bold" /> : null}
                    </span>
                    {label}
                  </span>
                </label>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted">
              A semester selection always starts with all years.
            </p>
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
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite" aria-atomic="true">
          {showSubjectDirectory ? (
            <>
              Browsing <strong className="font-semibold text-foreground">{directorySubjects.length}</strong>{" "}
              subject{directorySubjects.length === 1 ? "" : "s"} across {directoryCourseCount} course
              {directoryCourseCount === 1 ? "" : "s"}.
            </>
          ) : (
            <>
              Showing <strong className="font-semibold text-foreground">{filteredPapers.length}</strong> paper
              {filteredPapers.length === 1 ? "" : "s"}
              {selectedSubjectName ? <> for <strong className="font-semibold text-foreground">{selectedSubjectName}</strong></> : null}.
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {selectedSubjectKey ? (
            <button
              type="button"
              onClick={backToSubjectList}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-foreground outline-none transition hover:bg-surface-muted focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              <ArrowLeft aria-hidden="true" size={16} weight="bold" /> Back to subject list
            </button>
          ) : null}
          {(course !== ALL || selectedSubjectKey || semester !== ALL || year !== ALL) && (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 rounded-xl px-3 text-sm font-semibold text-accent outline-none transition hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {!hasResults ? (
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
      ) : showSubjectDirectory ? (
        <SubjectDirectoryTable subjects={directorySubjects} onOpenSubject={openSubject} />
      ) : (
        <div className="mt-6 space-y-8">
          {programs.map((program) => (
            <section
              key={program.slug}
              aria-labelledby={`course-${program.slug}`}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-4 sm:px-6">
                <div>
                  <h2 id={`course-${program.slug}`} className="flex items-center gap-2 text-lg font-semibold">
                    <GraduationCap aria-hidden="true" size={19} weight="bold" className="text-accent" />
                    {program.name}
                    {selectedSubjectName ? <span className="text-muted">· {selectedSubjectName}</span> : null}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {program.papers.length} paper{program.papers.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted">Select a paper to read its full OCR</span>
              </div>
              <PaperTable papers={program.papers} />
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function SubjectDirectoryTable({
  subjects,
  onOpenSubject,
}: {
  subjects: DirectorySubject[];
  onOpenSubject: (subject: DirectorySubject, semester?: string) => void;
}) {
  return (
    <section aria-labelledby="subject-directory-title" className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-4 sm:px-6">
        <div>
          <h2 id="subject-directory-title" className="text-lg font-semibold">Subject directory</h2>
          <p className="mt-1 text-sm text-muted">One row per subject across all available years.</p>
        </div>
        <span className="text-xs font-medium text-muted">Select the subject for all semesters, or choose 1–6</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-surface-muted/35 text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Course</th>
              <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
              <th scope="col" className="px-4 py-3 font-semibold">Semester</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {subjects.map((subject) => (
              <tr key={subject.key} className="relative transition-colors hover:bg-accent-soft/35 focus-within:bg-accent-soft/35">
                <td className="max-w-64 px-5 py-4 text-muted sm:px-6">{subject.courseName}</td>
                <th scope="row" className="px-4 py-4 font-medium">
                  <button
                    type="button"
                    onClick={() => onOpenSubject(subject)}
                    className="inline-flex min-h-9 items-center gap-2 rounded-lg text-left font-semibold text-foreground outline-none transition before:absolute before:inset-0 before:content-[''] hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                  >
                    {subject.name}
                    <ArrowRight aria-hidden="true" size={15} weight="bold" className="shrink-0 text-muted" />
                  </button>
                </th>
                <td className="px-4 py-3">
                  <div className="relative z-10 flex items-center gap-1.5" aria-label={`Available semesters for ${subject.name}`}>
                    {DIRECTORY_SEMESTERS.map((semesterNumber) => {
                      const option = subject.semesters.find((item) => item.order === semesterNumber);
                      return (
                        <button
                          key={semesterNumber}
                          type="button"
                          disabled={!option}
                          onClick={() => option && onOpenSubject(subject, option.key)}
                          aria-label={
                            option
                              ? `Open ${subject.name}, semester ${semesterNumber}, all years`
                              : `${subject.name} has no semester ${semesterNumber} papers`
                          }
                          className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold text-foreground outline-none transition hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted/45 disabled:hover:border-border"
                        >
                          {semesterNumber}
                        </button>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
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
