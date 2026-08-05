"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlass, Sparkle, TrendUp } from "@phosphor-icons/react";

interface StudentContextRowProps {
  studentName?: string | null;
  programmeName?: string;
  semesterName?: string;
  readinessScore?: number;
  onOpenSearch?: () => void;
}

export function StudentContextRow({
  studentName = "Vinay",
  programmeName = "B.Com (Hons.)",
  semesterName = "Semester 5",
  readinessScore = 68,
  onOpenSearch,
}: StudentContextRowProps) {
  const [greeting, setGreeting] = useState("Good evening");

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  return (
    <section className="space-y-4">
      {/* Top Greeting and Readiness Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {greeting}, {studentName || "Student"}
          </h1>
          <p className="mt-1 text-sm font-medium text-[#646B78] dark:text-gray-400">
            {programmeName} &bull; {semesterName}
          </p>
        </div>

        {/* Preparation Readiness Badge */}
        <div className="inline-flex items-center gap-2 rounded-[14px] bg-white dark:bg-[#1C2029] px-4 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.03)] border border-[#EBECEF] dark:border-gray-800/80 w-fit shrink-0">
          <div className="flex size-7 items-center justify-center rounded-full bg-[#E5FAD5] dark:bg-[#20391A] text-[#2A7513] dark:text-[#64D841]">
            <TrendUp size={16} weight="bold" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-[0.04em] text-gray-400 dark:text-gray-500">
              Preparation Readiness
            </div>
            <div className="text-base font-extrabold text-[#2A7513] dark:text-[#64D841] leading-none mt-0.5">
              {readinessScore}%
            </div>
          </div>
        </div>
      </div>

      {/* Universal Academic Search Bar */}
      <div className="relative">
        <button
          type="button"
          onClick={onOpenSearch}
          className="group flex w-full items-center gap-3.5 rounded-[16px] bg-white dark:bg-[#1A1D24] px-4 sm:px-5 py-3.5 text-left text-sm text-gray-400 dark:text-gray-500 shadow-[0_2px_12px_rgba(0,0,0,0.035)] border border-[#E8EAEE] dark:border-gray-800/80 hover:border-gray-300 dark:hover:border-gray-700 hover:shadow-md transition-all duration-200"
        >
          <MagnifyingGlass size={20} weight="bold" className="text-gray-400 group-hover:text-[#3168FF] transition-colors shrink-0" />
          <span className="truncate text-gray-500 dark:text-gray-400 font-medium">
            Search subject, topic, paper, course code or year
          </span>
          <div className="ml-auto hidden sm:flex items-center gap-1 shrink-0 rounded-lg bg-[#F4F5F8] dark:bg-[#232732] px-2 py-1 text-xs font-bold text-gray-500 dark:text-gray-400 border border-gray-200/60 dark:border-gray-700">
            <span>⌘K</span>
          </div>
        </button>
      </div>
    </section>
  );
}
