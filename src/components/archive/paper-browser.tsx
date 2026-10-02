"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { ArrowSquareOut, DownloadSimple, FilePdf, Funnel, MagnifyingGlass, X } from "@phosphor-icons/react";
import { CopyButton } from "@/components/pyq/copy-button";
import { NotesNudge } from "@/components/paid-notes/notes-nudge";
import { semesterLabel, type CatalogPaper } from "@/lib/pyq-catalog-types";
import { canonicalSubjectKey, preferredSubjectLabel } from "@/lib/subject-normalization";

// Data comes from small per-course files built by
// scripts/build-papers-split.mjs — a visitor downloads only the course they
// pick (tens of KB) instead of the whole 13MB archive.
type CourseIndexEntry = { course: string; slug: string; count: number };
type SubjectOverride = {
  course: string;
  subjectKey: string;
  displayName: string | null;
  semesterOverride: number | null;
  hidden: boolean;
  courseOverride: string | null;
};
type PaperOverride = { paperId: string; pdfUrl: string | null; hidden: boolean };
type Overrides = { subjects: Map<string, SubjectOverride>; papers: Map<string, PaperOverride>; list: SubjectOverride[] };

function yearStart(value: string) {
  return Number(value.match(/\d{4}/)?.[0] ?? 0);
}

// Google Drive's "view" links (what's actually stored on drive-sourced
// papers) render a login/permission gate when framed — only the /preview
// path embeds cleanly. Everything else (college library sites, the DU
// exam portal) already frames fine as-is.
function embeddableUrl(url: string): string {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParam) return `https://drive.google.com/file/d/${idParam[1]}/preview`;
  return url;
}

// Some source sites send `X-Frame-Options: DENY` / a restrictive
// frame-ancestors CSP, which silently blocks embedding — the browser
// shows its own "refused to connect" page inside the iframe with no way
// for our JS to detect it. Known offenders skip straight to the "open
// externally" fallback. zhdce.ac.in confirmed via curl -I: `x-frame-options: DENY`.
const FRAME_BLOCKED_HOSTS = new Set(["zhdce.ac.in"]);

