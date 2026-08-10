"use client";

import { useMemo, useState, type ReactNode } from "react";
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

// Given a candidate value and the list it should belong to, falls back to
// the list's first entry when the candidate is stale (e.g. selecting a new
// course invalidates whichever subject was picked under the old one) —
// this is what makes the four filters cascade correctly without a tangle
// of useEffects resetting each other in sequence.
function resolve<T>(candidateKey: string | null, options: T[], key: (v: T) => string) {
  if (candidateKey && options.some((o) => key(o) === candidateKey)) {
    return options.find((o) => key(o) === candidateKey) ?? null;
  }
  return options[0] ?? null;
}

export function PaperBrowser({ papers }: { papers: CatalogPaper[] }) {
  const [search, setSearch] = useState("");
  const [course, setCourse] = useState<string | null>(null);
  const [semester, setSemester] = useState<string | null>(null);
  const [subjectKey, setSubjectKey] = useState<string | null>(null);
  const [yearRange, setYearRange] = useState<string | null>(null);
  const [paperIndex, setPaperIndex] = useState(0);

  const courses = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of papers) {
      const name = canonicalCourseName(p.course);
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    let entries = [...counts.entries()];
    const q = search.trim().toLowerCase();
    if (q) entries = entries.filter(([name]) => name.toLowerCase().includes(q));
    return entries
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [papers, search]);

  const effectiveCourse = resolve(course, courses, (c) => c.name)?.name ?? null;

  const semesters = useMemo(() => {
    if (!effectiveCourse) return [];
    const counts = new Map<string, number>();
    for (const p of papers) {
      if (canonicalCourseName(p.course) !== effectiveCourse) continue;
      const label = semesterLabel(p);
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => semesterSortKey(a.label) - semesterSortKey(b.label));
  }, [papers, effectiveCourse]);

  const effectiveSemester = resolve(semester, semesters, (s) => s.label)?.label ?? null;

  const subjects = useMemo(() => {
    if (!effectiveCourse || !effectiveSemester) return [];
    const map = new Map<string, { labels: string[]; count: number }>();
    for (const p of papers) {
      if (canonicalCourseName(p.course) !== effectiveCourse) continue;
      if (semesterLabel(p) !== effectiveSemester) continue;
      const key = canonicalSubjectKey(p.subject);
      const entry = map.get(key) ?? { labels: [], count: 0 };
      entry.labels.push(p.subject);
      entry.count += 1;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([key, { labels, count }]) => ({ key, label: preferredSubjectLabel(labels), count }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [papers, effectiveCourse, effectiveSemester]);

  const effectiveSubjectKey = resolve(subjectKey, subjects, (s) => s.key)?.key ?? null;
  const effectiveSubjectLabel = subjects.find((s) => s.key === effectiveSubjectKey)?.label ?? null;

  const years = useMemo(() => {
    if (!effectiveCourse || !effectiveSemester || !effectiveSubjectKey) return [];
    const counts = new Map<string, number>();
    for (const p of papers) {
      if (canonicalCourseName(p.course) !== effectiveCourse) continue;
      if (semesterLabel(p) !== effectiveSemester) continue;
      if (canonicalSubjectKey(p.subject) !== effectiveSubjectKey) continue;
      counts.set(p.yearRange, (counts.get(p.yearRange) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([yr, count]) => ({ yearRange: yr, count }))
      .sort((a, b) => yearStart(b.yearRange) - yearStart(a.yearRange));
  }, [papers, effectiveCourse, effectiveSemester, effectiveSubjectKey]);

  const effectiveYear = resolve(yearRange, years, (y) => y.yearRange)?.yearRange ?? null;

  const papersForYear = useMemo(() => {
    if (!effectiveCourse || !effectiveSemester || !effectiveSubjectKey || !effectiveYear) return [];
    return papers
      .filter(
        (p) =>
          canonicalCourseName(p.course) === effectiveCourse &&
          semesterLabel(p) === effectiveSemester &&
          canonicalSubjectKey(p.subject) === effectiveSubjectKey &&
          p.yearRange === effectiveYear,
      )
      .sort((a, b) => fileName(a).localeCompare(fileName(b)));
  }, [papers, effectiveCourse, effectiveSemester, effectiveSubjectKey, effectiveYear]);

  const effectivePaperIndex = Math.min(paperIndex, Math.max(papersForYear.length - 1, 0));
  const selectedPaper = papersForYear[effectivePaperIndex] ?? null;

  function selectCourse(name: string) {
    setCourse(name);
    setSemester(null);
    setSubjectKey(null);
    setYearRange(null);
    setPaperIndex(0);
  }
  function selectSemester(label: string) {
    setSemester(label);
    setSubjectKey(null);
    setYearRange(null);
    setPaperIndex(0);
  }
  function selectSubject(key: string) {
    setSubjectKey(key);
    setYearRange(null);
    setPaperIndex(0);
  }
  function selectYear(yr: string) {
    setYearRange(yr);
    setPaperIndex(0);
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
      <aside className="space-y-6 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)] lg:self-start lg:overflow-y-auto">
        <div className="relative">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search course…"
            className="w-full rounded-xl border border-border bg-surface py-2 pl-9 pr-3 text-sm text-foreground outline-none focus:border-accent"
          />
        </div>

        <FilterSection title="Course" total={courses.length}>
          {courses.map((c) => (
            <FilterItem key={c.name} active={c.name === effectiveCourse} label={c.name} count={c.count} onClick={() => selectCourse(c.name)} />
          ))}
          {courses.length === 0 && <p className="px-2.5 py-1.5 text-sm text-muted">No matches.</p>}
        </FilterSection>

        {semesters.length > 0 && (
          <FilterSection title="Semester" total={semesters.length}>
            {semesters.map((s) => (
              <FilterItem key={s.label} active={s.label === effectiveSemester} label={s.label} count={s.count} onClick={() => selectSemester(s.label)} />
            ))}
          </FilterSection>
        )}

        {subjects.length > 0 && (
          <FilterSection title="Subject" total={subjects.length}>
            {subjects.map((s) => (
              <FilterItem key={s.key} active={s.key === effectiveSubjectKey} label={s.label} count={s.count} onClick={() => selectSubject(s.key)} />
            ))}
          </FilterSection>
        )}
      </aside>

      <main className="min-w-0">
        {!selectedPaper ? (
          <div className="flex h-[420px] items-center justify-center rounded-2xl border border-dashed border-border text-sm text-muted">
            No papers match this selection.
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-border bg-surface p-5">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-accent">{effectiveCourse}</p>
                <h2 className="mt-1 truncate text-xl font-semibold text-foreground">{effectiveSubjectLabel}</h2>
                <p className="mt-1 text-sm text-muted">
                  {effectiveSemester} · {effectiveYear}
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
                </button>
              ))}
            </div>

            {papersForYear.length > 1 && (
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
            )}

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

function FilterSection({ title, total, children }: { title: string; total: number; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h3>
        <span className="text-xs text-muted">{total}</span>
      </div>
      {/* Tall enough to show ~13 items before scrolling, with a visible
          scrollbar (not the near-invisible default) — course lists here
          run to 100+ entries, so it must be obvious there's more below
          rather than looking like a short, complete list. */}
      <div className="max-h-[26rem] space-y-0.5 overflow-y-auto pr-1 [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin]">
        {children}
      </div>
    </div>
  );
}

function FilterItem({ active, label, count, onClick }: { active: boolean; label: string; count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
        active ? "bg-accent-soft font-medium text-accent" : "text-foreground hover:bg-surface-muted"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className="shrink-0 text-xs text-muted">{count}</span>
    </button>
  );
}
