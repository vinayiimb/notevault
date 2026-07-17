"use client";

import { useMemo, useState } from "react";
import { deployFailedUploadAction, deleteFailedUploadAction } from "@/lib/actions";
import { formatBytes } from "@/lib/utils";
import type { AcademicProgram } from "@/lib/academic-types";

type FailedRow = {
  id: string;
  fileName: string;
  title: string;
  type: "NOTES" | "PYQ";
  year: number | null;
  reason: string;
  fileUrl: string | null;
  fileSize: number | null;
  createdAt: string;
  isDuplicate: boolean;
};

type RowState = {
  subjectId: string;
  deploying: boolean;
  dismissing: boolean;
  message: string | null;
  messageIsError: boolean;
};

export function FailedUploadsClient({
  rows,
  programs,
}: {
  rows: FailedRow[];
  programs: AcademicProgram[];
}) {
  const [liveRows, setLiveRows] = useState(rows);
  const [state, setState] = useState<Record<string, RowState>>({});

  const grouped = useMemo(() => {
    const flat = programs.flatMap((p) =>
      p.terms.flatMap((t) =>
        t.subjects.map((s) => ({ id: s.id, name: s.name, programName: p.name, termName: t.name }))
      )
    );
    const map = new Map<string, typeof flat>();
    for (const s of flat) {
      const key = `${s.programName} · ${s.termName}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return Array.from(map.entries());
  }, [programs]);

  function getState(id: string): RowState {
    return state[id] ?? { subjectId: "", deploying: false, dismissing: false, message: null, messageIsError: false };
  }

  function patchState(id: string, patch: Partial<RowState>) {
    setState((prev) => ({ ...prev, [id]: { ...getState(id), ...patch } }));
  }

  async function deploy(row: FailedRow) {
    const s = getState(row.id);
    if (!s.subjectId) {
      patchState(row.id, { message: "Pick a subject first.", messageIsError: true });
      return;
    }
    patchState(row.id, { deploying: true, message: null });
    try {
      const formData = new FormData();
      formData.set("id", row.id);
      formData.set("subjectId", s.subjectId);
      formData.set("title", row.title);
      formData.set("type", row.type);
      if (row.year) formData.set("year", String(row.year));
      const result = await deployFailedUploadAction(formData);
      if (result?.status === "duplicate") {
        patchState(row.id, {
          deploying: false,
          message: "That exact file was already uploaded elsewhere — removed from this list.",
          messageIsError: false,
        });
      }
      setLiveRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      patchState(row.id, {
        deploying: false,
        message: err instanceof Error ? err.message : "Could not deploy this file.",
        messageIsError: true,
      });
    }
  }

  async function dismiss(row: FailedRow) {
    patchState(row.id, { dismissing: true });
    try {
      const formData = new FormData();
      formData.set("id", row.id);
      await deleteFailedUploadAction(formData);
      setLiveRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      patchState(row.id, {
        dismissing: false,
        message: err instanceof Error ? err.message : "Could not dismiss this.",
        messageIsError: true,
      });
    }
  }

  if (liveRows.length === 0) {
    return <p className="mt-8 text-sm text-muted">Nothing here — every upload has gone through cleanly.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Reason</th>
            <th className="px-4 py-3 font-medium">Duplicate?</th>
            <th className="px-4 py-3 font-medium">Fix subject &amp; deploy</th>
            <th className="px-4 py-3 font-medium">When</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {liveRows.map((row) => {
            const s = getState(row.id);
            return (
              <tr key={row.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">{row.title}</p>
                  <p className="text-xs text-muted">
                    {row.fileName}
                    {row.fileSize ? ` · ${formatBytes(row.fileSize)}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3 text-red-500">{row.reason}</td>
                <td className="px-4 py-3">
                  {row.isDuplicate ? (
                    <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                      Duplicate content
                    </span>
                  ) : (
                    <span className="text-xs text-muted">No</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <select
                      value={s.subjectId}
                      onChange={(e) => patchState(row.id, { subjectId: e.target.value, message: null })}
                      className="min-w-[220px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                    >
                      <option value="">Pick a subject...</option>
                      {grouped.map(([group, groupSubjects]) => (
                        <optgroup key={group} label={group}>
                          {groupSubjects.map((subj) => (
                            <option key={subj.id} value={subj.id}>
                              {subj.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => deploy(row)}
                      disabled={s.deploying || !row.fileUrl}
                      className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      {s.deploying ? "Deploying..." : "Deploy"}
                    </button>
                  </div>
                  {s.message && (
                    <p className={`mt-1 text-xs ${s.messageIsError ? "text-red-500" : "text-green-600"}`}>
                      {s.message}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted">{row.createdAt}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    {row.fileUrl && (
                      <a
                        href={row.fileUrl}
                        download
                        className="text-sm font-medium text-accent hover:underline"
                      >
                        Download
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => dismiss(row)}
                      disabled={s.dismissing}
                      className="text-sm text-muted hover:text-red-500 disabled:opacity-50"
                    >
                      Dismiss
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