function isFrameBlocked(url: string): boolean {
  try {
    return FRAME_BLOCKED_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
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

function cleanNote(p: CatalogPaper) {
  return (p.note ?? "")
    .replace(/\[[SKAR]\]\s*(Shivaji|Kalindi|ANDC|Ramanujan)\s*\|?\s*/gi, "")
    .replace(/^\|\s*/, "")
    .trim();
}

// "bcom hons", "B.Com (Hons" and "B.Com. (Hons.)" should all match.
function looseMatch(haystack: string, needle: string) {
  const squash = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");
  return squash(haystack).includes(squash(needle));
}

async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

// Admin edits from Admin → Papers archive (rename/combine/move/hide a
// subject, replace or hide a single paper), layered on the static files.
async function loadOverrides(): Promise<Overrides> {
  const [subjects, papers] = await Promise.all([
    fetchJson<SubjectOverride[]>("/api/catalog-overrides", []),
    fetchJson<PaperOverride[]>("/api/catalog-paper-overrides", []),
  ]);
  const list = Array.isArray(subjects) ? subjects : [];
  return {
    list,
    subjects: new Map(list.map((o) => [`${o.course}\u0000${o.subjectKey}`, o])),
    papers: new Map((Array.isArray(papers) ? papers : []).map((o) => [o.paperId, o])),
  };
}

function applyOverrides(raw: CatalogPaper[], overrides: Overrides): CatalogPaper[] {
  const out: CatalogPaper[] = [];
  for (const p of raw) {
    const paperOverride = overrides.papers.get(p.id);
    if (paperOverride?.hidden) continue;
    const override = overrides.subjects.get(`${p.course}\u0000${canonicalSubjectKey(p.subject)}`);
    if (override?.hidden) continue;
    let paper = paperOverride?.pdfUrl ? { ...p, pdfUrl: paperOverride.pdfUrl } : p;
    if (override) {
      paper = {
        ...paper,
        originalSubject: p.subject,
        subject: override.displayName || p.subject,
        course: override.courseOverride || p.course,
        semester: override.semesterOverride != null ? String(override.semesterOverride) : p.semester,
      };
    }
    out.push(paper);
  }
  return out;
}

type SearchHit = { course: string; key: string; label: string; count: number };

type Tab = "course" | "subject";

// Layout: course/subject picker on the left (~30%), paper viewer on the
// right. A PDF is only loaded once the student clicks a year — never
// automatically.
export function PaperBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [index, setIndex] = useState<CourseIndexEntry[] | null>(null);
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [loadedCourses, setLoadedCourses] = useState<Record<string, CatalogPaper[]>>({});
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [openPaperId, setOpenPaperId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("course");
  const [courseSearch, setCourseSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [searchRows, setSearchRows] = useState<[string, string, number][] | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const inFlight = useRef(new Set<string>());

  // 1. Tiny course list + admin overrides — nothing else loads up front.
  // Then read the URL once (deep links from the homepage, search bar and
  // shared "Copy link"s).
  useEffect(() => {
    let alive = true;
    Promise.all([fetchJson<CourseIndexEntry[]>("/data/papers/index.json", []), loadOverrides()]).then(
      ([idx, ov]) => {
        if (!alive) return;
        setIndex(idx);
        setOverrides(ov);
        const requestedCourse = searchParams.get("course");
        let matched: string | null = null;
        if (requestedCourse) {
          const q = requestedCourse.trim().toLowerCase();
          const match =
            idx.find((c) => c.course.toLowerCase() === q) ??
            idx.find((c) => c.course.toLowerCase().includes(q) || q.includes(c.course.toLowerCase()));
          if (match) {
            matched = match.course;
            setCourse(match.course);
            setActiveTab("subject");
          }
        }
        const subject = searchParams.get("subject");
        if (subject && matched) setSubjectKey(subject);
        const paper = searchParams.get("paper");
        if (paper && matched) setOpenPaperId(paper);
        const q = searchParams.get("q");
        if (q && !matched) {
          setSubjectSearch(q);
          setActiveTab("subject");
        }
        setInitialized(true);
      },
    );
    return () => {
      alive = false;
    };
    // Only on mount: later URL changes are our own router.replace calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 2. Load only the chosen course (plus any course an admin moved a
  // subject in from). Each course is fetched once per visit.
  useEffect(() => {
    if (!course || !index || !overrides || loadedCourses[course] || inFlight.current.has(course)) return;
    inFlight.current.add(course);
    const sources = new Set([course]);
    for (const o of overrides.list) if (o.courseOverride === course) sources.add(o.course);
    const slugOf = new Map(index.map((c) => [c.course, c.slug]));
    Promise.all(
      [...sources]
        .filter((c) => slugOf.has(c))
        .map((c) => fetchJson<CatalogPaper[]>(`/data/papers/courses/${slugOf.get(c)}.json`, [])),
    ).then((lists) => {
      inFlight.current.delete(course);
      const papers = applyOverrides(lists.flat(), overrides).filter((p) => p.course === course);
      setLoadedCourses((prev) => ({ ...prev, [course]: papers }));
    });
  }, [course, index, overrides, loadedCourses]);
  const coursePapers = course ? loadedCourses[course] ?? null : null;

  // Searching subjects before picking a course searches every course; the
  // subject index for that is fetched only when someone actually types.
  const globalSearch = !course && subjectSearch.trim().length >= 2;
  useEffect(() => {
    if (!globalSearch || searchRows) return;
    fetchJson<[string, string, number][]>("/data/papers/search-index.json", []).then(setSearchRows);
  }, [globalSearch, searchRows]);

  const searchHits = useMemo<SearchHit[]>(() => {
    if (!globalSearch || !searchRows || !overrides) return [];
    const groups = new Map<string, { course: string; key: string; labels: string[]; count: number }>();
    for (const [rowCourse, subject, count] of searchRows) {
      const o = overrides.subjects.get(`${rowCourse}\u0000${canonicalSubjectKey(subject)}`);
      if (o?.hidden) continue;
      const label = o?.displayName || subject;
      const c = o?.courseOverride || rowCourse;
      const key = canonicalSubjectKey(label);
      const id = `${c}\u0000${key}`;
      const g = groups.get(id) ?? { course: c, key, labels: [], count: 0 };
      g.labels.push(label);
      g.count += count;
      groups.set(id, g);
    }
    return [...groups.values()]
      .map((g) => ({ course: g.course, key: g.key, label: preferredSubjectLabel(g.labels), count: g.count }))
      .filter((h) => looseMatch(h.label, subjectSearch))
      .sort((a, b) => b.count - a.count)
      .slice(0, 80);
  }, [globalSearch, searchRows, overrides, subjectSearch]);

  // Keep the address bar shareable.
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(searchParams.toString());
    const set = (k: string, v: string | null) => (v ? params.set(k, v) : params.delete(k));
    set("course", course);
    set("subject", subjectKey);
    set("paper", openPaperId);
    params.delete("sem");
    params.delete("q");
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
  }, [initialized, course, subjectKey, openPaperId, pathname, router, searchParams]);

  const courses = useMemo(
    () => (index ?? []).filter((c) => looseMatch(c.course, courseSearch)),
    [index, courseSearch],
  );

  const subjects = useMemo(() => {
    const map = new Map<string, { labels: string[]; papers: CatalogPaper[] }>();
    for (const p of coursePapers ?? []) {
      const key = canonicalSubjectKey(p.subject);
      const entry = map.get(key) ?? { labels: [], papers: [] };
      entry.labels.push(p.subject);
      entry.papers.push(p);
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, { labels, papers }]) => ({
        key,
        label: preferredSubjectLabel(labels),
        papers: papers.sort(
          (a, b) => yearStart(b.yearRange) - yearStart(a.yearRange) || cleanNote(a).localeCompare(cleanNote(b)),
        ),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [coursePapers]);

  const visibleSubjects = useMemo(
    () => subjects.filter((s) => looseMatch(s.label, subjectSearch)),
    [subjects, subjectSearch],
  );
  const subject = subjects.find((s) => s.key === subjectKey) ?? null;
  const openPaper = subject?.papers.find((p) => p.id === openPaperId) ?? null;

  function pickCourse(name: string) {
    const next = name === course ? null : name;
    setCourse(next);
    setSubjectKey(null);
    setOpenPaperId(null);
    setSubjectSearch("");
    if (next) setActiveTab("subject");
  }
  function pickSubject(key: string) {
    const isSame = key === subjectKey;
    setSubjectKey(isSame ? null : key);
    // Open the most recent paper right away — saves the student a click.
    setOpenPaperId(isSame ? null : (subjects.find((s) => s.key === key)?.papers[0]?.id ?? null));
    setIsMobileFilterOpen(false);
  }
  function pickSearchHit(hit: SearchHit) {
    setCourse(hit.course);
    setSubjectKey(hit.key);
    setOpenPaperId(null);
    setSubjectSearch("");
    setIsMobileFilterOpen(false);
  }
  function clearAll() {
    setCourse(null);
    setSubjectKey(null);
    setOpenPaperId(null);
    setSubjectSearch("");
    setActiveTab("course");
  }

  if (!index || !overrides) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,30%)_1fr]">
        <div className="h-[600px] animate-pulse rounded-2xl border border-border bg-surface p-4" />
        <div className="hidden h-[600px] animate-pulse rounded-2xl border border-border bg-surface p-6 lg:block" />
      </div>
    );
  }

  const activeCount = (course ? 1 : 0) + (subjectKey ? 1 : 0);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(280px,30%)_1fr]">
      {/* Mobile: filters open as a full-screen sheet */}
      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setIsMobileFilterOpen(true)}
          className="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3.5 text-left text-sm font-semibold text-foreground shadow-sm transition hover:bg-surface-muted"
        >
          <Funnel size={18} weight="bold" className="shrink-0 text-muted" />
          <span className="min-w-0 flex-1 truncate">
            {course ? (subject ? `${course} · ${subject.label}` : course) : "Choose course & subject"}
          </span>
          {activeCount > 0 && (
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-white">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      <aside
        className={`fixed inset-0 z-50 flex-col bg-background p-4 sm:p-6 lg:sticky lg:top-4 lg:z-auto lg:self-start lg:flex lg:h-[calc(100vh-7.5rem)] lg:bg-transparent lg:p-0 ${
          isMobileFilterOpen ? "flex" : "hidden"
        }`}
      >
        <div className="mb-4 flex items-center justify-between lg:mb-2.5">
          <h2 className="text-lg font-bold tracking-tight text-foreground lg:text-sm">Filters</h2>
          <div className="flex items-center gap-4">
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearAll}
                className="text-xs font-semibold text-accent transition hover:text-accent-hover hover:underline"
              >
                Clear all ({activeCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(false)}
              aria-label="Close filters"
              className="flex items-center justify-center rounded-full bg-surface-muted p-1.5 text-foreground lg:hidden"
            >
              <X size={16} weight="bold" />
            </button>
          </div>
        </div>

        <div className="flex rounded-xl border border-border/80 bg-surface-muted/80 p-1 text-sm shadow-2xs">
          <TabButton active={activeTab === "course"} onClick={() => setActiveTab("course")} label="Course" count={course ? 1 : 0} />
          <TabButton active={activeTab === "subject"} onClick={() => setActiveTab("subject")} label="Subject" count={subjectKey ? 1 : 0} />
        </div>

        <div className="mt-2.5 flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface p-3 shadow-2xs">
          {activeTab === "course" && (
            <FilterList
              searchPlaceholder="Search course, e.g. bcom hons…"
              search={courseSearch}
              onSearch={setCourseSearch}
              total={courses.length}
              empty={courses.length === 0}
            >
              {courses.map((c) => (
                <FilterCheckbox
                  key={c.course}
                  checked={course === c.course}
                  label={c.course}
                  count={c.count}
                  onClick={() => pickCourse(c.course)}
                />
              ))}
            </FilterList>
          )}

          {activeTab === "subject" &&
            (course ? (
              <FilterList
                searchPlaceholder="Search subject…"
                search={subjectSearch}
                onSearch={setSubjectSearch}
                total={visibleSubjects.length}
                empty={Boolean(coursePapers) && visibleSubjects.length === 0}
              >
                {!coursePapers ? (
                  <ListSkeleton />
                ) : (
                  visibleSubjects.map((s) => (
                    <FilterCheckbox
                      key={s.key}
                      checked={subjectKey === s.key}
                      label={s.label}
                      count={s.papers.length}
                      onClick={() => pickSubject(s.key)}
                    />
                  ))
                )}
              </FilterList>
            ) : (
              <FilterList
                searchPlaceholder="Search any subject…"
                search={subjectSearch}
                onSearch={setSubjectSearch}
                total={searchHits.length}
                empty={globalSearch && Boolean(searchRows) && searchHits.length === 0}
              >
                {!globalSearch ? (
                  <p className="px-2.5 py-1.5 text-xs text-muted">
                    Pick a course first, or type a subject name to search every course.
                  </p>
                ) : !searchRows ? (
                  <ListSkeleton />
                ) : (
                  searchHits.map((h) => (
                    <button
                      key={`${h.course}-${h.key}`}
                      type="button"
                      onClick={() => pickSearchHit(h)}
                      className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-foreground sm:text-sm">{h.label}</span>
                        <span className="block truncate text-[11px] text-muted">{h.course}</span>
                      </span>
                      <span className="shrink-0 text-[11px] text-muted">{h.count}</span>
                    </button>
                  ))
                )}
              </FilterList>
            ))}
        </div>
      </aside>

      <main className="min-w-0">
        {!course ? (
          <Placeholder
            title="Select your course"
            text="Pick a course on the left, then a subject — its question papers will show here."
            onMobilePick={() => setIsMobileFilterOpen(true)}
          />
        ) : !coursePapers ? (
          <div className="h-[450px] animate-pulse rounded-2xl border border-border bg-surface" />
        ) : !subject ? (
          <Placeholder
            title="Now pick a subject"
            text={`${course} has ${subjects.length} subjects. Choose one on the left to see its papers.`}
            onMobilePick={() => {
              setActiveTab("subject");
              setIsMobileFilterOpen(true);
            }}
          />
        ) : (
          <PaperPanel
            key={subject.key}
            course={course}
            subjectLabel={subject.label}
            papers={subject.papers}
            openPaper={openPaper}
            onOpen={setOpenPaperId}
          />
        )}
      </main>
    </div>
  );
}

