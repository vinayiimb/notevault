"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Program = { id: string; name: string; terms: { id: string; name: string }[] };

export function CourseSemesterJump({ programs }: { programs: Program[] }) {
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const router = useRouter();
  const program = programs.find((p) => p.id === programId);

  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
      <p className="text-sm font-semibold">Jump straight to your papers</p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted">Course</label>
          <select
            value={programId}
            onChange={(e) => {
              setProgramId(e.target.value);
              setTermId("");
            }}
            className="min-w-[220px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
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
          <label className="text-xs text-muted">Semester</label>
          <select
            value={termId}
            onChange={(e) => setTermId(e.target.value)}
            disabled={!program}
            className="min-w-[180px] rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-50"
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
          onClick={() => termId && router.push(`/terms/${termId}`)}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          View papers →
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Don&apos;t know your course yet? Browse everything below instead.
      </p>
    </div>
  );
}
