"use client";

import Link from "next/link";
import { ArrowRight, Calendar } from "@phosphor-icons/react";

interface BannerCardsProps {
  todayNoteTitle?: string;
  weeklyPyqTitle?: string;
}

export function BannerCards({
  todayNoteTitle = "Electricity as a Bottleneck for AI models and Data Centers",
  weeklyPyqTitle = "Workers & Overtime Wages regulations across DU colleges",
}: BannerCardsProps) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Card 1: PYQ */}
      <div className="relative flex flex-col justify-between rounded-[20px] bg-white dark:bg-[#1A1D24] p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200">
        {/* Top Right Badge */}
        <div className="absolute right-6 top-6">
          <span className="inline-block rounded-full bg-[#E5FAD5] dark:bg-[#20391A] px-3.5 py-1 text-xs font-bold text-[#357B19] dark:text-[#64D841] shadow-2xs">
            305 attempts
          </span>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-normal text-gray-800 dark:text-gray-100 tracking-wide mb-6">
            PYQ
          </h2>

          {/* Date & Topic Row */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white shrink-0">
              <Calendar size={16} weight="fill" className="text-gray-700 dark:text-gray-300" />
              <span>5 Aug:</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 select-none blur-[3px] hover:blur-none transition-all cursor-pointer max-w-[200px] truncate">
              {todayNoteTitle}
            </p>
            <Link
              href="/pyq-notes"
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FF7527] hover:bg-[#EE6417] px-4 py-1 text-xs font-bold text-white shadow-xs active:scale-95 transition-transform"
            >
              <span>Attempt</span>
              <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        </div>

        {/* Bottom Link */}
        <div className="mt-7">
          <Link
            href="/pyq-notes"
            className="text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors inline-flex items-center gap-1"
          >
            <span>View All Passages →</span>
          </Link>
        </div>
      </div>

      {/* Card 2: NOTES */}
      <div className="relative flex flex-col justify-between rounded-[20px] bg-white dark:bg-[#1A1D24] p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none hover:shadow-[0_4px_20px_rgba(0,0,0,0.06)] transition-all duration-200">
        {/* Top Right Badge */}
        <div className="absolute right-6 top-6">
          <span className="inline-block rounded-full bg-[#E5FAD5] dark:bg-[#20391A] px-3.5 py-1 text-xs font-bold text-[#357B19] dark:text-[#64D841] shadow-2xs">
            187 attempts
          </span>
        </div>

        {/* Title */}
        <div>
          <h2 className="text-2xl sm:text-3xl font-normal text-gray-800 dark:text-gray-100 tracking-wide mb-6">
            NOTES
          </h2>

          {/* Date & Topic Row */}
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <div className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-white shrink-0">
              <Calendar size={16} weight="fill" className="text-gray-700 dark:text-gray-300" />
              <span>3 - 9 Aug:</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 select-none blur-[3px] hover:blur-none transition-all cursor-pointer max-w-[200px] truncate">
              {weeklyPyqTitle}
            </p>
            <Link
              href="/browse/college"
              className="ml-auto inline-flex items-center gap-1 rounded-full bg-[#FF7527] hover:bg-[#EE6417] px-4 py-1 text-xs font-bold text-white shadow-xs active:scale-95 transition-transform"
            >
              <span>Attempt</span>
              <ArrowRight size={13} weight="bold" />
            </Link>
          </div>
        </div>

        {/* Bottom Link */}
        <div className="mt-7">
          <Link
            href="/browse/college"
            className="text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors inline-flex items-center gap-1"
          >
            <span>View All Practice Sets →</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
