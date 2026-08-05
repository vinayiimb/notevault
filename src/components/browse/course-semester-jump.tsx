"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "@phosphor-icons/react";

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
    <div className={embedded ? "" : "rounded-3xl border border-border/70 bg-surface p-6 shadow-md sm:p-8"}>
      {!embedded && (
        <div className="mb-6 border-b border-border/60 pb-4">
          <h3 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Jump straight to your papers
          </h3>
          <p className="mt-1 text-sm text-muted">Select your course once and view your exam resources instantly.</p>
        </div>
      )}

      <div className={embedded ? "grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1.1fr_auto] md:items-end" : "grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1.1fr_auto] md:items-end"}>
        <div className="flex w-full flex-col gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-muted">
            <span>1. Course / Degree Program</span>
          </label>
          <div className="relative">
            <select
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setTermId("");
              }}
              className="h-13 w-full appearance-none rounded-2xl border border-border bg-background px-4 py-3 pr-10 text-sm font-semibold text-foreground shadow-2xs transition-all hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 cursor-pointer"
            >
              <option value="">Select your DU course...</option>
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
              <span className="text-xs">▼</span>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-2">
          <label className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-muted">
            <span>2. Semester / Term</span>
          </label>
          <div className="relative">
            <select
              value={termId}
              onChange={(e) => setTermId(e.target.value)}
              disabled={!program}
              className="h-13 w-full appearance-none rounded-2xl border border-border bg-background px-4 py-3 pr-10 text-sm font-semibold text-foreground shadow-2xs transition-all hover:border-brand/50 focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15 cursor-pointer disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:border-border"
            >
              <option value="">Select semester...</option>
              {program?.terms.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
              <span className="text-xs">▼</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!programId}
          onClick={() => {
            if (termId) router.push(`/terms/${termId}`);
            else if (program) router.push(`/programs/${program.slug}`);
          }}
          className="inline-flex h-13 w-full items-center justify-center gap-2 rounded-2xl bg-brand px-8 text-sm font-bold text-brand-foreground shadow-md transition-all hover:bg-brand-hover hover:shadow-lg hover:shadow-brand/20 active:scale-98 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none md:w-auto shrink-0"
        >
          <span>{termId ? "View papers" : "Go ahead"}</span>
          <ArrowRight size={17} weight="bold" />
        </button>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-2 border-t border-border/50 pt-4 text-xs text-muted sm:flex-row sm:items-center">
        <span>Can&apos;t find your exact semester? Just select your course first.</span>
        <span>
          Don&apos;t know your course yet?{" "}
          <Link href="/courses" className="font-bold text-brand hover:underline inline-flex items-center gap-1">
            <span>Browse complete archive</span>
            <ArrowRight size={12} weight="bold" />
          </Link>
        </span>
      </div>
    </div>
  );
}