function Placeholder({ title, text, onMobilePick }: { title: string; text: string; onMobilePick: () => void }) {
  return (
    <div className="flex h-[450px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center">
      <FilePdf size={32} weight="duotone" className="text-accent" />
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <p className="max-w-sm text-xs text-muted">{text}</p>
      <button
        type="button"
        onClick={onMobilePick}
        className="mt-2 rounded-lg bg-accent px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-accent-hover lg:hidden"
      >
        Choose now
      </button>
    </div>
  );
}

// Display grouping only — the stored yearRange is untouched. "MAY-JUNE-2026
// 2026", "May-June 2026" and "2026" all fall under 2026; a session range
// like "2021-2022" goes under its later year.
// The later year is capped at this year so a "2026-2027" session shows under 2026.
function examYear(p: CatalogPaper) {
  const last = p.yearRange.match(/\d{4}/g)?.at(-1);
  return last ? String(Math.min(Number(last), new Date().getFullYear())) : "Other";
}

function sessionLabel(p: CatalogPaper) {
  const m = p.yearRange.match(/(may|nov)\W*(june|dec)/i);
  if (m) return `${m[1][0].toUpperCase()}${m[1].slice(1).toLowerCase()}-${m[2][0].toUpperCase()}${m[2].slice(1).toLowerCase()}`;
  const years = p.yearRange.match(/\d{4}/g) ?? [];
  return years.length > 1 ? p.yearRange : years.length ? "" : p.yearRange;
}

