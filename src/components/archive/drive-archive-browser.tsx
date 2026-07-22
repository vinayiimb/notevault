"use client";

import {
  ArrowLeft,
  ArrowRight,
  ArrowSquareOut,
  Check,
  FunnelSimple,
  GraduationCap,
  MagnifyingGlass,
} from "@phosphor-icons/react/dist/ssr";
import { useMemo, useState } from "react";

export type DriveArchiveFileData = {
  id: string;
  fileName: string;
  year: number | null;
  webViewLink: string;
  driveSubject: {
    id: string;
    name: string;
    program: { name: string; slug: string };
  };
  link: {
    variantLabel: string;
    session: { id: string; label: string; order: number };
  };
};

type ProgramGroup = {
  name: string;
  slug: string;
  files: DriveArchiveFileData[];
};

type DirectorySubject = {
  key: string;
  courseName: string;
  courseSlug: string;
  name: string;
  files: DriveArchiveFileData[];
  sessionCount: number;
  latestSession: string;
};

const ALL = "all";

function subjectKey(file: DriveArchiveFileData) {
  return `${file.driveSubject.program.slug}:${file.driveSubject.name.trim().toLocaleLowerCase()}`;
}

function fileLabel(file: DriveArchiveFileData) {
  return file.link.variantLabel ? `${file.link.session.label} · ${file.link.variantLabel}` : file.link.session.label;
}

function sortFiles(a: DriveArchiveFileData, b: DriveArchiveFileData) {
  return (
    b.link.session.order - a.link.session.order ||
    (b.year ?? 0) - (a.year ?? 0) ||
    a.fileName.localeCompare(b.fileName)
  );
}

