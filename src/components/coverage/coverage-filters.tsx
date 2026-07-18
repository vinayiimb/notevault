"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AcademicProgram } from "@/lib/academic-types";

// Selecting a course or semester only updates the pickers — it never
// navigates on its own. Coverage needs a specific semester to show
// anything meaningful, so both have to be picked before "View coverage"
// is clickable (there's no useful course-only view here, unlike the
// public course+semester jump).
export function CoverageFilters({
  programs,
  programId: initialProgramId,
  termId: initialTermId,
}: {
  programs: AcademicProgram[];
  programId: string;
  termId: string;
}) {
  const router = useRouter();
  const [programId, setProgramId] = useState(initialProgramId);
  const [termId, setTermId] = useState(initialTermId);
  const program = programs.find((p) => p.id === programId);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Course</label>
        <select
          value={programId}
          onChange={(e) => {
            setProgramId(e.target.value);
            setTermId("");
          }}
          className="min-w-56 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        >
          <option value="">Select course</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Semester</label>
        <select
          value={termId}
          disabled={!program}
          onChange={(e) => setTermId(e.target.value)}
          className="min-w-48 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
        >
          <option value="">Select semester</option>
          {program?.terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        disabled={!termId}
        onClick={() => router.push(`/admin/coverage?programId=${programId}&termId=${termId}`)}
        className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
      >
        View coverage →
      </button>
    </div>
  );
}
