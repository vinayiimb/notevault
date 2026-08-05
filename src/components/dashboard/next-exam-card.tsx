"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarBlank, Clock, Lightning, Sparkle } from "@phosphor-icons/react";

interface ExamItem {
  id: string;
  subject: string;
  date: string;
  time: string;
  remaining: string;
  isNext: boolean;
  syllabusCovered: string;
  pyqsAttempted: string;
  unitsRevised: string;
  mockPapers: string;
  recommendedAction: string;
  href: string;
}

const EXAMS: ExamItem[] = [
  {
    id: "fm",
    subject: "Financial Management",
    date: "12 August 2026",
    time: "9:30 AM",
    remaining: "6 days remaining",
    isNext: true,
    syllabusCovered: "78%",
    pyqsAttempted: "5 of 9",
    unitsRevised: "6 of 8",
    mockPapers: "1 of 3",
    recommendedAction: "Attempt the 2025 paper under timed conditions.",
    href: "/tools/exam-kit",
  },
  {
    id: "pp",
    subject: "Public Policy in India",
    date: "16 August 2026",
    time: "9:30 AM",
    remaining: "10 days remaining",
    isNext: false,
    syllabusCovered: "85%",
    pyqsAttempted: "7 of 10",
    unitsRevised: "8 of 8",
    mockPapers: "2 of 3",
    recommendedAction: "Revise governance reforms unit and solve short questions.",
    href: "/browse/college",
  },
  {
    id: "ba",
    subject: "Business Analytics",
    date: "21 August 2026",
    time: "2:00 PM",
    remaining: "15 days remaining",
    isNext: false,
    syllabusCovered: "55%",
    pyqsAttempted: "3 of 8",
    unitsRevised: "4 of 7",
    mockPapers: "0 of 3",
    recommendedAction: "Focus on predictive modelling formulas and PYQs.",
    href: "/pyq-notes",
  },
];

export function NextExamCard() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const activeExam = EXAMS[selectedIndex] || EXAMS[0];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
        NEXT EXAMINATION
      </h3>

      {/* Main Examination Card */}
      <div className="rounded-[22px] bg-white dark:bg-[#1A1D24] p-6 sm:p-8 shadow-[0_2px_14px_rgba(0,0,0,0.035)] border border-[#EAEBF0] dark:border-gray-800/80 transition-all duration-300">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          {/* Left Column: Exam Details */}
          <div className="space-y-2 max-w-xl">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/40 px-3 py-1 text-xs font-extrabold text-red-600 dark:text-red-300 border border-red-100 dark:border-red-800/50">
                {activeExam.remaining}
              </span>
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <CalendarBlank size={15} weight="bold" className="text-gray-400" />
                {activeExam.date} &bull; {activeExam.time}
              </span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900 dark:text-white pt-1">
              {activeExam.subject}
            </h2>
          </div>

          {/* Right Column: Actions */}
          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <Link
              href={activeExam.href}
              className="inline-flex items-center gap-2 rounded-[14px] bg-[#FF7527] hover:bg-[#EE6417] px-6 py-3 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md active:scale-95"
            >
              <span>Start Mock Paper</span>
              <ArrowRight size={16} weight="bold" />
            </Link>
            <Link
              href="/browse/college"
              className="inline-flex items-center justify-center rounded-[14px] bg-[#F2F4F8] dark:bg-[#232732] hover:bg-[#E6E9F0] dark:hover:bg-gray-800 px-5 py-3 text-sm font-bold text-[#353842] dark:text-gray-200 transition-colors"
            >
              View Subject Plan
            </Link>
          </div>
        </div>

        {/* Preparation Summary Metrics Table */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 pt-6 border-t border-[#F0F2F6] dark:border-gray-800/80">
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#20232C] p-3.5 border border-[#EEF2F7] dark:border-gray-800">
            <div className="text-[11px] font-bold uppercase text-gray-400">Syllabus Covered</div>
            <div className="mt-1 text-lg sm:text-xl font-black text-[#2A7513] dark:text-[#64D841]">
              {activeExam.syllabusCovered}
            </div>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#20232C] p-3.5 border border-[#EEF2F7] dark:border-gray-800">
            <div className="text-[11px] font-bold uppercase text-gray-400">PYQs Attempted</div>
            <div className="mt-1 text-lg sm:text-xl font-black text-[#3168FF] dark:text-blue-400">
              {activeExam.pyqsAttempted}
            </div>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#20232C] p-3.5 border border-[#EEF2F7] dark:border-gray-800">
            <div className="text-[11px] font-bold uppercase text-gray-400">Units Revised</div>
            <div className="mt-1 text-lg sm:text-xl font-black text-amber-600 dark:text-amber-400">
              {activeExam.unitsRevised}
            </div>
          </div>
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#20232C] p-3.5 border border-[#EEF2F7] dark:border-gray-800">
            <div className="text-[11px] font-bold uppercase text-gray-400">Mock Papers</div>
            <div className="mt-1 text-lg sm:text-xl font-black text-[#6B31FF] dark:text-purple-400">
              {activeExam.mockPapers}
            </div>
          </div>
        </div>

        {/* Recommended Action Box */}
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 p-4 text-sm">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white shadow-2xs">
            <Sparkle size={15} weight="fill" />
          </span>
          <p className="font-semibold text-amber-950 dark:text-amber-200">
            <span className="font-extrabold mr-1 text-amber-700 dark:text-amber-400">Recommended Action:</span>
            {activeExam.recommendedAction}
          </p>
        </div>
      </div>

      {/* Examination Timeline */}
      <div className="pt-2">
        <h4 className="text-[11px] font-bold uppercase tracking-[0.05em] text-gray-400 dark:text-gray-500 mb-3">
          EXAMINATION TIMELINE (Click to view & plan)
        </h4>
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
          {EXAMS.map((exam, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={exam.id}
                type="button"
                onClick={() => setSelectedIndex(idx)}
                className={`group flex flex-col items-start text-left rounded-[16px] p-4.5 transition-all ${
                  isSelected
                    ? "bg-white dark:bg-[#1A1D24] shadow-md border-2 border-[#3168FF]"
                    : "bg-white/80 dark:bg-[#1A1D24]/60 border border-[#E8EAEE] dark:border-gray-800/80 hover:bg-white dark:hover:bg-[#1A1D24] hover:border-gray-300"
                }`}
              >
                <div className="flex w-full items-center justify-between text-xs font-extrabold">
                  <span className={isSelected ? "text-[#3168FF] dark:text-blue-400" : "text-gray-600 dark:text-gray-400"}>
                    {exam.date.split(" ")[0]} {exam.date.split(" ")[1].slice(0, 3)}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      exam.isNext
                        ? "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                        : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {exam.isNext ? "Next exam" : exam.remaining}
                  </span>
                </div>
                <h5 className="mt-2 text-sm font-extrabold text-gray-800 dark:text-gray-100 group-hover:text-[#3168FF] transition-colors line-clamp-1">
                  {exam.subject}
                </h5>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
