"use client";

import { Warning } from "@phosphor-icons/react";
import type { MergePreview } from "./types";

// Shared merge-preview dialog — used by both the AI Similarity Review flow
// (suggestion-card.tsx) and the Manual Merge tab (manual-merge-tab.tsx), so
// the two workflows can never drift into showing different information
// before an admin confirms a merge.
export function MergePreviewDialog({
  preview,
  pending,
  onCancel,
  onConfirm,
}: {
  preview: MergePreview;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true">
      <div className={`w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl border bg-surface p-6 ${preview.blocked ? "border-red-500/50" : "border-border"}`}>
        <h4 className="text-lg font-bold text-foreground">Preview merge</h4>
        <p className="mt-1 text-sm text-muted">
          Merging into <span className="font-semibold text-foreground">{preview.canonicalName}</span>
        </p>

        {preview.blocked ? (
          <div className="mt-4 space-y-2 rounded-xl border border-red-500/40 bg-red-500/10 p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-red-600">
              <Warning size={14} weight="bold" /> Merge blocked — data integrity cannot be guaranteed
            </p>
            {preview.conflicts.map((c, i) => (
              <p key={i} className="text-xs text-red-700 dark:text-red-300">{c}</p>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            Nothing will be permanently deleted. Existing resources will be preserved and mapped to the master subject.
          </div>
        )}

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Papers (Resources)</dt>
            <dd className="font-semibold">{preview.before.resources}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Question bank records</dt>
            <dd className="font-semibold">{preview.before.questions}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Drive-linked subjects</dt>
            <dd className="font-semibold">{preview.before.driveSubjects}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Exam-date reminders</dt>
            <dd className="font-semibold">{preview.before.examDates}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Note themes</dt>
            <dd className="font-semibold">{preview.before.noteThemes}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Upload-match memories</dt>
            <dd className="font-semibold">{preview.before.matchMemories}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Compiled notes (SubjectNotes)</dt>
            <dd className="font-semibold">{preview.before.subjectNotes}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">AI subject analyses</dt>
            <dd className="font-semibold">{preview.before.subjectAnalysis}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Child subjects re-parented</dt>
            <dd className="font-semibold">{preview.before.childSubjects}</dd>
          </div>
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-semibold text-foreground">Total linked records</dt>
            <dd className="font-semibold">
              {preview.totalLinkedRecordsBefore} <span className="text-muted">→</span> {preview.totalLinkedRecordsAfterExpected}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Expected data loss</dt>
            <dd className={`font-semibold ${preview.expectedDataLoss > 0 ? "text-red-600" : "text-emerald-600"}`}>
              {preview.expectedDataLoss}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Alias records to create</dt>
            <dd className="font-semibold">{preview.aliasesToCreate.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">URLs that will redirect</dt>
            <dd className="font-semibold">{preview.urlsAffected.length}</dd>
          </div>
          {preview.slugConflict && (
            <p className="flex items-center gap-1.5 text-xs font-semibold text-amber-600">
              <Warning size={13} weight="bold" /> One member shares a slug with the canonical subject — check names
              after merging.
            </p>
          )}
        </dl>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-muted"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={pending || preview.blocked}
            title={preview.blocked ? "Resolve the conflicts above before merging" : undefined}
            onClick={onConfirm}
            className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-accent-foreground hover:bg-accent-hover disabled:opacity-60"
          >
            Confirm merge
          </button>
        </div>
      </div>
    </div>
  );
}
