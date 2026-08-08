"use client";

import { useState, useTransition } from "react";
import {
  CaretDown,
  Check,
  PencilSimple,
  Warning,
  X,
  Sparkle,
} from "@phosphor-icons/react";
import {
  approveSuggestionAction,
  editSuggestionNameAction,
  ignoreSuggestionAction,
  markSeparateAction,
  mergeSuggestionAction,
  previewMergeAction,
  removeItemFromSuggestionAction,
} from "@/app/admin/(dashboard)/subject-normalization/actions";
import { recommendCanonicalSubject } from "@/lib/subject-normalization";
import { MergePreviewDialog } from "./merge-preview-dialog";
import type { MergePreview, SuggestionRow } from "./types";

const RELATIONSHIP_LABEL: Record<SuggestionRow["relationship"], string> = {
  EXACT_DUPLICATE: "Exact duplicate",
  SPELLING_VARIATION: "Spelling variation",
  ABBREVIATION: "Abbreviation",
  RENAMED_SYLLABUS: "Renamed syllabus version",
  RELATED_BUT_SEPARATE: "Related but separate",
};

function confidenceColor(score: number) {
  if (score >= 85) return "text-emerald-600 bg-emerald-500/10";
  if (score >= 60) return "text-amber-600 bg-amber-500/10";
  return "text-red-600 bg-red-500/10";
}

export function SuggestionCard({ suggestion, onChanged }: { suggestion: SuggestionRow; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState(suggestion.suggestedName);
  const [canonicalId, setCanonicalId] = useState(
    recommendCanonicalSubject(
      suggestion.members.map((m) => ({ id: m.id, name: m.name, upc: m.upc, resourceCount: m._count.resources, questionCount: m._count.questions })),
    ) ?? suggestion.subjectIds[0],
  );
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isTerminal = suggestion.status !== "PENDING" && suggestion.status !== "APPROVED";

  function run(fn: () => Promise<unknown>) {
    setError(null);
    startTransition(async () => {
      try {
        await fn();
        onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  }

  async function openPreview() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await previewMergeAction(canonicalId, suggestion.subjectIds);
        setPreview(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build a preview.");
      }
    });
  }

  return (
    <div className={`rounded-2xl border bg-surface p-5 ${isTerminal ? "opacity-60" : "border-border"} ${suggestion.status === "MERGED" ? "border-emerald-500/40" : "border-border"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {editingName ? (
              <div className="flex items-center gap-2">
                <input
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  className="rounded-lg border border-border bg-background px-2 py-1 text-sm font-bold"
                />
                <button
                  type="button"
                  className="text-xs font-semibold text-accent"
                  onClick={() =>
                    run(async () => {
                      await editSuggestionNameAction(suggestion.id, nameDraft);
                      setEditingName(false);
                    })
                  }
                >
                  Save
                </button>
                <button type="button" className="text-xs text-muted" onClick={() => setEditingName(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <h3 className="text-base font-bold text-foreground">{suggestion.suggestedName}</h3>
                {suggestion.status === "PENDING" && (
                  <button
                    type="button"
                    aria-label="Edit canonical name"
                    onClick={() => setEditingName(true)}
                    className="text-muted hover:text-foreground"
                  >
                    <PencilSimple size={14} weight="bold" />
                  </button>
                )}
              </>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${confidenceColor(suggestion.confidenceScore)}`}>
              {suggestion.confidenceScore}% confidence
            </span>
            {suggestion.source === "AI" ? (
              <span className="flex items-center gap-1 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-bold text-brand">
                <Sparkle size={11} weight="bold" /> AI
              </span>
            ) : null}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
              {RELATIONSHIP_LABEL[suggestion.relationship]}
            </span>
            {!suggestion.safeToMerge && (
              <span className="flex items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-600">
                <Warning size={11} weight="bold" /> Needs care
              </span>
            )}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-semibold text-muted">
              {suggestion.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            {suggestion.term.program.name} · {suggestion.term.name} · {suggestion.members.length} variations
          </p>
          <p className="mt-2 text-sm text-foreground/90">{suggestion.explanation}</p>
          {suggestion.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {suggestion.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                  <Warning size={13} weight="bold" className="mt-0.5 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          <CaretDown size={16} weight="bold" className={`transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      </div>

      {expanded && (
        <div className="mt-4 space-y-2 border-t border-border pt-4">
          {suggestion.members.map((m) => (
            <label
              key={m.id}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3 text-sm ${
                canonicalId === m.id ? "border-accent bg-accent-soft/40" : "border-border/60"
              }`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`canonical-${suggestion.id}`}
                  checked={canonicalId === m.id}
                  onChange={() => setCanonicalId(m.id)}
                />
                <span className="font-semibold text-foreground">{m.name}</span>
                {m.upc && <span className="text-[11px] text-muted">UPC {m.upc}</span>}
              </span>
              <span className="flex items-center gap-3 text-[11px] text-muted">
                <span>{m._count.resources} files</span>
                <span>{m._count.questions} questions</span>
                {suggestion.status === "PENDING" && suggestion.members.length > 2 && (
                  <button
                    type="button"
                    aria-label={`Remove ${m.name} from group`}
                    onClick={() => run(() => removeItemFromSuggestionAction(suggestion.id, m.id))}
                    className="text-muted hover:text-red-500"
                  >
                    <X size={14} weight="bold" />
                  </button>
                )}
              </span>
            </label>
          ))}
          <p className="text-[11px] text-muted">Selected radio = the canonical subject everything else merges into.</p>
        </div>
      )}

      {error && <p className="mt-3 text-xs font-semibold text-red-500">{error}</p>}

      {suggestion.status === "PENDING" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={openPreview}
            className="inline-flex items-center gap-1.5 rounded-xl bg-accent px-3.5 py-2 text-xs font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            <Check size={14} weight="bold" /> Preview &amp; Merge
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => approveSuggestionAction(suggestion.id))}
            className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted disabled:opacity-60"
          >
            Approve
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => markSeparateAction(suggestion.id))}
            className="rounded-xl border border-border px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-surface-muted disabled:opacity-60"
          >
            Mark as separate
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => ignoreSuggestionAction(suggestion.id))}
            className="ml-auto rounded-xl px-3.5 py-2 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-60"
          >
            Ignore
          </button>
        </div>
      )}

      {preview && (
        <MergePreviewDialog
          preview={preview}
          pending={pending}
          onCancel={() => setPreview(null)}
          onConfirm={() =>
            run(async () => {
              await mergeSuggestionAction(suggestion.id, canonicalId, suggestion.subjectIds);
              setPreview(null);
            })
          }
        />
      )}
    </div>
  );
}
