"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowSquareOut, DownloadSimple, MagnifyingGlass } from "@phosphor-icons/react";
import { CopyButton } from "@/components/pyq/copy-button";
import { NO_SEMESTER, semesterLabel, type CatalogPaper } from "@/lib/pyq-catalog-types";
import { canonicalCourseName, canonicalSubjectKey, preferredSubjectLabel } from "@/lib/subject-normalization";

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
// for our JS to detect it (X-Frame-Options blocks don't fire an error
// event; the load looks "successful" from the parent's perspective).
// Since it can't be detected after the fact, known offenders are listed
// here up front and skip straight to the "open externally" fallback.
// zhdce.ac.in confirmed via curl -I: `x-frame-options: DENY`.
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

// Falls back to the list's first entry when the candidate (e.g. a
// previously-picked year) no longer appears once the matching-papers set
// changes underneath it.
function resolve<T>(candidateKey: string | null, options: T[], key: (v: T) => string) {
  if (candidateKey && options.some((o) => key(o) === candidateKey)) {
    return options.find((o) => key(o) === candidateKey) ?? null;
  }
  return options[0] ?? null;
}

function toggle(set: Set<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

type Tab = "course" | "semester" | "subject";

const EMPTY_ARRAY: CatalogPaper[] = [];

export function PaperBrowser({ papers: initialPapers = EMPTY_ARRAY }: { papers?: CatalogPaper[] }) {
  const searchParams = useSearchParams();
  const requestedCourse = searchParams.get("course");
  const requestedQuery = searchParams.get("q");

  const [papers, setPapers] = useState<CatalogPaper[]>(initialPapers);
  const [loading, setLoading] = useState(initialPapers.length === 0);
  const [activeTab, setActiveTab] = useState<Tab>("course");
  const [courseSearch, setCourseSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedSemesters, setSelectedSemesters] = useState<Set<string>>(new Set());
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<Set<string>>(new Set());
  const [yearRange, setYearRange] = useState<string | null>(null);
  const [paperIndex, setPaperIndex] = useState(0);

  useEffect(() => {
    if (initialPapers.length > 0) {
      setPapers(initialPapers);
      setLoading(false);
      return;
    }

    let isMounted = true;
    Promise.all([
      fetch("/data/papers-catalog.json").then((res) => res.json()),
      fetch("/api/catalog-overrides").then((res) => res.json()).catch(() => []),
    ])
      .then(([papersData, overridesData]: [CatalogPaper[], any[]]) => {
        if (!isMounted) return;
        const overrideByKey = new Map<string, any>();
        for (const o of overridesData) {
          overrideByKey.set(`${o.course}\u0000${o.subjectKey}`, o);
        }
        const unified = papersData.map((p) => {
          const override = overrideByKey.get(`${p.course}\u0000${canonicalSubjectKey(p.subject)}`);
          if (override) {
            return {
              ...p,
              originalSubject: p.subject,
              subject: override.displayName || p.subject,
              semester: override.semesterOverride != null ? String(override.semesterOverride) : p.semester,
            };
          }
          return p;
        });
        setPapers(unified);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch papers catalog:", err);
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialPapers]);

  // Sync course from query parameter if provided
  useEffect(() => {
    if (requestedCourse && papers.length > 0) {
      const q = requestedCourse.trim().toLowerCase();
      // Look for direct match or substring match in papers
      const match = papers.find(
        (p) => (p.course || "").toLowerCase() === q ||
               (p.course || "").toLowerCase().includes(q) ||
               q.includes((p.course || "").toLowerCase())
      );
      if (match?.course) {
        setSelectedCourses(new Set([match.course]));
      } else {
        setSelectedCourses(new Set([requestedCourse]));
      }
    }
  }, [requestedCourse, papers]);

  // Sync free-text search from query parameter (e.g. from the header/hero
  // search bar) into the Subject tab's search box, and jump straight there.
  useEffect(() => {
    if (requestedQuery) {
      setSubjectSearch(requestedQuery);
      setActiveTab("subject");
    }
  }, [requestedQuery]);

  const courses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers) {
      const name = (p.course || "General / Interdisciplinary").trim();
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    let entries = [...counts.entries()];
    const q = courseSearch.trim().toLowerCase();
    if (q) entries = entries.filter(([name]) => name.toLowerCase().includes(q));
    return entries.map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [papers, courseSearch]);

  // Semester/Subject option lists respect whatever's already picked in the
  // *other* dimensions, but never their own — that's what makes this a
  // faceted filter (checking one course narrows the semester list; the
  // semester list itself isn't filtered by which semesters are checked).
  const semesters = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers) {
      const cName = (p.course || "General / Interdisciplinary").trim();
      if (selectedCourses.size > 0 && !selectedCourses.has(cName)) continue;
      const label = semesterLabel(p);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => semesterSortKey(a.label) - semesterSortKey(b.label));
  }, [papers, selectedCourses]);

  const subjects = useMemo(() => {
    const map = new Map<string, { labels: string[]; count: number }>();
    for (const p of papers) {
      const cName = (p.course || "General / Interdisciplinary").trim();
      if (selectedCourses.size > 0 && !selectedCourses.has(cName)) continue;
      if (selectedSemesters.size > 0 && !selectedSemesters.has(semesterLabel(p))) continue;
      const key = canonicalSubjectKey(p.subject);
      const entry = map.get(key) ?? { labels: [], count: 0 };
      entry.labels.push(p.subject);
      entry.count += 1;
      map.set(key, entry);
    }
    let entries = [...map.entries()];
    const q = subjectSearch.trim().toLowerCase();
    if (q) entries = entries.filter(([, { labels }]) => preferredSubjectLabel(labels).toLowerCase().includes(q));
    return entries
      .map(([key, { labels, count }]) => ({ key, label: preferredSubjectLabel(labels), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [papers, selectedCourses, selectedSemesters, subjectSearch]);

  const matchingPapers = useMemo(() => {
    if (selectedCourses.size === 0 && selectedSemesters.size === 0 && selectedSubjectKeys.size === 0) return papers;
    return papers.filter((p) => {
      const cName = (p.course || "General / Interdisciplinary").trim();
      if (selectedCourses.size > 0 && !selectedCourses.has(cName)) return false;
      if (selectedSemesters.size > 0 && !selectedSemesters.has(semesterLabel(p))) return false;
      if (selectedSubjectKeys.size > 0 && !selectedSubjectKeys.has(canonicalSubjectKey(p.subject))) return false;
      return true;
    });
  }, [papers, selectedCourses, selectedSemesters, selectedSubjectKeys]);

  const years = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of matchingPapers) counts.set(p.yearRange, (counts.get(p.yearRange) ?? 0) + 1);
    return [...counts.entries()]
      .map(([yr, count]) => ({ yearRange: yr, count }))
      .sort((a, b) => yearStart(b.yearRange) - yearStart(a.yearRange));
  }, [matchingPapers]);

  const effectiveYear = resolve(yearRange, years, (y) => y.yearRange)?.yearRange ?? null;

  const papersForYear = useMemo(() => {
    if (!effectiveYear) return [];
    return matchingPapers
      .filter((p) => p.yearRange === effectiveYear)
      .sort(
        (a, b) =>
          (a.course || "").localeCompare(b.course || "") ||
          a.subject.localeCompare(b.subject) ||
          fileName(a).localeCompare(fileName(b)),
      );
  }, [matchingPapers, effectiveYear]);

  const effectivePaperIndex = Math.min(paperIndex, Math.max(papersForYear.length - 1, 0));
  const selectedPaper = papersForYear[effectivePaperIndex] ?? null;

  function selectYear(yr: string) {
    setYearRange(yr);
    setPaperIndex(0);
  }
  function toggleCourse(name: string) {
    setSelectedCourses((s) => toggle(s, name));
    setYearRange(null);
    setPaperIndex(0);
  }
  function toggleSemester(label: string) {
    setSelectedSemesters((s) => toggle(s, label));
    setYearRange(null);
    setPaperIndex(0);
  }
  function toggleSubject(key: string) {
    setSelectedSubjectKeys((s) => toggle(s, key));
    setYearRange(null);
    setPaperIndex(0);
  }
  function clearAllFilters() {
    setSelectedCourses(new Set());
    setSelectedSemesters(new Set());
    setSelectedSubjectKeys(new Set());
    setYearRange(null);
    setPaperIndex(0);
  }

  const totalFiltersActive = selectedCourses.size + selectedSemesters.size + selectedSubjectKeys.size;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[290px_1fr] xl:grid-cols-[330px_1fr]">
        <div className="h-[600px] animate-pulse rounded-2xl border border-border bg-surface p-4" />
        <div className="h-[600px] animate-pulse rounded-2xl border border-border bg-surface p-6" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[290px_1fr] xl:grid-cols-[330px_1fr]">
      <aside className="flex flex-col lg:sticky lg:top-24 lg:h-[calc(100vh-7.5rem)]">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 className="text-sm font-bold tracking-tight text-foreground">Filters</h2>
          {totalFiltersActive > 0 && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs font-semibold text-accent hover:underline hover:text-accent-hover transition"
            >
              Clear all ({totalFiltersActive})
            </button>
          )}
        </div>

        <div className="flex rounded-xl border border-border/80 bg-surface-muted/80 p-1 text-sm shadow-2xs">
          <TabButton active={activeTab === "course"} onClick={() => setActiveTab("course")} label="Course" count={selectedCourses.size} />
          {/* Semester option hidden per user request */}
          {/* <TabButton active={activeTab === "semester"} onClick={() => setActiveTab("semester")} label="Semester" count={selectedSemesters.size} /> */}
          <TabButton active={activeTab === "subject"} onClick={() => setActiveTab("subject")} label="Subject" count={selectedSubjectKeys.size} />
        </div>

        <div className="mt-2.5 flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface p-3 shadow-2xs">
          {activeTab === "course" && (
            <FilterList
              searchPlaceholder="Search course…"
              search={courseSearch}
              onSearch={setCourseSearch}
              total={courses.length}
              empty={courses.length === 0}
            >
              {courses.map((c) => (
                <FilterCheckbox
                  key={c.name}
                  checked={selectedCourses.has(c.name)}
                  label={c.name}
                  count={c.count}
                  onClick={() => toggleCourse(c.name)}
                />
              ))}
            </FilterList>
          )}

          {/* Semester filter hidden */}
          {/* {activeTab === "semester" && (
            <FilterList total={semesters.length} empty={semesters.length === 0}>
              {semesters.map((s) => (
                <FilterCheckbox
                  key={s.label}
                  checked={selectedSemesters.has(s.label)}
                  label={s.label}
                  count={s.count}
                  onClick={() => toggleSemester(s.label)}
                />
              ))}
            </FilterList>
          )} */}

          {activeTab === "subject" && (
            <FilterList
              searchPlaceholder="Search subject…"
              search={subjectSearch}
              onSearch={setSubjectSearch}
              total={subjects.length}
              empty={subjects.length === 0}
            >
              {subjects.map((s) => (
                <FilterCheckbox
                  key={s.key}
                  checked={selectedSubjectKeys.has(s.key)}
                  label={s.label}
                  count={s.count}
                  onClick={() => toggleSubject(s.key)}
                />
              ))}
            </FilterList>
          )}
        </div>
      </aside>

      <main className="min-w-0">
        <div className="mb-2.5 flex items-center justify-between">
          <p className="text-xs font-medium text-muted">
            <span className="font-semibold text-foreground">{matchingPapers.length.toLocaleString()}</span> of{" "}
            {papers.length.toLocaleString()} papers match your filters
          </p>
          {totalFiltersActive > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted">
              Active filters: <strong className="text-foreground">{totalFiltersActive}</strong>
            </span>
          )}
        </div>

        {!selectedPaper ? (
          <div className="flex h-[450px] flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-surface/50 p-6 text-center">
            <p className="text-sm font-medium text-foreground">No papers match this selection</p>
            <p className="text-xs text-muted">Try clearing some filters or selecting another course/semester/subject.</p>
            {totalFiltersActive > 0 && (
              <button
                type="button"
                onClick={clearAllFilters}
                className="mt-2 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-brand-foreground shadow-sm transition hover:bg-brand-hover"
              >
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-surface p-4 sm:p-5 shadow-2xs">
              <div className="min-w-0 flex-1">
                <span className="inline-block rounded-md bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                  {selectedPaper.course || "General"}
                </span>
                <h2 className="mt-1.5 text-lg sm:text-xl font-bold text-foreground leading-snug">
                  {selectedPaper.subject}
                </h2>
                <p className="mt-1 text-xs sm:text-sm text-muted">
                  {semesterLabel(selectedPaper)} · <span className="font-medium text-foreground">{selectedPaper.yearRange}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <CopyButtonClient />
                <a
                  href={selectedPaper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-accent shadow-2xs"
                >
                  <ArrowSquareOut size={14} weight="bold" />
                  <span className="hidden sm:inline">Open in new tab</span>
                </a>
                <a
                  href={selectedPaper.pdfUrl}
                  download
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground shadow-2xs transition hover:bg-brand-hover"
                >
                  <DownloadSimple size={14} weight="bold" />
                  <span>Download</span>
                </a>
              </div>
            </div>

            {/* Year selector pills */}
            <div className="mt-3.5">
              <div className="flex items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wider text-muted">Years:</span>
                {years.map((y) => (
                  <button
                    key={y.yearRange}
                    type="button"
                    onClick={() => selectYear(y.yearRange)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
                      y.yearRange === effectiveYear
                        ? "bg-accent text-white shadow-2xs ring-2 ring-accent/20"
                        : "bg-surface-muted text-muted hover:bg-border/60 hover:text-foreground"
                    }`}
                  >
                    {y.yearRange}
                    <span className="ml-1.5 text-[11px] opacity-75">{y.count}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Multiple papers in same year */}
            {papersForYear.length > 1 && (
              <div className="mt-2.5">
                {papersForYear.length <= 10 ? (
                  <div className="flex flex-wrap gap-2">
                    {papersForYear.map((p, i) => {
                      const isShiv = p.isShivaji || p.college === "Shivaji";
                      const isKal = p.isKalindi || p.college === "Kalindi";
                      const isAnd = p.isANDC || p.college === "ANDC";
                      const isRam = p.isRamanujan || p.college === "Ramanujan";
                      
                      let cleanNoteStr = p.note ?? `Paper ${i + 1}`;
                      // Remove college labels from the note to save space
                      cleanNoteStr = cleanNoteStr
                        .replace(/\[S\]\s*Shivaji\s*\|?\s*/gi, "")
                        .replace(/\[K\]\s*Kalindi\s*\|?\s*/gi, "")
                        .replace(/\[A\]\s*ANDC\s*\|?\s*/gi, "")
                        .replace(/\[R\]\s*Ramanujan\s*\|?\s*/gi, "")
                        .replace(/\[S\]\s*Shivaji/gi, "")
                        .replace(/\[K\]\s*Kalindi/gi, "")
                        .replace(/\[A\]\s*ANDC/gi, "")
                        .replace(/\[R\]\s*Ramanujan/gi, "")
                        .replace(/^\|\s*/, "") // Clean leading pipes
                        .trim();
                        
                      if (!cleanNoteStr) cleanNoteStr = `Paper ${i + 1}`;

                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPaperIndex(i)}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-xs font-semibold transition ${
                            i === effectivePaperIndex
                              ? "border-accent bg-accent-soft text-accent shadow-2xs"
                              : "border-border bg-surface text-muted hover:border-border/80 hover:text-foreground"
                          }`}
                        >
                          <span>{cleanNoteStr}</span>
                          {isShiv && (
                            <span
                              className="px-1 py-px text-[9px] font-black tracking-tight rounded bg-emerald-500 text-emerald-950 uppercase"
                              title="Shivaji College Archive"
                            >
                              S
                            </span>
                          )}
                          {isKal && (
                            <span
                              className="px-1 py-px text-[9px] font-black tracking-tight rounded bg-rose-500 text-white uppercase"
                              title="Kalindi College Archive"
                            >
                              K
                            </span>
                          )}
                          {isAnd && (
                            <span
                              className="px-1 py-px text-[9px] font-black tracking-tight rounded bg-blue-500 text-white uppercase"
                              title="Acharya Narendra Dev College (ANDC) Archive"
                            >
                              A
                            </span>
                          )}
                          {isRam && (
                            <span
                              className="px-1 py-px text-[9px] font-black tracking-tight rounded bg-amber-500 text-amber-950 uppercase"
                              title="Ramanujan College Archive"
                            >
                              R
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-surface p-1.5 shadow-2xs">
                    {papersForYear.map((p, i) => {
                      const isShiv = p.isShivaji || p.college === "Shivaji";
                      const isKal = p.isKalindi || p.college === "Kalindi";
                      const isAnd = p.isANDC || p.college === "ANDC";
                      const isRam = p.isRamanujan || p.college === "Ramanujan";
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setPaperIndex(i)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs transition ${
                            i === effectivePaperIndex
                              ? "bg-accent-soft font-bold text-accent"
                              : "text-foreground hover:bg-surface-muted"
                          }`}
                        >
                          <span className="truncate flex items-center gap-1.5">
                            {p.course} · {p.subject}
                            {isShiv && (
                              <span
                                className="shrink-0 px-1 py-px text-[9px] font-black tracking-tight rounded bg-emerald-500 text-emerald-950 uppercase"
                                title="Shivaji College Archive"
                              >
                                S
                              </span>
                            )}
                            {isKal && (
                              <span
                                className="shrink-0 px-1 py-px text-[9px] font-black tracking-tight rounded bg-rose-500 text-white uppercase"
                                title="Kalindi College Archive"
                              >
                                K
                              </span>
                            )}
                            {isAnd && (
                              <span
                                className="shrink-0 px-1 py-px text-[9px] font-black tracking-tight rounded bg-blue-500 text-white uppercase"
                                title="Acharya Narendra Dev College (ANDC) Archive"
                              >
                                A
                              </span>
                            )}
                            {isRam && (
                              <span
                                className="shrink-0 px-1 py-px text-[9px] font-black tracking-tight rounded bg-amber-500 text-amber-950 uppercase"
                                title="Ramanujan College Archive"
                              >
                                R
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 text-muted">{p.note ?? fileName(p)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Embedded PDF iframe viewer */}
            <div className="mt-3.5 overflow-hidden rounded-2xl border border-border bg-surface shadow-xs">
              <div className="flex items-center justify-between border-b border-border bg-surface-muted/60 px-3.5 py-2">
                <div className="flex items-center gap-2 truncate text-xs text-muted">
                  <span className="truncate font-medium text-foreground">{fileName(selectedPaper)}</span>
                  {selectedPaper.note && <span>· {selectedPaper.note}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <a
                    href={selectedPaper.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:text-accent shadow-2xs"
                  >
                    <ArrowSquareOut size={13} weight="bold" />
                    Open tab
                  </a>
                  <a
                    href={selectedPaper.pdfUrl}
                    download
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1 text-xs font-medium text-muted transition hover:text-accent shadow-2xs"
                  >
                    <DownloadSimple size={13} weight="bold" />
                    Save
                  </a>
                </div>
              </div>
              {isFrameBlocked(selectedPaper.pdfUrl) ? (
                <div className="flex h-[78vh] min-h-[640px] flex-col items-center justify-center gap-3 bg-surface-muted/50 px-6 text-center">
                  <p className="text-sm text-muted">
                    This paper&apos;s source site doesn&apos;t allow inline preview — open it directly instead.
                  </p>
                  <a
                    href={selectedPaper.pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 shadow-sm"
                  >
                    <ArrowSquareOut size={14} weight="bold" />
                    Open PDF
                  </a>
                </div>
              ) : (
                <iframe
                  key={selectedPaper.id}
                  src={embeddableUrl(selectedPaper.pdfUrl)}
                  title={fileName(selectedPaper)}
                  className="h-[80vh] min-h-[640px] w-full bg-surface-muted/40"
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

// Isolated so `window.location.href` is only ever read client-side, inside
// the click handler CopyButton already guards — never during render.
function CopyButtonClient() {
  return (
    <CopyButton
      text={typeof window === "undefined" ? "" : window.location.href}
      label="Copy link"
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition hover:border-accent hover:text-accent shadow-2xs"
    />
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
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-xs sm:text-sm text-foreground outline-none focus:border-accent"
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
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs sm:text-sm transition ${
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
