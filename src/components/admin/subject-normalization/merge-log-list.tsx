"use client";

import { useState, useTransition } from "react";
import { ArrowCounterClockwise, Sparkle } from "@phosphor-icons/react";
import { undoMergeAction } from "@/app/admin/(dashboard)/subject-normalization/actions";
import type { MergeLogRow } from "./types";

export function MergeLogList({ logs, onChanged }: { logs: MergeLogRow[]; onChanged: () => void }) {
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (logs.length === 0) {
    return <p className="text-sm text-muted">No merges yet.</p>;
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 bg-background p-3.5 text-sm"
        >
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold text-foreground">
              {log.isAiAssisted && <Sparkle size={13} weight="bold" className="text-brand" />}
              Merged into subject <code className="text-xs">{log.newCanonicalSubjectId.slice(0, 8)}</code>
              {log.undoneAt && <span className="text-xs font-bold text-muted">(undone)</span>}
            </p>
            <p className="text-xs text-muted">
              {log.affectedResourceIds.length} papers, {log.affectedQuestionIds.length} questions ·{" "}
              {new Date(log.createdAt).toLocaleString("en-IN")}
              {log.confidenceScore !== null ? ` · ${log.confidenceScore}% confidence` : ""}
            </p>
          </div>
          {!log.undoneAt && (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setError(null);
                setBusyId(log.id);
                startTransition(async () => {
                  try {
                    await undoMergeAction(log.id);
                    onChanged();
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not undo this merge.");
                  } finally {
                    setBusyId(null);
                  }
                });
              }}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-surface-muted disabled:opacity-60"
            >
              <ArrowCounterClockwise size={13} weight="bold" />
              {pending && busyId === log.id ? "Undoing…" : "Undo"}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
