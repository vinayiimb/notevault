"use client";

import {
  ArrowSquareOut,
  CaretDown,
  DownloadSimple,
  FunnelSimple,
  MagnifyingGlass,
  Star,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";
import { NO_SEMESTER, semesterLabel, type CatalogPaper } from "@/lib/pyq-catalog-types";
import {
  canonicalSubjectKey,
  preferredSubjectLabel,
} from "@/lib/subject-normalization";

type SessionGroup = {
  key: string;
  yearRange: string;
  semesterGroup: string;
  papers: CatalogPaper[];
};

type SubjectGroup = {
  key: string;
  course: string;
  subject: string;
  semesterLabel: string;
  sessions: SessionGroup[];
  paperCount: number;
  combinableCount: number;
  highlighted: boolean;
};

const ALL = "all";
const PAGE_SIZE = 80;

function sourceLabel(paper: CatalogPaper) {
  if (paper.source === "notevault") return "Read online";
  if (paper.source === "drive") return "Google Drive PDF";
  if (paper.source === "upload") return "NoteVault upload";
  return null;
}

function semesterSortKey(label: string) {
  if (label === NO_SEMESTER) return 99;
  return Number(label.match(/\d+/)?.[0] ?? 99);
}

function yearStart(value: string) {
  return Number(value.match(/\d{4}/)?.[0] ?? 0);
}

function fileName(paper: CatalogPaper) {
  if (paper.fileName) return paper.fileName;
  const tail = paper.pdfUrl.split("/").pop() ?? "Question paper.pdf";
  try {
    return decodeURIComponent(tail).replace(/_/g, " ");
  } catch {
    return tail.replace(/_/g, " ");
  }
}

function sortPapers(a: CatalogPaper, b: CatalogPaper) {
  return (
    yearStart(b.yearRange) - yearStart(a.yearRange) ||
    b.semesterGroup.localeCompare(a.semesterGroup) ||
    (Number(a.semester) || 99) - (Number(b.semester) || 99) ||
    fileName(a).localeCompare(fileName(b))
  );
}

function buildGroups(papers: CatalogPaper[]) {
  const subjects = new Map<
    string,
    {
      course: string;
      subject: string;
      semesterLabel: string;
      sessions: Map<string, SessionGroup>;
      paperCount: number;
      combinableCount: number;
      highlighted: boolean;
    }
  >();

  for (const paper of papers) {
    const semLabel = semesterLabel(paper);
    const subjectKey = `${paper.course}\u0000${semLabel}\u0000${canonicalSubjectKey(paper.subject)}`;
    let subject = subjects.get(subjectKey);
    if (!subject) {
      subject = {
        course: paper.course,
        subject: paper.subject,
        semesterLabel: semLabel,
        sessions: new Map(),
        paperCount: 0,
        combinableCount: 0,
        highlighted: false,
      };
      subjects.set(subjectKey, subject);
    } else {
      subject.subject = preferredSubjectLabel([
        subject.subject,
        paper.subject,
      ]);
    }
    if (paper.highlighted) subject.highlighted = true;

    const sessionKey = `${paper.yearRange}\u0000${paper.semesterGroup}`;
    const session = subject.sessions.get(sessionKey);
    if (session) session.papers.push(paper);
    else {
      subject.sessions.set(sessionKey, {
        key: sessionKey,
        yearRange: paper.yearRange,
        semesterGroup: paper.semesterGroup,
        papers: [paper],
      });
    }
    subject.paperCount += 1;
    // Matches the exclusion in /api/catalog-combined-pdf: "notevault" (read
    // online) rows have no backing PDF file, so they can never be part of a
    // merge — this only counts papers the combine endpoint could actually use.
    if (paper.source !== "notevault") subject.combinableCount += 1;
  }

  return [...subjects.entries()]
    .map(
      ([key, subject]): SubjectGroup => ({
        key,
        course: subject.course,
        subject: subject.subject,
        semesterLabel: subject.semesterLabel,
        paperCount: subject.paperCount,
        combinableCount: subject.combinableCount,
        highlighted: subject.highlighted,
        sessions: [...subject.sessions.values()]
          .map((session) => ({ ...session, papers: session.papers.toSorted(sortPapers) }))
          .sort(
            (a, b) =>
              yearStart(b.yearRange) - yearStart(a.yearRange) ||
              b.semesterGroup.localeCompare(a.semesterGroup),
          ),
      }),
    )
    .sort(
      (a, b) =>
        a.course.localeCompare(b.course) ||
        semesterSortKey(a.semesterLabel) - semesterSortKey(b.semesterLabel) ||
        a.subject.localeCompare(b.subject),
    );
}

function groupByCourse(groups: SubjectGroup[]) {
  const courses = new Map<string, SubjectGroup[]>();
  for (const group of groups) {
    const existing = courses.get(group.course);
    if (existing) existing.push(group);
    else courses.set(group.course, [group]);
  }
  return [...courses.entries()];
}

function groupBySemester(groups: SubjectGroup[]) {
  const semesters = new Map<string, SubjectGroup[]>();
  for (const group of groups) {
    const existing = semesters.get(group.semesterLabel);
    if (existing) existing.push(group);
    else semesters.set(group.semesterLabel, [group]);
  }
  return [...semesters.entries()].sort(
    (a, b) => semesterSortKey(a[0]) - semesterSortKey(b[0]),
  );
}

export function CatalogArchiveBrowser({ papers }: { papers: CatalogPaper[] }) {
  const [course, setCourse] = useState(ALL);
  const [session, setSession] = useState(ALL);
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  // Subjects render as a collapsed list — a subject's sessions/papers only
  // appear once its row is clicked, so picking a course surfaces every
  // matching subject on the same page without dumping every session and
  // paper for all of them at once.
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggleExpanded(key: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const courses = useMemo(
    () => [...new Set(papers.map((paper) => paper.course))].sort((a, b) => a.localeCompare(b)),
    [papers],
  );
  const sessions = useMemo(
    () =>
      [...new Set(papers.map((paper) => paper.yearRange))].sort(
        (a, b) => yearStart(b) - yearStart(a) || b.localeCompare(a),
      ),
    [papers],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return papers.filter(
      (paper) =>
        (course === ALL || paper.course === course) &&
        (session === ALL || paper.yearRange === session) &&
        (!query ||
          paper.subject.toLocaleLowerCase().includes(query) ||
          paper.course.toLocaleLowerCase().includes(query) ||
          (paper.note ?? "").toLocaleLowerCase().includes(query)),
    );
  }, [course, papers, search, session]);
  const groups = useMemo(() => buildGroups(filtered), [filtered]);
  const visibleGroups = groups.slice(0, visibleCount);

  function clearFilters() {
    setCourse(ALL);
    setSession(ALL);
    setSearch("");
    setVisibleCount(PAGE_SIZE);
    setExpanded(new Set());
  }

  const hasFilters = course !== ALL || session !== ALL || search.trim().length > 0;

  return (
    <>
      <section
        aria-labelledby="catalog-filters-title"
        className="mt-10 rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FunnelSimple aria-hidden="true" size={18} weight="bold" />
          </span>
          <div>
            <h2 id="catalog-filters-title" className="font-semibold">
              Find a paper or study file
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Filter the official catalog, session papers, and course study collections together.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(220px,0.8fr)_minmax(0,1.4fr)_minmax(210px,0.8fr)]">
          <div>
            <label htmlFor="catalog-course" className="block text-sm font-semibold">
              Course
            </label>
            <select
              id="catalog-course"
              value={course}
              onChange={(event) => {
                setCourse(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value={ALL}>All {courses.length} course categories</option>
              {courses.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="catalog-search" className="block text-sm font-semibold">
              Search subject
            </label>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <MagnifyingGlass aria-hidden="true" size={16} className="shrink-0 text-muted" />
              <input
                id="catalog-search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setVisibleCount(PAGE_SIZE);
                }}
                placeholder="e.g. Corporate Accounting"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </span>
          </div>

          <div>
            <label htmlFor="catalog-session" className="block text-sm font-semibold">
              Session / collection
            </label>
            <select
              id="catalog-session"
              value={session}
              onChange={(event) => {
                setSession(event.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            >
              <option value={ALL}>All sessions</option>
              {sessions.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted" aria-live="polite" aria-atomic="true">
          Showing <strong className="font-semibold text-foreground">{filtered.length}</strong> file
          {filtered.length === 1 ? "" : "s"} across{" "}
          <strong className="font-semibold text-foreground">{groups.length}</strong> subject
          {groups.length === 1 ? "" : "s"}
          {course !== ALL ? (
            <>
              {" "}
              for <strong className="font-semibold text-foreground">{course}</strong>
            </>
          ) : null}
          .
        </p>
        {hasFilters ? (
          <button
            type="button"
            onClick={clearFilters}
            className="min-h-11 rounded-xl px-3 text-sm font-semibold text-accent outline-none hover:bg-accent-soft focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Clear all filters
          </button>
        ) : null}
      </div>

      <div className="mt-5 grid gap-2 rounded-2xl border border-border bg-surface p-4 text-sm sm:grid-cols-3">
        <p><strong className="text-accent">1.</strong> Choose a course</p>
        <p><strong className="text-accent">2.</strong> Open a subject and year</p>
        <p><strong className="text-accent">3.</strong> Open the final PDF</p>
      </div>

      {groups.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
          <p className="font-semibold">No files match these filters.</p>
          <p className="mt-2 text-sm text-muted">Try another spelling, course, or session.</p>
          <button
            type="button"
            onClick={clearFilters}
            className="mt-5 min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Show the full archive
          </button>
        </div>
      ) : course === ALL ? (
        <section aria-label="Archive results" className="mt-6 space-y-6">
          {groupByCourse(visibleGroups).map(([courseName, courseGroups]) => (
            <section
              key={courseName}
              aria-labelledby={`course-${courseName.replace(/[^a-z0-9]+/gi, "-")}`}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <header className="border-b border-border bg-accent-soft px-5 py-4 sm:px-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-accent">Course</p>
                <h2 id={`course-${courseName.replace(/[^a-z0-9]+/gi, "-")}`} className="mt-1 text-xl font-semibold text-foreground">
                  {courseName}
                </h2>
              </header>
              <SemesterGroupedList groups={courseGroups} expanded={expanded} onToggle={toggleExpanded} />
            </section>
          ))}
        </section>
      ) : (
        <section
          aria-label={`Subjects for ${course}`}
          className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface"
        >
          <SemesterGroupedList groups={visibleGroups} expanded={expanded} onToggle={toggleExpanded} />
        </section>
      )}

      {visibleCount < groups.length ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <p className="text-sm text-muted">
            {visibleGroups.length} of {groups.length} subject groups loaded
          </p>
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}
            className="min-h-11 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground hover:bg-accent-hover"
          >
            Show {Math.min(PAGE_SIZE, groups.length - visibleCount)} more
          </button>
          <button
            type="button"
            onClick={() => setVisibleCount(groups.length)}
            className="min-h-11 rounded-xl px-4 py-2 text-sm font-semibold text-accent hover:bg-accent-soft"
          >
            Show all
          </button>
        </div>
      ) : null}

      <aside className="mt-10 rounded-2xl bg-yellow-soft p-5 text-sm leading-6 text-foreground sm:p-6">
        <div className="flex items-start gap-3">
          <WarningCircle aria-hidden="true" size={20} weight="fill" className="mt-0.5 shrink-0 text-warning" />
          <div>
            <h2 className="font-semibold">About the source labels</h2>
            <p className="mt-1 max-w-3xl text-muted">
              The college library labels one source folder “2023-2025”; it appears to contain more than
              one academic-year sitting, so NoteVault preserves that label instead of presenting it as a
              single clean session. Subject spelling variants and source typos were consolidated during
              catalog cleaning; source notes such as “Old Course” and set numbers remain attached to the
              relevant files.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

// Splits a course's subjects into "Semester 1", "Semester 2", ... sections
// before handing each slice to SubjectList — without this, a course with
// 70+ subjects renders as one long alphabetical list with no way to tell
// which semester a subject belongs to.
function SemesterGroupedList({
  groups,
  expanded,
  onToggle,
}: {
  groups: SubjectGroup[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {
  return (
    <div className="divide-y divide-border">
      {groupBySemester(groups).map(([semLabel, semGroups]) => (
        <div key={semLabel}>
          <div className="bg-surface-muted px-5 py-2.5 sm:px-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">
              {semLabel}
            </p>
          </div>
          <SubjectList groups={semGroups} expanded={expanded} onToggle={onToggle} />
        </div>
      ))}
    </div>
  );
}

// A real <a href> to a GET route, not a fetch+blob+createObjectURL dance —
// letting the browser's own download handling take over is far more
// reliable across mobile browsers (blob-URL downloads are flaky on some
// mobile Safari versions). target="_blank" so a merge failure (the route
// returns a JSON error, not a PDF, when every source file is unreachable)
// opens in a new tab instead of navigating the user away from the archive.
function combinedDownloadHref(group: SubjectGroup) {
  const params = new URLSearchParams({
    course: group.course,
    subject: group.subject,
    semesterLabel: group.semesterLabel,
  });
  return `/api/catalog-combined-pdf?${params.toString()}`;
}

function SubjectList({
  groups,
  expanded,
  onToggle,
}: {
  groups: SubjectGroup[];
  expanded: Set<string>;
  onToggle: (key: string) => void;
}) {

  return (
    <div className="divide-y divide-border">
      {groups.map((group) => {
        const isOpen = expanded.has(group.key);
        return (
          <article key={group.key}>
            <button
              type="button"
              onClick={() => onToggle(group.key)}
              aria-expanded={isOpen}
              className={`flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-surface-muted/60 sm:px-6 ${
                group.highlighted ? "bg-yellow-soft/60 hover:bg-yellow-soft" : ""
              }`}
            >
              <span>
                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                  {group.highlighted && (
                    <Star aria-label="Highlighted" size={14} weight="fill" className="shrink-0 text-warning" />
                  )}
                  {group.subject}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {group.paperCount} file{group.paperCount === 1 ? "" : "s"} · {group.sessions.length} session
                  {group.sessions.length === 1 ? "" : "s"}
                  {group.combinableCount > 1 && (
                    <span title="Every year can be downloaded as one combined PDF"> · ⭐ combinable</span>
                  )}
                </span>
              </span>
              <CaretDown
                aria-hidden="true"
                size={16}
                weight="bold"
                className={`shrink-0 text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="divide-y divide-border border-t border-border bg-surface-muted/40">
                {group.combinableCount > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 sm:px-6">
                    <p className="text-xs text-muted">
                      Download every year for {group.subject} as one combined PDF.
                    </p>
                    <a
                      href={combinedDownloadHref(group)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground outline-none hover:bg-accent-hover"
                    >
                      <DownloadSimple aria-hidden="true" size={15} weight="bold" />
                      Download all combined
                    </a>
                  </div>
                )}
                {group.sessions.map((sessionGroup) => (
                  <div
                    key={sessionGroup.key}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[minmax(180px,0.7fr)_minmax(0,1.3fr)] sm:px-6"
                  >
                    <div>
                      <p className="text-sm font-medium">{sessionGroup.yearRange}</p>
                      <p className="mt-0.5 text-xs text-muted">Semesters {sessionGroup.semesterGroup}</p>
                    </div>
                    <div className="flex flex-wrap gap-2 sm:justify-end">
                      {sessionGroup.papers.map((paper, index) => {
                        const multiple = sessionGroup.papers.length > 1;
                        const label = multiple ? `Option ${index + 1}` : "Open final PDF";
                        const origin = sourceLabel(paper);
                        return (
                          <a
                            key={paper.id}
                            href={paper.pdfUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={`${fileName(paper)}${paper.note ? ` — ${paper.note}` : ""}`}
                            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm font-semibold text-foreground outline-none hover:border-accent hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                          >
                            {label}
                            {origin || paper.note ? (
                              <span className="max-w-32 truncate text-xs font-normal text-muted">{origin ?? paper.note}</span>
                            ) : null}
                            <ArrowSquareOut aria-hidden="true" size={15} weight="bold" />
                          </a>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}
