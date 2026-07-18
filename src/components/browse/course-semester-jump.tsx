"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Program = { id: string; name: string; slug: string; terms: { id: string; name: string }[] };

export function CourseSemesterJump({
  programs,
  embedded = false,
}: {
  programs: Program[];
  // When true, skip the card's own background/border/shadow — used when a
  // parent (the homepage's floating action-card grid) already provides it.
  embedded?: boolean;
}) {
  const [programId, setProgramId] = useState("");
  const [termId, setTermId] = useState("");
  const router = useRouter();
  const program = programs.find((p) => p.id === programId);

  return (
    <div
      className={
        embedded ? "" : "rounded-2xl border border-border bg-surface p-5 shadow-[0_10px_40px_rgba(0,0,0,.06)]"
      }
    >
      {!embedded && <p className="text-sm font-semibold">Jump straight to your papers</p>}
      <div className={embedded ? "flex flex-wrap items-end gap-3" : "mt-3 flex flex-wrap items-end gap-3"}>
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
          disabled={!programId}
          onClick={() => {
            // Two ways forward, both requiring an explicit click — picking
            // a course or semester never navigates by itself:
            // 1. Course + semester picked -> straight to that semester's papers.
            // 2. Only a course picked -> "Go ahead" to that course's own page,
            //    where semesters/subjects can be picked from there.
            if (termId) router.push(`/terms/${termId}`);
            else if (program) router.push(`/programs/${program.slug}`);
          }}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          {termId ? "View papers →" : "Go ahead →"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Don&apos;t know your course yet? Try{" "}
        <Link href="/browse/college" className="text-brand hover:underline">
          browsing everything
        </Link>{" "}
        instead.
      </p>
    </div>
  );
}
