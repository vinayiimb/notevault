"use client";

import { useMemo, useState } from "react";
import { updateResourceAction, deleteResourceAction } from "@/lib/actions";
import type { AcademicProgram } from "@/lib/academic-types";

type Row = {
  id: string;
  title: string;
  type: "PYQ" | "NOTES";
  year: number | null;
  subjectId: string;
  subjectName: string;
  fileUrl: string;
  fileName: string;
};

type RowState = {
  title: string;
  type: "PYQ" | "NOTES";
  year: string;
  subjectId: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
};

export function BatchDetailClient({
  rows,
  programs,
}: {
  rows: Row[];
  programs: AcademicProgram[];
}) {
  const [liveRows, setLiveRows] = useState(rows);
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          title: r.title,
          type: r.type,
          year: r.year ? String(r.year) : "",
          subjectId: r.subjectId,
          saving: false,
          saved: false,
          error: null,
        },
      ])
    )
  );

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

  function patch(id: string, p: Partial<RowState>) {
    setState((prev) => ({ ...prev, [id]: { ...prev[id], ...p, saved: false, error: null } }));
  }

  async function save(row: Row) {
    const s = state[row.id];
    patch(row.id, { saving: true });
    try {
      const formData = new FormData();
      formData.set("id", row.id);
      formData.set("subjectId", s.subjectId);
      formData.set("type", s.type);
      formData.set("title", s.title);
      if (s.type === "PYQ" && s.year) formData.set("year", s.year);
      await updateResourceAction(formData);
      setState((prev) => ({ ...prev, [row.id]: { ...prev[row.id], saving: false, saved: true } }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        [row.id]: {
          ...prev[row.id],
          saving: false,
          error: err instanceof Error ? err.message : "Could not save.",
        },
      }));
    }
  }

  async function remove(row: Row) {
    try {
      const formData = new FormData();
      formData.set("id", row.id);
      formData.set("subjectId", row.subjectId);
      await deleteResourceAction(formData);
      setLiveRows((prev) => prev.filter((r) => r.id !== row.id));
    } catch (err) {
      patch(row.id, { error: err instanceof Error ? err.message : "Could not delete." });
    }
  }

  if (liveRows.length === 0) {
    return <p className="mt-8 text-sm text-muted">Every file in this batch has been removed.</p>;
  }

  return (
    <div className="mt-6 overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full min-w-[900px] text-sm">
        <thead>
          <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Title</th>
            <th className="px-4 py-3 font-medium">Subject</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Year</th>
            <th className="px-4 py-3 font-medium"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {liveRows.map((row) => {
            const s = state[row.id];
            return (
              <tr key={row.id}>
                <td className="px-4 py-2">
                  <a href={row.fileUrl} download className="text-xs text-accent hover:underline">
                    {row.fileName}
                  </a>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={s.title}
                    onChange={(e) => patch(row.id, { title: e.target.value })}
                    className="w-full min-w-[180px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2">
                  <select
                    value={s.subjectId}
                    onChange={(e) => patch(row.id, { subjectId: e.target.value })}
                    className="w-full min-w-[200px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  >
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
                </td>
                <td className="px-4 py-2">
                  <select
                    value={s.type}
                    onChange={(e) => patch(row.id, { type: e.target.value as "PYQ" | "NOTES" })}
                    className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                  >
                    <option value="PYQ">PYQ</option>
                    <option value="NOTES">Notes</option>
                  </select>
                </td>
                <td className="px-4 py-2">
                  <input
                    value={s.year}
                    onChange={(e) => patch(row.id, { year: e.target.value })}
                    type="number"
                    disabled={s.type !== "PYQ"}
                    className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none disabled:opacity-40"
                  />
                </td>
                <td className="px-4 py-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => save(row)}
                      disabled={s.saving}
                      className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                    >
                      {s.saving ? "Saving..." : s.saved ? "Saved ✓" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(row)}
                      className="text-sm text-muted hover:text-red-500"
                    >
                      Delete
                    </button>
                  </div>
                  {s.error && <p className="mt-1 text-xs text-red-500">{s.error}</p>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
