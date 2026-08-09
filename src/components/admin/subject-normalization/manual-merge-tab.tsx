"use client";

import { useState, useTransition } from "react";
import { MagnifyingGlass, Warning, ListMagnifyingGlass } from "@phosphor-icons/react";
import {
  searchArchiveSubjectsForManualMergeAction,
  manualMergeCatalogSubjectsAction,
} from "@/lib/actions";
import type { ArchiveManualMergeRow } from "@/lib/archive-customize-data";

// Manual merge tool for the Full Archive (CatalogPaperUpload + static
// catalog + Drive/NoteVault-derived papers) — deliberately separate from
// the Program/Subject-FK data the AI Similarity Review tab works with.
// Spans every course at once (search by name) or one course at a time,
// instead of requiring a per-course admin page like archive-customize does.
export function ManualMergeTab({ courses }: { courses: string[] }) {
  const [pending, startTransition] = useTransition();
  const [course, setCourse] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ArchiveManualMergeRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [heading, setHeading] = useState("");
  const [semester, setSemester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedCourses = new Set(results.filter((r) => selected.has(r.subjectKey)).map((r) => r.course));
  const crossCourseSelection = selectedCourses.size > 1;

  function runSearch() {
    setError(null);
    setDone(false);
    startTransition(async () => {
      try {
        const rows = await searchArchiveSubjectsForManualMergeAction({
          course: course || undefined,
          query,
        });
        setResults(rows);
        setSearched(true);
        setSelected(new Set());
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
      }
    });
  }

  function toggle(subjectKey: string) {
    setDone(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  }

  function submitMerge() {
    setError(null);
    const rows = results.filter((r) => selected.has(r.subjectKey));
    if (rows.length < 2) {
      setError("Pick at least two subjects to merge.");
      return;
    }
    const distinctCourses = new Set(rows.map((r) => r.course));
    if (distinctCourses.size > 1) {
      setError("Selected subjects must all be from the same course — the Full Archive can't merge across courses.");
      return;
    }
    if (!heading.trim()) {
      setError("Type a heading for the merged group.");
      return;
    }
    const targetCourse = rows[0].course;
    const targetCourseSlug = rows[0].courseSlug;
    startTransition(async () => {
      try {
        await manualMergeCatalogSubjectsAction(
          targetCourse,
          targetCourseSlug,
          rows.map((r) => r.subjectKey),
          heading.trim(),
          semester.trim() ? Number(semester.trim()) : null,
        );
        setSelected(new Set());
        setHeading("");
        setSemester("");
        setDone(true);
        runSearch();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Merge failed.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Scope + search */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-bold text-foreground">Search Full Archive subjects</h2>
        <p className="mt-1 text-xs text-muted">
          Searches the Full Archive (uploaded papers, the static catalog, and Drive/NoteVault-linked papers) — not the
          Program/Subject catalogue used by AI Similarity Review.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Any course</option>
            {courses.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <div className="relative min-w-56 flex-1">
            <MagnifyingGlass size={14} weight="bold" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runSearch()}
              placeholder="Search by subject name…"
              className="w-full rounded-lg border border-border bg-background py-2 pl-8 pr-3 text-sm"
            />
          </div>
          <button
            type="button"
            disabled={pending || (!course && query.trim().length < 2)}
            onClick={runSearch}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
        {!course && query.trim().length < 2 && (
          <p className="mt-2 text-[11px] text-muted">Pick a course, or type at least 2 characters to search by name.</p>
        )}
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <Warning size={13} weight="bold" /> {error}
          </p>
        )}
        {done && !error && <p className="mt-3 text-xs font-semibold text-emerald-600">Merged — now showing under one heading on /pyq-notes.</p>}
      </div>

      {/* Results table */}
      {!searched && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <ListMagnifyingGlass size={28} weight="duotone" className="text-muted" />
          <p className="text-sm font-semibold text-foreground">No search run yet</p>
          <p className="max-w-sm text-xs text-muted">
            Pick a course above (or type at least 2 characters of a subject name), then press{" "}
            <span className="font-semibold text-foreground">Search</span> to list Full Archive subjects you can merge.
          </p>
        </div>
      )}
      {searched && (
        <div className="overflow-x-auto rounded-2xl border border-border bg-surface">
          {results.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted">No subjects match this scope/search.</div>
          ) : (
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="w-10 px-3 py-2"></th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2 text-right">Papers</th>
                  <th className="px-3 py-2">Mapping status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={`${r.course}\u0000${r.subjectKey}`}
                    className={`border-b border-border/60 last:border-0 ${selected.has(r.subjectKey) ? "bg-accent-soft/30" : ""}`}
                  >
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(r.subjectKey)} onChange={() => toggle(r.subjectKey)} />
                    </td>
                    <td className="px-3 py-2 font-semibold text-foreground">
                      {r.displayName}
                      {r.rawVariants.length > 1 && (
                        <p className="text-[11px] font-normal text-muted">Also seen as: {r.rawVariants.filter((v) => v !== r.displayName).join(", ")}</p>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">{r.course}</td>
                    <td className="px-3 py-2 text-right">{r.paperCount}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.hasOverride ? "Merged/renamed" : "Original"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selected.size > 0 && (
        <div className="sticky bottom-4 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/40 bg-surface p-4 shadow-lg">
          <p className="text-sm font-semibold text-foreground">
            {selected.size} subject{selected.size === 1 ? "" : "s"} selected
            {selected.size === 1 && " — select at least one more to merge"}
          </p>
          {crossCourseSelection && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-red-500">
              <Warning size={13} weight="bold" /> All selected subjects must be from the same course.
            </p>
          )}
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            placeholder="Heading these should show under…"
            className="min-w-56 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
          <input
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            type="number"
            min={1}
            max={8}
            placeholder="Sem"
            className="w-16 rounded-lg border border-border bg-background px-2 py-2 text-sm"
          />
          <button
            type="button"
            disabled={pending || selected.size < 2 || crossCourseSelection}
            onClick={submitMerge}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Merging…" : "Merge Selected"}
          </button>
        </div>
      )}
    </div>
  );
}