function PaperPanel({
  course,
  subjectLabel,
  papers,
  openPaper,
  onOpen,
}: {
  course: string;
  subjectLabel: string;
  papers: CatalogPaper[];
  openPaper: CatalogPaper | null;
  onOpen: (id: string) => void;
}) {
  const [pickedYear, setPickedYear] = useState<string | null>(null);
  const years = [...new Set(papers.map(examYear))].sort((a, b) =>
    a === "Other" ? 1 : b === "Other" ? -1 : b.localeCompare(a),
  );
  const activeYear = pickedYear ?? (openPaper ? examYear(openPaper) : null);
  const yearPapers = papers.filter((p) => examYear(p) === activeYear);

  function pickYear(year: string) {
    setPickedYear(year);
    const inYear = papers.filter((p) => examYear(p) === year);
    if (inYear.length === 1) onOpen(inYear[0].id);
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-2xs sm:p-5">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-md bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
            {course}
          </span>
          <h2 className="mt-1.5 text-lg font-bold leading-snug text-foreground sm:text-xl">{subjectLabel}</h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            {openPaper ? (
              <>
                {semesterLabel(openPaper)} · <span className="font-medium text-foreground">{openPaper.yearRange}</span>
                {cleanNote(openPaper) && ` · ${cleanNote(openPaper)}`}
              </>
            ) : (
              `${papers.length} paper${papers.length === 1 ? "" : "s"} — choose a year below to open one`
            )}
          </p>
          <NotesNudge course={course} subject={subjectLabel} />
        </div>
        {openPaper && (
          <div className="flex shrink-0 items-center gap-2">
            <CopyButton
              text={typeof window === "undefined" ? "" : window.location.href}
              label="Copy link"
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted shadow-2xs transition hover:border-accent hover:text-accent"
            />
            <a
              href={openPaper.pdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted shadow-2xs transition hover:border-accent hover:text-accent"
            >
              <ArrowSquareOut size={14} weight="bold" />
              <span className="hidden sm:inline">Open in new tab</span>
            </a>
            <a
              href={openPaper.pdfUrl}
              download
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground shadow-2xs transition hover:bg-brand-hover"
            >
              <DownloadSimple size={14} weight="bold" />
              <span>Download</span>
            </a>
          </div>
        )}
      </div>

      {/* Years, then that year's papers — clicking a paper is what loads a PDF */}
      <div className="mt-3.5 flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">Years:</span>
        {years.map((y) => (
          <button
            key={y}
            type="button"
            onClick={() => pickYear(y)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              y === activeYear
                ? "bg-accent text-white shadow-2xs ring-2 ring-accent/20"
                : "bg-surface-muted text-muted hover:bg-border/60 hover:text-foreground"
            }`}
          >
            {y}
            <span className="text-[11px] opacity-75">{papers.filter((p) => examYear(p) === y).length}</span>
          </button>
        ))}
      </div>
      {yearPapers.length > 1 && (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {yearPapers.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onOpen(p.id)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                p.id === openPaper?.id
                  ? "border-accent bg-accent-soft text-accent shadow-2xs"
                  : "border-border bg-surface text-muted hover:text-foreground"
              }`}
            >
              <span className="max-w-56 truncate">
                {[sessionLabel(p), cleanNote(p)].filter(Boolean).join(" · ") || `Paper ${i + 1}`}
              </span>
              <CollegeBadges paper={p} />
            </button>
          ))}
        </div>
      )}

      <div className="mt-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        {!openPaper ? (
          <div className="flex h-[60vh] min-h-[420px] flex-col items-center justify-center gap-2 bg-surface-muted/40 px-6 text-center">
            <FilePdf size={36} weight="duotone" className="text-accent" />
            <p className="text-sm font-semibold text-foreground">
              {activeYear ? "Choose a paper above to open it" : "Choose a year above"}
            </p>
            <p className="text-xs text-muted">The PDF loads only when you pick one.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between border-b border-border bg-surface-muted/60 px-3.5 py-2">
              <span className="truncate text-xs font-medium text-foreground">{fileName(openPaper)}</span>
            </div>
            {isFrameBlocked(openPaper.pdfUrl) ? (
              <div className="flex h-[60vh] flex-col items-center justify-center gap-3 bg-surface-muted/50 px-6 text-center">
                <p className="text-sm text-muted">
                  This paper&apos;s source site doesn&apos;t allow inline preview — open it directly instead.
                </p>
                <a
                  href={openPaper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
                >
                  <ArrowSquareOut size={14} weight="bold" />
                  Open PDF
                </a>
              </div>
            ) : (
              <iframe
                key={openPaper.id}
                src={embeddableUrl(openPaper.pdfUrl)}
                title={fileName(openPaper)}
                className="h-[80vh] min-h-[560px] w-full bg-surface-muted/40"
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-1.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="h-7 animate-pulse rounded-lg bg-surface-muted" />
      ))}
    </div>
  );
}

