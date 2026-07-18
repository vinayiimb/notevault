"use client";

import { useState } from "react";
import { updateResourceAction, deleteResourceAction } from "@/lib/actions";

type Row = {
  id: string;
  subjectId: string;
  subjectName: string;
  title: string;
  type: "PYQ" | "NOTES";
  year: number | null;
  createdAt: string;
};

type RowState = {
  title: string;
  subjectId: string;
  type: "PYQ" | "NOTES";
  year: string;
  saving: boolean;
  saved: boolean;
  error: string | null;
};

// The "when all papers for this course + semester are visible, let me fix
// them" view — inline-editable so correcting a wrong year (found via the
// coverage matrix above) or moving a paper to a different subject doesn't
// require hunting it down in Upload batches.
export function CoverageResourceTable({
  rows,
  subjects,
}: {
  rows: Row[];
  subjects: { id: string; name: string }[];
}) {
  const [liveRows, setLiveRows] = useState(rows);
  const [state, setState] = useState<Record<string, RowState>>(() =>
    Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          title: r.title,
          subjectId: r.subjectId,
          type: r.type,
          year: r.year ? String(r.year) : "",
          saving: false,
          saved: false,
          error: null,
        },
      ])
    )
  );

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
    return (
      <tr>
        <td colSpan={5} className="px-4 py-6 text-center text-muted">
          No PYQ papers uploaded for this semester yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {liveRows
        .slice()
        .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || (a.year ?? 0) - (b.year ?? 0))
        .map((row) => {
          const s = state[row.id];
          return (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2">
                <select
                  value={s.subjectId}
                  onChange={(e) => patch(row.id, { subjectId: e.target.value })}
                  className="w-full min-w-[180px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                >
                  {subjects.map((subj) => (
                    <option key={subj.id} value={subj.id}>
                      {subj.name}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-2">
                <input
                  value={s.title}
                  onChange={(e) => patch(row.id, { title: e.target.value })}
                  className="w-full min-w-[220px] rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  value={s.year}
                  onChange={(e) => patch(row.id, { year: e.target.value })}
                  type="number"
                  className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                />
              </td>
              <td className="px-4 py-2 text-muted">{row.createdAt}</td>
              <td className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => save(row)}
                    disabled={s.saving}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
                  >
                    {s.saving ? "Saving..." : s.saved ? "Saved ✓" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(row)}
                    className="text-xs text-muted hover:text-red-500"
                  >
                    Delete
                  </button>
                </div>
                {s.error && <p className="mt-1 text-xs text-red-500">{s.error}</p>}
              </td>
            </tr>
          );
        })}
    </>
  );
}