export function DriveArchiveBrowser({ files }: { files: DriveArchiveFileData[] }) {
  const [course, setCourse] = useState(ALL);
  const [selectedSubjectKey, setSelectedSubjectKey] = useState("");
  const [session, setSession] = useState(ALL);
  const [search, setSearch] = useState("");

  const courses = useMemo(() => {
    const bySlug = new Map<string, string>();
    for (const file of files) bySlug.set(file.driveSubject.program.slug, file.driveSubject.program.name);
    return [...bySlug].sort((a, b) => a[1].localeCompare(b[1]));
  }, [files]);

  const coursePapers = useMemo(
    () => (course === ALL ? files : files.filter((file) => file.driveSubject.program.slug === course)),
    [course, files],
  );

  const directorySubjects = useMemo(() => {
    const groups = new Map<string, Omit<DirectorySubject, "sessionCount" | "latestSession">>();
    for (const file of coursePapers) {
      const key = subjectKey(file);
      const existing = groups.get(key);
      if (existing) existing.files.push(file);
      else {
        groups.set(key, {
          key,
          courseName: file.driveSubject.program.name,
          courseSlug: file.driveSubject.program.slug,
          name: file.driveSubject.name,
          files: [file],
        });
      }
    }

    return [...groups.values()]
      .map((subject) => {
        const sorted = subject.files.toSorted(sortFiles);
        const sessionIds = new Set(subject.files.map((f) => f.link.session.id));
        return {
          ...subject,
          files: sorted,
          sessionCount: sessionIds.size,
          latestSession: sorted[0]?.link.session.label ?? "—",
        };
      })
      .filter(
        (subject) =>
          !search.trim() ||
          subject.name.toLowerCase().includes(search.trim().toLowerCase()) ||
          subject.courseName.toLowerCase().includes(search.trim().toLowerCase()),
      )
      .sort((a, b) => a.courseName.localeCompare(b.courseName) || a.name.localeCompare(b.name));
  }, [coursePapers, search]);

  const subjectPapers = useMemo(
    () => (selectedSubjectKey ? coursePapers.filter((file) => subjectKey(file) === selectedSubjectKey) : coursePapers),
    [coursePapers, selectedSubjectKey],
  );

  const sessionOptions = useMemo(() => {
    const sessions = new Map<string, { label: string; order: number }>();
    for (const file of subjectPapers) sessions.set(file.link.session.id, file.link.session);
    return [...sessions].sort((a, b) => b[1].order - a[1].order);
  }, [subjectPapers]);

  const filteredFiles = useMemo(
    () => (session === ALL ? subjectPapers : subjectPapers.filter((file) => file.link.session.id === session)),
    [session, subjectPapers],
  );

  const programs = useMemo(() => {
    const groups = new Map<string, ProgramGroup>();
    for (const file of filteredFiles) {
      const { name, slug } = file.driveSubject.program;
      const existing = groups.get(slug);
      if (existing) existing.files.push(file);
      else groups.set(slug, { name, slug, files: [file] });
    }
    return [...groups.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((program) => ({ ...program, files: program.files.toSorted(sortFiles) }));
  }, [filteredFiles]);

  const selectedSubjectName = selectedSubjectKey
    ? coursePapers.find((file) => subjectKey(file) === selectedSubjectKey)?.driveSubject.name
    : undefined;
  const showSubjectDirectory = !selectedSubjectKey && session === ALL;
  const directoryCourseCount = new Set(directorySubjects.map((subject) => subject.courseSlug)).size;

  function selectCourse(nextCourse: string) {
    setCourse(nextCourse);
    setSelectedSubjectKey("");
    setSession(ALL);
  }

  function openSubject(subject: DirectorySubject) {
    setCourse(subject.courseSlug);
    setSelectedSubjectKey(subject.key);
    setSession(ALL);
  }

  function backToSubjectList() {
    setSelectedSubjectKey("");
    setSession(ALL);
  }

  function clearFilters() {
    setCourse(ALL);
    setSelectedSubjectKey("");
    setSession(ALL);
    setSearch("");
  }

  const hasResults = showSubjectDirectory ? directorySubjects.length > 0 : programs.length > 0;

  return (
    <>
      <section
        aria-labelledby="drive-archive-filters-title"
        className="mt-10 rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <FunnelSimple aria-hidden="true" size={18} weight="bold" />
          </span>
          <div>
            <h2 id="drive-archive-filters-title" className="font-semibold">
              Find your question paper
            </h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Filter by course and session, or search a subject directly. Papers open in Google Drive.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.4fr)_minmax(200px,0.8fr)] lg:items-start">
          <div>
            <label htmlFor="drive-archive-course" className="block text-sm font-semibold">
              Course
            </label>
            <select
              id="drive-archive-course"
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
          </div>

          <div>
            <label htmlFor="drive-archive-search" className="block text-sm font-semibold">
              Search subject
            </label>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-border bg-background px-3 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20">
              <MagnifyingGlass size={16} className="shrink-0 text-muted" />
              <input
                id="drive-archive-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="e.g. Corporate Accounting"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
              />
            </span>
          </div>

          <div>
            <label htmlFor="drive-archive-session" className="block text-sm font-semibold">
              Session
            </label>
            <select
              id="drive-archive-session"
              value={session}
              onChange={(event) => setSession(event.target.value)}
              disabled={!selectedSubjectKey}
              className="mt-2 min-h-11 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:opacity-50"
            >
              <option value={ALL}>All sessions</option>
              {sessionOptions.map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-xs leading-5 text-muted">
              {selectedSubjectKey ? "Narrow to one exam session." : "Pick a subject first."}
            </p>
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
              Showing <strong className="font-semibold text-foreground">{filteredFiles.length}</strong> paper
              {filteredFiles.length === 1 ? "" : "s"}
              {selectedSubjectName ? (
                <>
                  {" "}
                  for <strong className="font-semibold text-foreground">{selectedSubjectName}</strong>
                </>
              ) : null}
              .
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
          {(course !== ALL || selectedSubjectKey || session !== ALL || search) && (
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
          <p className="mt-2 text-sm text-muted">Try another course or clear your search.</p>
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
              aria-labelledby={`drive-course-${program.slug}`}
              className="overflow-hidden rounded-2xl border border-border bg-surface"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-4 sm:px-6">
                <div>
                  <h2 id={`drive-course-${program.slug}`} className="flex items-center gap-2 text-lg font-semibold">
                    <GraduationCap aria-hidden="true" size={19} weight="bold" className="text-accent" />
                    {program.name}
                    {selectedSubjectName ? <span className="text-muted">· {selectedSubjectName}</span> : null}
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    {program.files.length} paper{program.files.length === 1 ? "" : "s"}
                  </p>
                </div>
                <span className="text-xs font-medium text-muted">Opens the original PDF in Google Drive</span>
              </div>
              <FileTable files={program.files} />
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
  onOpenSubject: (subject: DirectorySubject) => void;
}) {
  return (
    <section
      aria-labelledby="drive-subject-directory-title"
      className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-muted/60 px-5 py-4 sm:px-6">
        <div>
          <h2 id="drive-subject-directory-title" className="text-lg font-semibold">
            Subject directory
          </h2>
          <p className="mt-1 text-sm text-muted">One row per subject across every synced exam session.</p>
        </div>
        <span className="text-xs font-medium text-muted">Select a subject to see its papers</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead className="bg-surface-muted/35 text-xs text-muted">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Course</th>
              <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
              <th scope="col" className="w-24 px-4 py-3 text-right font-semibold">Sessions</th>
              <th scope="col" className="w-20 px-4 py-3 text-right font-semibold">Papers</th>
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
                <td className="px-4 py-4 text-right align-top">{subject.sessionCount}</td>
                <td className="px-4 py-4 text-right align-top">{subject.files.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FileTable({ files }: { files: DriveArchiveFileData[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-sm">
        <thead className="bg-surface-muted/35 text-xs text-muted">
          <tr>
            <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Subject</th>
            <th scope="col" className="px-4 py-3 font-semibold">Session</th>
            <th scope="col" className="px-4 py-3 font-semibold">File</th>
            <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Open in Drive</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {files.map((file) => (
            <tr key={file.id} className="transition-colors hover:bg-accent-soft/35 focus-within:bg-accent-soft/35">
              <th scope="row" className="px-5 py-4 font-medium sm:px-6">
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm text-foreground outline-none transition hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  {file.driveSubject.name}
                  <span className="sr-only"> — {file.fileName}, {fileLabel(file)}</span>
                </a>
              </th>
              <td className="px-4 py-4 text-muted">
                {fileLabel(file)}
                {file.year ? <span className="ml-1.5">· {file.year}</span> : null}
              </td>
              <td className="max-w-sm px-4 py-4 text-muted">
                <span className="line-clamp-2">{file.fileName}</span>
              </td>
              <td className="px-4 py-4 text-right">
                <a
                  href={file.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${file.driveSubject.name} paper (${fileLabel(file)}) in Google Drive`}
                  className="inline-flex size-9 items-center justify-center rounded-lg text-muted outline-none transition hover:bg-accent-soft hover:text-accent focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  <ArrowSquareOut aria-hidden="true" size={17} weight="bold" />
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
