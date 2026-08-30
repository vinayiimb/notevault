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
          <label
            htmlFor="course-degree-select"
            className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider uppercase text-gray-500"
          >
            <span>Select Course / Degree Program</span>
          </label>
          <div className="relative">
            <select
              id="course-degree-select"
              aria-label="Select your DU degree or programme"
              value={selectedCourse}
              onChange={(e) => {
                const val = e.target.value;
                setSelectedCourse(val);
                if (val) {
                  router.push(`/papers?view=reader&course=${encodeURIComponent(val)}`);
                }
              }}
              className="h-12 w-full appearance-none rounded-xl border border-gray-200 bg-white px-4 py-2 pr-10 text-sm font-medium text-gray-900 shadow-sm transition-all focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer"
            >
              <option value="">Select your DU degree / programme (118 official courses)...</option>
              {courseOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
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
          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#c1c4f5] px-6 text-sm font-bold text-white transition-all hover:bg-[#a6a9f0] disabled:cursor-not-allowed disabled:opacity-80 sm:w-auto shrink-0 cursor-pointer"
        >
          <FilePdf size={18} weight="bold" />
          <span>Open in Interactive PDF</span>
          <ArrowRight size={17} weight="bold" />
        </button>
      </div>

      <div className="mt-5 flex flex-col justify-between gap-2 pt-2 text-xs text-gray-500 sm:flex-row sm:items-center">
        <span>Selecting your course takes you directly to the interactive PDF archive with all matched papers.</span>
        <span>
          Want the full 118-programme matrix?{" "}
          <Link href="/papers" className="font-bold text-blue-600 hover:underline inline-flex items-center gap-1">
            <span>Explore All 118 Programmes</span>
            <ArrowRight size={12} weight="bold" />
          </Link>
        </span>
      </div>
    </div>
  );
}
