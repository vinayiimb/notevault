"use client";

import { useRouter } from "next/navigation";
import type { AcademicProgram } from "@/lib/academic-types";

export function CoverageFilters({
  programs,
  programId,
  termId,
}: {
  programs: AcademicProgram[];
  programId: string;
  termId: string;
}) {
  const router = useRouter();
  const program = programs.find((p) => p.id === programId);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Course</label>
        <select
          value={programId}
          onChange={(e) => router.push(`/admin/coverage?programId=${e.target.value}`)}
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
          onChange={(e) =>
            router.push(`/admin/coverage?programId=${programId}&termId=${e.target.value}`)
          }
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
    </div>
  );
}