const COLLEGE_BADGES = [
  { test: (p: CatalogPaper) => p.isShivaji || p.college === "Shivaji", letter: "S", title: "Shivaji College Archive", cls: "bg-emerald-500 text-emerald-950" },
  { test: (p: CatalogPaper) => p.isKalindi || p.college === "Kalindi", letter: "K", title: "Kalindi College Archive", cls: "bg-rose-500 text-white" },
  { test: (p: CatalogPaper) => p.isANDC || p.college === "ANDC", letter: "A", title: "Acharya Narendra Dev College (ANDC) Archive", cls: "bg-blue-500 text-white" },
  { test: (p: CatalogPaper) => p.isRamanujan || p.college === "Ramanujan", letter: "R", title: "Ramanujan College Archive", cls: "bg-amber-500 text-amber-950" },
];

function CollegeBadges({ paper }: { paper: CatalogPaper }) {
  return (
    <>
      {COLLEGE_BADGES.filter((b) => b.test(paper)).map((b) => (
        <span key={b.letter} title={b.title} className={`shrink-0 rounded px-1 py-px text-[9px] font-black uppercase tracking-tight ${b.cls}`}>
          {b.letter}
        </span>
      ))}
    </>
  );
}

function TabButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition ${
        active ? "bg-surface text-foreground shadow-xs" : "text-muted hover:text-foreground"
      }`}
    >
      {label}
      {count > 0 && <span className="ml-1 text-accent">({count})</span>}
    </button>
  );
}

function FilterList({
  searchPlaceholder,
  search,
  onSearch,
  total,
  empty,
  children,
}: {
  searchPlaceholder?: string;
  search?: string;
  onSearch?: (v: string) => void;
  total: number;
  empty: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {onSearch && (
        <div className="relative mb-2 shrink-0">
          <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={searchPlaceholder}
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-xs text-foreground outline-none focus:border-accent sm:text-sm"
          />
        </div>
      )}
      <p className="mb-1.5 shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted">{total} total</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]">
        {children}
        {empty && <p className="px-2.5 py-1.5 text-xs text-muted">No matches.</p>}
      </div>
    </div>
  );
}

function FilterCheckbox({ checked, label, count, onClick }: { checked: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition sm:text-sm ${
        checked ? "bg-accent-soft font-semibold text-accent" : "text-foreground hover:bg-surface-muted"
      }`}
    >
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
          checked ? "border-accent bg-accent text-white" : "border-border"
        }`}
        aria-hidden="true"
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <span className="shrink-0 text-[11px] text-muted">{count}</span>
    </button>
  );
}
