"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretDown,
  DownloadSimple,
  FilePdf,
  MagnifyingGlass,
  X,
} from "@phosphor-icons/react";
import { CopyButton } from "@/components/pyq/copy-button";
import { NO_SEMESTER, semesterLabel, type CatalogPaper } from "@/lib/pyq-catalog-types";
import { canonicalSubjectKey, preferredSubjectLabel } from "@/lib/subject-normalization";

// Data comes from small per-course files built by
// scripts/build-papers-split.mjs — a visitor downloads only the course they
// pick (tens of KB) instead of the whole 13MB archive, and a PDF is only
// loaded once they click a paper.
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

const ALL_SEMESTERS = "all";

function yearStart(value: string) {
  return Number(value.match(/\d{4}/)?.[0] ?? 0);
}

function semesterSortKey(label: string) {
  if (label === NO_SEMESTER) return 99;
  return Number(label.match(/\d+/)?.[0] ?? 99);
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

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
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

export function PaperBrowser() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [index, setIndex] = useState<CourseIndexEntry[] | null>(null);
  const [overrides, setOverrides] = useState<Overrides | null>(null);
  const [course, setCourse] = useState<string | null>(null);
  const [loadedCourses, setLoadedCourses] = useState<Record<string, CatalogPaper[]>>({});
  const [semester, setSemester] = useState<string | null>(null);
  const [subjectKeys, setSubjectKeys] = useState<Set<string>>(new Set());
  const [openPaperId, setOpenPaperId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [courseSearch, setCourseSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [query, setQuery] = useState("");
  const [searchRows, setSearchRows] = useState<[string, string, number][] | null>(null);
  const [initialized, setInitialized] = useState(false);
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
        if (requestedCourse) {
          const q = requestedCourse.trim().toLowerCase();
          const match =
            idx.find((c) => c.course.toLowerCase() === q) ??
            idx.find((c) => c.course.toLowerCase().includes(q) || q.includes(c.course.toLowerCase()));
          if (match) setCourse(match.course);
        }
        const sem = searchParams.get("sem");
        if (sem) setSemester(sem);
        const subject = searchParams.get("subject");
        if (subject) {
          setSubjectKeys(new Set([subject]));
          setExpanded(new Set([subject]));
        }
        const paper = searchParams.get("paper");
        if (paper) setOpenPaperId(paper);
        const q = searchParams.get("q");
        if (q && !requestedCourse) setQuery(q);
        setInitialized(true);
      },
    );
    return () => {
      alive = false;
    };
    // Only on mount: later URL changes are our own router.replace calls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const courses = useMemo(() => {
    if (!index) return [];
    const counts = new Map(index.map((c) => [c.course, c.count]));
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [index]);

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

  // Header search: fetch the subject index only when someone searches.
  useEffect(() => {
    if (!query || searchRows) return;
    fetchJson<[string, string, number][]>("/data/papers/search-index.json", []).then(setSearchRows);
  }, [query, searchRows]);

  const searchHits = useMemo<SearchHit[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q || !searchRows || !overrides) return [];
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
      .filter((h) => looseMatch(h.label, q) || looseMatch(h.course, q))
      .sort((a, b) => b.count - a.count)
      .slice(0, 80);
  }, [query, searchRows, overrides]);

  // Keep the address bar shareable.
  useEffect(() => {
    if (!initialized) return;
    const params = new URLSearchParams(searchParams.toString());
    const set = (k: string, v: string | null) => (v ? params.set(k, v) : params.delete(k));
    set("course", course);
    set("sem", semester);
    set("subject", subjectKeys.size === 1 ? [...subjectKeys][0] : null);
    set("paper", openPaperId);
    set("q", course ? null : query || null);
    const next = params.toString();
    if (next !== searchParams.toString()) router.replace(`${pathname}?${next}`, { scroll: false });
  }, [initialized, course, semester, subjectKeys, openPaperId, query, pathname, router, searchParams]);

  const semesters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of coursePapers ?? []) {
      const label = semesterLabel(p);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => semesterSortKey(a.label) - semesterSortKey(b.label));
  }, [coursePapers]);

  const inSemester = useMemo(() => {
    if (!coursePapers) return [];
    if (!semester || semester === ALL_SEMESTERS) return coursePapers;
    return coursePapers.filter((p) => semesterLabel(p) === semester);
  }, [coursePapers, semester]);

  const subjects = useMemo(() => {
    const map = new Map<string, { labels: string[]; papers: CatalogPaper[] }>();
    for (const p of inSemester) {
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
        papers: papers.sort((a, b) => yearStart(b.yearRange) - yearStart(a.yearRange) || cleanNote(a).localeCompare(cleanNote(b))),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [inSemester]);

  const visibleSubjects = useMemo(() => {
    return subjects.filter(
      (s) => (subjectKeys.size === 0 || subjectKeys.has(s.key)) && looseMatch(s.label, subjectSearch),
    );
  }, [subjects, subjectKeys, subjectSearch]);

  const openPaper = useMemo(
    () => (openPaperId ? coursePapers?.find((p) => p.id === openPaperId) ?? null : null),
    [coursePapers, openPaperId],
  );
  const openPaperSiblings = useMemo(() => {
    if (!openPaper) return [];
    const key = canonicalSubjectKey(openPaper.subject);
    return subjects.find((s) => s.key === key)?.papers ?? [];
  }, [openPaper, subjects]);

  // A subject chosen via search/deep link skips the semester step.
  const needsSemester = Boolean(course) && !semester && subjectKeys.size === 0;

  function pickCourse(name: string | null) {
    setCourse(name);
    setSemester(null);
    setSubjectKeys(new Set());
    setOpenPaperId(null);
    setExpanded(new Set());
    setSubjectSearch("");
  }
  function pickSemester(label: string) {
    setSemester(label);
    setSubjectKeys(new Set());
    setOpenPaperId(null);
    setExpanded(new Set());
  }
  function pickSearchHit(hit: SearchHit) {
    setQuery("");
    setCourse(hit.course);
    setSemester(ALL_SEMESTERS);
    setSubjectKeys(new Set([hit.key]));
    setExpanded(new Set([hit.key]));
    setOpenPaperId(null);
  }
  function openPaperView(id: string) {
    setOpenPaperId(id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const totalPapers = index?.reduce((n, c) => n + c.count, 0) ?? 0;

  if (!index || !overrides) {
    return <div className="h-72 animate-pulse rounded-2xl border border-border bg-surface" />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4">
      <Breadcrumbs
        course={course}
        semester={semester}
        onAllCourses={() => pickCourse(null)}
        onSemesters={() => {
          setSemester(null);
          setSubjectKeys(new Set());
          setOpenPaperId(null);
        }}
      />

      {/* ── Paper viewer: only mounts after the student clicks a paper ── */}
      {openPaperId && coursePapers && (
        openPaper ? (
          <PaperViewer
            paper={openPaper}
            siblings={openPaperSiblings}
            onSelect={setOpenPaperId}
            onClose={() => setOpenPaperId(null)}
          />
        ) : (
          <EmptyState title="That paper isn't available any more" action="Back to papers" onAction={() => setOpenPaperId(null)} />
        )
      )}

      {!course && query && (
        <Panel step="Search" title={`Subjects matching “${query}”`}>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
          >
            <X size={12} weight="bold" /> Clear search and pick a course instead
          </button>
          {!searchRows ? (
            <ListSkeleton />
          ) : searchHits.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No subject matches “{query}”.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {searchHits.map((h) => (
                <button
                  key={`${h.course}-${h.key}`}
                  type="button"
                  onClick={() => pickSearchHit(h)}
                  className="flex w-full items-center justify-between gap-3 px-1 py-2.5 text-left transition hover:bg-surface-muted"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-foreground">{h.label}</span>
                    <span className="block truncate text-xs text-muted">{h.course}</span>
                  </span>
                  <span className="shrink-0 text-xs font-semibold text-muted">{h.count} papers</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
      )}

      {/* ── Step 1: course ── */}
      {!course && !query && (
        <Panel step="Step 1 of 2" title="Choose your course" subtitle={`${totalPapers.toLocaleString("en-IN")} papers across ${courses.length} DU programmes`}>
          <SearchInput value={courseSearch} onChange={setCourseSearch} placeholder="Search course, e.g. B.Com (Hons)…" />
          <div className="mt-3 grid max-h-[60vh] grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2 [scrollbar-width:thin]">
            {courses
              .filter((c) => looseMatch(c.name, courseSearch))
              .map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => pickCourse(c.name)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-2.5 text-left text-sm transition hover:border-accent hover:bg-accent-soft"
                >
                  <span className="min-w-0 truncate font-medium text-foreground" title={c.name}>
                    {c.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted">{c.count}</span>
                </button>
              ))}
          </div>
        </Panel>
      )}

      {course && !coursePapers && <ListSkeleton />}

      {/* ── Step 2: semester ── */}
      {course && coursePapers && needsSemester && (
        <Panel step="Step 2 of 2" title="Choose semester" subtitle={course}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {semesters.map((s) => (
              <button
                key={s.label}
                type="button"
                onClick={() => pickSemester(s.label)}
                className="rounded-xl border border-border bg-surface px-3 py-3 text-left transition hover:border-accent hover:bg-accent-soft"
              >
                <span className="block text-sm font-bold text-foreground">{s.label}</span>
                <span className="text-[11px] text-muted">{s.count} papers</span>
              </button>
            ))}
            <button
              type="button"
              onClick={() => pickSemester(ALL_SEMESTERS)}
              className="rounded-xl border border-dashed border-border px-3 py-3 text-left transition hover:border-accent hover:bg-accent-soft"
            >
              <span className="block text-sm font-bold text-foreground">All semesters</span>
              <span className="text-[11px] text-muted">{coursePapers.length} papers</span>
            </button>
          </div>
        </Panel>
      )}

      {/* ── Papers list: subjects → papers; nothing loads until clicked ── */}
      {course && coursePapers && !needsSemester && !openPaperId && (
        <Panel
          step={semester === ALL_SEMESTERS || !semester ? "All semesters" : semester}
          title={subjectKeys.size === 1 ? visibleSubjects[0]?.label ?? "Papers" : "Pick a paper to open"}
          subtitle={`${course} · ${visibleSubjects.length} subject${visibleSubjects.length === 1 ? "" : "s"}`}
        >
          <div className="mb-3 flex flex-wrap items-center gap-2">
            {semesters.length > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {[{ label: ALL_SEMESTERS, count: coursePapers.length }, ...semesters].map((s) => (
                  <button
                    key={s.label}
                    type="button"
                    onClick={() => pickSemester(s.label)}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                      (semester ?? ALL_SEMESTERS) === s.label
                        ? "bg-accent text-white"
                        : "bg-surface-muted text-muted hover:text-foreground"
                    }`}
                  >
                    {s.label === ALL_SEMESTERS ? "All" : s.label.replace("Semester ", "Sem ")}
                  </button>
                ))}
              </div>
            )}
          </div>
          {subjectKeys.size > 0 ? (
            <button
              type="button"
              onClick={() => setSubjectKeys(new Set())}
              className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline"
            >
              <X size={12} weight="bold" /> Show all subjects in this {semester && semester !== ALL_SEMESTERS ? "semester" : "course"}
            </button>
          ) : (
            subjects.length > 8 && (
              <div className="mb-3">
                <SearchInput value={subjectSearch} onChange={setSubjectSearch} placeholder="Search subject…" />
              </div>
            )
          )}

          {visibleSubjects.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">No papers here yet.</p>
          ) : (
            <div className="space-y-2">
              {visibleSubjects.map((s) => {
                const isOpen = expanded.has(s.key) || visibleSubjects.length === 1;
                return (
                  <div key={s.key} className="overflow-hidden rounded-xl border border-border bg-surface">
                    <button
                      type="button"
                      onClick={() => setExpanded((e) => toggle(e, s.key))}
                      aria-expanded={isOpen}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-3 text-left transition hover:bg-surface-muted"
                    >
                      <span className="min-w-0 text-sm font-semibold text-foreground">{s.label}</span>
                      <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
                        {s.papers.length} paper{s.papers.length === 1 ? "" : "s"}
                        <CaretDown size={14} weight="bold" className={`transition ${isOpen ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {isOpen && (
                      <ul className="divide-y divide-border/60 border-t border-border">
                        {s.papers.map((p) => (
                          <PaperRow key={p.id} paper={p} onOpen={() => openPaperView(p.id)} />
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}

function Breadcrumbs({
  course,
  semester,
  onAllCourses,
  onSemesters,
}: {
  course: string | null;
  semester: string | null;
  onAllCourses: () => void;
  onSemesters: () => void;
}) {
  if (!course) return null;
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted">
      <button type="button" onClick={onAllCourses} className="inline-flex items-center gap-1 hover:text-accent">
        <ArrowLeft size={12} weight="bold" /> All courses
      </button>
      <span>/</span>
      <button type="button" onClick={onSemesters} className="max-w-[60vw] truncate hover:text-accent">
        {course}
      </button>
      {semester && (
        <>
          <span>/</span>
          <span className="text-foreground">{semester === ALL_SEMESTERS ? "All semesters" : semester}</span>
        </>
      )}
    </nav>
  );
}

function Panel({
  step,
  title,
  subtitle,
  children,
}: {
  step: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 shadow-2xs sm:p-5">
      <p className="text-[11px] font-bold uppercase tracking-wider text-accent">{step}</p>
      <h2 className="mt-1 text-lg font-bold leading-snug text-foreground sm:text-xl">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted sm:text-sm">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative">
      <MagnifyingGlass size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent"
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div className="space-y-2 rounded-2xl border border-border bg-surface p-5">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-xl bg-surface-muted" />
      ))}
    </div>
  );
}

function EmptyState({ title, action, onAction }: { title: string; action: string; onAction: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      <button type="button" onClick={onAction} className="text-xs font-semibold text-accent hover:underline">
        {action}
      </button>
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

function PaperRow({ paper, onOpen }: { paper: CatalogPaper; onOpen: () => void }) {
  const note = cleanNote(paper);
  return (
    <li className="flex items-center gap-2 px-3.5 py-2.5">
      <button type="button" onClick={onOpen} className="group flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <FilePdf size={18} weight="duotone" className="shrink-0 text-accent" />
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground group-hover:text-accent">
            {paper.yearRange}
            <CollegeBadges paper={paper} />
          </span>
          <span className="block truncate text-[11px] text-muted">
            {semesterLabel(paper)}
            {note && ` · ${note}`}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-lg bg-accent-soft px-2.5 py-1.5 text-xs font-bold text-accent transition hover:bg-accent hover:text-white"
      >
        View
      </button>
      <a
        href={paper.pdfUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open in new tab"
        className="shrink-0 rounded-lg border border-border p-1.5 text-muted transition hover:border-accent hover:text-accent"
      >
        <ArrowSquareOut size={14} weight="bold" />
      </a>
    </li>
  );
}

function PaperViewer({
  paper,
  siblings,
  onSelect,
  onClose,
}: {
  paper: CatalogPaper;
  siblings: CatalogPaper[];
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <section className="space-y-3">
      <button
        type="button"
        onClick={onClose}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-semibold text-foreground shadow-2xs transition hover:border-accent hover:text-accent"
      >
        <ArrowLeft size={13} weight="bold" /> Back to papers
      </button>

      <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 shadow-2xs sm:p-5">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-md bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
            {paper.course || "General"}
          </span>
          <h2 className="mt-1.5 text-lg font-bold leading-snug text-foreground sm:text-xl">{paper.subject}</h2>
          <p className="mt-1 text-xs text-muted sm:text-sm">
            {semesterLabel(paper)} · <span className="font-medium text-foreground">{paper.yearRange}</span>
            {cleanNote(paper) && ` · ${cleanNote(paper)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <CopyButton
            text={typeof window === "undefined" ? "" : window.location.href}
            label="Copy link"
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted shadow-2xs transition hover:border-accent hover:text-accent"
          />
          <a
            href={paper.pdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted shadow-2xs transition hover:border-accent hover:text-accent"
          >
            <ArrowSquareOut size={14} weight="bold" />
            <span className="hidden sm:inline">Open in new tab</span>
          </a>
          <a
            href={paper.pdfUrl}
            download
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground shadow-2xs transition hover:bg-brand-hover"
          >
            <DownloadSimple size={14} weight="bold" />
            <span>Download</span>
          </a>
        </div>
      </div>

      {siblings.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
          <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">Other years:</span>
          {siblings.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelect(p.id)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                p.id === paper.id
                  ? "bg-accent text-white shadow-2xs ring-2 ring-accent/20"
                  : "bg-surface-muted text-muted hover:bg-border/60 hover:text-foreground"
              }`}
            >
              {p.yearRange}
              {cleanNote(p) && <span className="max-w-32 truncate text-[11px] opacity-75">{cleanNote(p)}</span>}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
        <div className="flex items-center justify-between border-b border-border bg-surface-muted/60 px-3.5 py-2">
          <span className="truncate text-xs font-medium text-foreground">{fileName(paper)}</span>
        </div>
        {isFrameBlocked(paper.pdfUrl) ? (
          <div className="flex h-[60vh] flex-col items-center justify-center gap-3 bg-surface-muted/50 px-6 text-center">
            <p className="text-sm text-muted">
              This paper&apos;s source site doesn&apos;t allow inline preview — open it directly instead.
            </p>
            <a
              href={paper.pdfUrl}
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
            key={paper.id}
            src={embeddableUrl(paper.pdfUrl)}
            title={fileName(paper)}
            className="h-[80vh] min-h-[560px] w-full bg-surface-muted/40"
          />
        )}
      </div>
    </section>
  );
}
