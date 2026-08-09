"use client";

import { useState, useTransition } from "react";
import { MagnifyingGlass, Warning, ListMagnifyingGlass } from "@phosphor-icons/react";
import {
  searchSubjectsForManualMergeAction,
  previewMergeAction,
  manualMergeAction,
} from "@/app/admin/(dashboard)/subject-normalization/actions";
import { recommendCanonicalSubject } from "@/lib/subject-normalization";
import { MergePreviewDialog } from "./merge-preview-dialog";
import type { ManualMergeSubjectRow, MergePreview, ProgramWithTerms } from "./types";

/**
 * Tab 2 of the Subject Normalization Centre — search/browse subjects
 * directly and pick any 2+ to merge, instead of waiting for an AI/
 * deterministic scan to group them. Scoped by programme+semester by
 * default (spec: similarly-named subjects in different programmes/
 * semesters aren't automatically duplicates) — cross-scope selection is
 * still technically possible (the search itself can span terms if the
 * admin clears the term filter) but never silently assumed.
 */
export function ManualMergeTab({ programs }: { programs: ProgramWithTerms[] }) {
  const [pending, startTransition] = useTransition();
  const [programId, setProgramId] = useState<string>("");
  const [termId, setTermId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ManualMergeSubjectRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [canonicalId, setCanonicalId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const selectedProgram = programs.find((p) => p.id === programId);
  const selectedRows = results.filter((r) => selected.has(r.id));

  function runSearch() {
    setError(null);
    startTransition(async () => {
      try {
        const rows = await searchSubjectsForManualMergeAction({
          programId: programId || undefined,
          termId: termId || undefined,
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

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openPreview() {
    if (selectedRows.length < 2) return;
    setError(null);
    const recommended =
      recommendCanonicalSubject(
        selectedRows.map((r) => ({ id: r.id, name: r.name, upc: r.upc, resourceCount: r.pyqCount + r.notesCount, questionCount: r._count.questions })),
      ) ?? selectedRows[0].id;
    setCanonicalId(recommended);
    startTransition(async () => {
      try {
        const result = await previewMergeAction(recommended, [...selected]);
        setPreview(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build a preview.");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Scope + search */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-bold text-foreground">Search subjects</h2>
        <p className="mt-1 text-xs text-muted">
          Scoped by programme + semester by default — similarly-named subjects in different programmes or semesters
          are not automatically the same subject.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setTermId("");
            }}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Any programme</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            disabled={!selectedProgram}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm disabled:opacity-50"
          >
            <option value="">Any semester</option>
            {selectedProgram?.terms.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
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
            disabled={pending || (!programId && !termId && query.trim().length < 2)}
            onClick={runSearch}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            {pending ? "Searching…" : "Search"}
          </button>
        </div>
        {!programId && !termId && query.trim().length < 2 && (
          <p className="mt-2 text-[11px] text-muted">Pick a programme/semester, or type at least 2 characters to search by name.</p>
        )}
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <Warning size={13} weight="bold" /> {error}
          </p>
        )}
      </div>

      {/* Results table */}
      {!searched && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <ListMagnifyingGlass size={28} weight="duotone" className="text-muted" />
          <p className="text-sm font-semibold text-foreground">No search run yet</p>
          <p className="max-w-sm text-xs text-muted">
            Pick a programme and semester above (or type at least 2 characters of a subject name), then press{" "}
            <span className="font-semibold text-foreground">Search</span> to list subjects you can merge.
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
                  <th className="px-3 py-2">Code</th>
                  <th className="px-3 py-2">Programme</th>
                  <th className="px-3 py-2">Semester</th>
                  <th className="px-3 py-2 text-right">PYQs</th>
                  <th className="px-3 py-2 text-right">Notes</th>
                  <th className="px-3 py-2 text-right">Other</th>
                  <th className="px-3 py-2">Mapping status</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.id} className={`border-b border-border/60 last:border-0 ${selected.has(r.id) ? "bg-accent-soft/30" : ""}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} />
                    </td>
                    <td className="px-3 py-2 font-semibold text-foreground">{r.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.upc ?? "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.term.program.name}</td>
                    <td className="px-3 py-2 text-xs text-muted">{r.term.name}</td>
                    <td className="px-3 py-2 text-right">{r.pyqCount}</td>
                    <td className="px-3 py-2 text-right">{r.notesCount}</td>
                    <td className="px-3 py-2 text-right">{r._count.questions}</td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {r._count.subjectAliases > 0 ? `${r._count.subjectAliases} alias(es)` : "No aliases"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {selectedRows.length > 0 && (
        <div className="sticky bottom-4 flex items-center justify-between rounded-2xl border border-accent/40 bg-surface p-4 shadow-lg">
          <p className="text-sm font-semibold text-foreground">
            {selectedRows.length} subject{selectedRows.length === 1 ? "" : "s"} selected
            {selectedRows.length === 1 && " — select at least one more to merge"}
          </p>
          <button
            type="button"
            disabled={pending || selectedRows.length < 2}
            onClick={openPreview}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            Merge Selected
          </button>
        </div>
      )}

      {preview && (
        <MergePreviewDialog
          preview={preview}
          pending={pending}
          onCancel={() => setPreview(null)}
          onConfirm={() =>
            startTransition(async () => {
              try {
                await manualMergeAction(canonicalId, [...selected]);
                setPreview(null);
                setSelected(new Set());
                runSearch();
              } catch (err) {
                setError(err instanceof Error ? err.message : "Merge failed.");
              }
            })
          }
        />
      )}
    </div>
  );
}
