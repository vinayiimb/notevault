"use client";

import { useMemo, useState } from "react";
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

export function PaperBrowser({ papers }: { papers: CatalogPaper[] }) {
  const [activeTab, setActiveTab] = useState<Tab>("course");
  const [courseSearch, setCourseSearch] = useState("");
  const [subjectSearch, setSubjectSearch] = useState("");
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedSemesters, setSelectedSemesters] = useState<Set<string>>(new Set());
  const [selectedSubjectKeys, setSelectedSubjectKeys] = useState<Set<string>>(new Set());
  const [yearRange, setYearRange] = useState<string | null>(null);
  const [paperIndex, setPaperIndex] = useState(0);

  const courses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers) {
      const name = canonicalCourseName(p.course);
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
      if (selectedCourses.size > 0 && !selectedCourses.has(canonicalCourseName(p.course))) continue;
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
      if (selectedCourses.size > 0 && !selectedCourses.has(canonicalCourseName(p.course))) continue;
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
      if (selectedCourses.size > 0 && !selectedCourses.has(canonicalCourseName(p.course))) return false;
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
          canonicalCourseName(a.course).localeCompare(canonicalCourseName(b.course)) ||
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

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="flex flex-col lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Filters</h2>
          {totalFiltersActive > 0 && (
            <button type="button" onClick={clearAllFilters} className="text-xs font-medium text-accent hover:underline">
              Clear all ({totalFiltersActive})
            </button>
          )}
        </div>

        <div className="flex rounded-xl border border-border bg-surface-muted p-1 text-sm">
          <TabButton active={activeTab === "course"} onClick={() => setActiveTab("course")} label="Course" count={selectedCourses.size} />
          <TabButton active={activeTab === "semester"} onClick={() => setActiveTab("semester")} label="Semester" count={selectedSemesters.size} />
          <TabButton active={activeTab === "subject"} onClick={() => setActiveTab("subject")} label="Subject" count={selectedSubjectKeys.size} />
        </div>

        <div className="mt-3 flex min-h-0 flex-1 flex-col rounded-2xl border border-border bg-surface p-3">
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

          {activeTab === "semester" && (
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
          )}

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
        <p className="mb-3 text-xs text-muted">
          {matchingPapers.length.toLocaleString()} of {papers.length.toLocaleString()} papers match your filters
        </p>

        {!selectedPaper ? (
          <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted">
            No papers match this selection.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">{canonicalCourseName(selectedPaper.course)}</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-foreground">{selectedPaper.subject}</h2>
                <p className="mt-1 text-sm text-muted">
                  {semesterLabel(selectedPaper)} · {selectedPaper.yearRange}
                </p>
              </div>
              <CopyButtonClient />
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {years.map((y) => (
                <button
                  key={y.yearRange}
                  type="button"
                  onClick={() => selectYear(y.yearRange)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                    y.yearRange === effectiveYear ? "bg-accent text-white" : "bg-surface-muted text-muted hover:text-foreground"
                  }`}
                >
                  {y.yearRange}
                  <span className="ml-1.5 text-xs opacity-70">{y.count}</span>
                </button>
              ))}
            </div>

            {papersForYear.length > 1 &&
              (papersForYear.length <= 10 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {papersForYear.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaperIndex(i)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        i === effectivePaperIndex ? "border-accent text-accent" : "border-border text-muted hover:text-foreground"
                      }`}
                    >
                      {p.note ?? `Paper ${i + 1}`}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="mt-2 max-h-40 space-y-0.5 overflow-y-auto rounded-xl border border-border p-1.5">
                  {papersForYear.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPaperIndex(i)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition ${
                        i === effectivePaperIndex ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-surface-muted"
                      }`}
                    >
                      <span className="truncate">
                        {canonicalCourseName(p.course)} · {p.subject}
                      </span>
                      <span className="shrink-0 text-muted">{p.note ?? fileName(p)}</span>
                    </button>
                  ))}
                </div>
              ))}

            {/* An <iframe> rather than the pdf.js-based PDFViewer used
                elsewhere on the site — most of this unified archive's
                sources (college library sites, the DU exam portal, Drive
                links) send no CORS headers, so pdf.js's in-page fetch gets
                silently blocked and the viewer never renders. Framing
                isn't subject to CORS the way a JS fetch is, so this works
                across every source; the tradeoff is losing PDFViewer's
                custom zoom/page controls in favor of the browser's own
                built-in PDF viewer inside the frame. */}
            <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
              <div className="flex items-center justify-end gap-2 border-b border-border bg-surface-muted px-3 py-2">
                <a
                  href={selectedPaper.pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-accent"
                >
                  <ArrowSquareOut size={14} weight="bold" />
                  Open in new tab
                </a>
                <a
                  href={selectedPaper.pdfUrl}
                  download
                  className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-accent"
                >
                  <DownloadSimple size={14} weight="bold" />
                  Download
                </a>
              </div>
              <iframe
                key={selectedPaper.id}
                src={embeddableUrl(selectedPaper.pdfUrl)}
                title={fileName(selectedPaper)}
                className="h-[75vh] w-full bg-surface-muted/50"
              />
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              <span>{fileName(selectedPaper)}</span>
              {selectedPaper.note && <span>· {selectedPaper.note}</span>}
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
      className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium text-muted transition hover:text-accent"
    />
  );
}

function TabButton({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${
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
            className="w-full rounded-lg border border-border bg-surface py-1.5 pl-8 pr-2 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>
      )}
      <p className="mb-1.5 shrink-0 text-xs text-muted">{total} total</p>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pr-1 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]">
        {children}
        {empty && <p className="px-2.5 py-1.5 text-sm text-muted">No matches.</p>}
      </div>
    </div>
  );
}

function FilterCheckbox({ checked, label, count, onClick }: { checked: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition ${
        checked ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-surface-muted"
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
      <span className="shrink-0 text-xs text-muted">{count}</span>
    </button>
  );
}
