"use client";

import { useState, useTransition } from "react";
import { Warning } from "@phosphor-icons/react";
import { manualMergeCatalogSubjectsAction } from "@/lib/actions";
import type { ArchiveSubjectGroupMember } from "@/lib/archive-customize-data";

// Free-form sibling to the AI "possible duplicate groups" merger above it —
// picks any subset of subjects/files in this programme (not just
// AI-suggested candidates) and puts them all under one admin-typed heading.
export function ManualSubjectMerge({
  course,
  courseSlug,
  allSubjects,
}: {
  course: string;
  courseSlug: string;
  allSubjects: ArchiveSubjectGroupMember[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [heading, setHeading] = useState("");
  const [semester, setSemester] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const selectedRows = allSubjects.filter((s) => selected.has(s.subjectKey));

  function toggle(subjectKey: string) {
    setDone(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(subjectKey)) next.delete(subjectKey);
      else next.add(subjectKey);
      return next;
    });
  }

  function submit() {
    setError(null);
    if (selectedRows.length < 2) {
      setError("Pick at least two subjects to merge.");
      return;
    }
    if (!heading.trim()) {
      setError("Type a heading for the merged group.");
      return;
    }
    startTransition(async () => {
      try {
        await manualMergeCatalogSubjectsAction(
          course,
          courseSlug,
          [...selected],
          heading.trim(),
          semester.trim() ? Number(semester.trim()) : null,
        );
        setSelected(new Set());
        setHeading("");
        setSemester("");
        setDone(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Merge failed.");
      }
    });
  }

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-bold text-foreground">Manual merge</h2>
      <p className="text-xs text-muted">
        Pick any subjects below — even ones that don&apos;t look alike — and merge them under one heading. Useful when
        the automatic matcher above misses a duplicate.
      </p>

      <div className="rounded-2xl border border-border bg-surface p-5">
        <div className="max-h-72 overflow-y-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="w-10 px-3 py-2"></th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2 text-right">Papers</th>
              </tr>
            </thead>
            <tbody>
              {allSubjects.map((s) => (
                <tr
                  key={s.subjectKey}
                  className={`cursor-pointer border-b border-border/60 last:border-0 ${selected.has(s.subjectKey) ? "bg-accent-soft/30" : ""}`}
                  onClick={() => toggle(s.subjectKey)}
                >
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={selected.has(s.subjectKey)} onChange={() => toggle(s.subjectKey)} onClick={(e) => e.stopPropagation()} />
                  </td>
                  <td className="px-3 py-2 font-semibold text-foreground">{s.displayName}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted">{s.paperCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs text-muted">
            {selectedRows.length > 0 ? `${selectedRows.length} selected` : "Select 2+ subjects above"}
          </span>
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
            disabled={pending || selectedRows.length < 2}
            onClick={submit}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Merging…" : "Merge selected"}
          </button>
        </div>

        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <Warning size={13} weight="bold" /> {error}
          </p>
        )}
        {done && !error && <p className="mt-3 text-xs font-semibold text-emerald-600">Merged — now showing under one heading on /pyq-notes.</p>}
      </div>
    </section>
  );
}
