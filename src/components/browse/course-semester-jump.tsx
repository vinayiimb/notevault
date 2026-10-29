"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, FilePdf } from "@phosphor-icons/react";

interface ProgramItem {
  id?: string;
  name: string;
  slug?: string;
}

interface CourseSemesterJumpProps {
  programs?: ProgramItem[];
  allProgrammes?: string[];
  embedded?: boolean;
}

export function CourseSemesterJump({
  programs = [],
  allProgrammes = [],
  embedded = false,
}: CourseSemesterJumpProps) {
  const [selectedCourse, setSelectedCourse] = useState("");
  const router = useRouter();

  // Combine unique list of courses
  const courseOptions = Array.from(
    new Set([
      ...allProgrammes,
      ...programs.map((p) => p.name),
    ])
  ).filter(Boolean).sort((a, b) => a.localeCompare(b));

  function handleGo() {
    if (!selectedCourse) return;
    router.push(`/papers?view=reader&course=${encodeURIComponent(selectedCourse)}`);
  }

  return (
    <div className={embedded ? "" : "rounded-3xl border border-border/70 bg-surface p-6 shadow-md sm:p-8"}>
      {!embedded && (
        <div className="mb-6 border-b border-border/60 pb-4">
          <h3 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Jump straight to your papers
          </h3>
          <p className="mt-1 text-sm text-muted">Select your course and view all official papers instantly.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="flex w-full flex-col gap-2">
          <label className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
            <span>Your course or degree programme</span>
          </label>
          <div className="relative">
            <select
              value={selectedCourse}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCourse(val);
                if (val) {
                  router.push(`/papers?view=reader&course=${encodeURIComponent(val)}`);
                }
              }}
              className="h-12 w-full cursor-pointer appearance-none rounded-xl border border-border bg-surface px-4 py-2 pr-10 text-[15px] text-foreground transition focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15"
            >
              <option value="">Select your DU degree / programme (118 official courses)...</option>
              {courseOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={!selectedCourse}
          onClick={handleGo}
          className="inline-flex h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full bg-brand px-6 text-[15px] font-medium text-brand-foreground hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
        >
          <FilePdf size={18} weight="bold" />
          <span>Open in Interactive PDF</span>
          <ArrowRight size={17} weight="bold" />
        </button>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-2 pt-2 text-[13px] text-muted sm:flex-row sm:items-center">
        <span>Selecting your course takes you directly to the interactive PDF archive with all matched papers.</span>
        <span>
          Want the full 118-programme matrix?{" "}
          <Link href="/papers" className="inline-flex items-center gap-1 font-medium text-brand underline-offset-4 hover:underline">
            <span>Explore All 118 Programmes</span>
            <ArrowRight size={12} weight="bold" />
          </Link>
        </span>
      </div>
    </div>
  );
}
