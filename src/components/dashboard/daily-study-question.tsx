"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, BookmarkSimple, Repeat } from "@phosphor-icons/react";

export interface DailyStudyQuestionProps {
  question?: {
    id: string;
    questionText: string;
    marks: number | null;
    isRepeated: boolean;
    repeatCount: number;
    years: string | null;
    subject: { id: string; name: string } | null;
  } | null;
}

export function DailyStudyQuestion({ question }: DailyStudyQuestionProps) {
  const [saved, setSaved] = useState(false);
  const years = question?.years?.split(",").map((y) => y.trim()).filter(Boolean) ?? [];

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
        TODAY&apos;S STUDY QUESTION
      </h3>

      {/* Main Card */}
      <div className="rounded-[20px] bg-white dark:bg-[#1A1D24] p-6 sm:p-7 shadow-[0_2px_12px_rgba(0,0,0,0.03)] dark:shadow-none transition-all duration-200">
        {!question ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No questions have been added to the vault yet — check back soon.
          </p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap text-xs">
                  {question.subject && (
                    <span className="rounded-full bg-blue-50 dark:bg-blue-900/40 px-2.5 py-0.5 font-bold text-[#3168FF]">
                      {question.subject.name}
                    </span>
                  )}
                  {question.marks != null && (
                    <span className="rounded-full bg-[#F4F5F7] dark:bg-gray-800 px-2.5 py-0.5 font-bold text-gray-600 dark:text-gray-300">
                      {question.marks} marks
                    </span>
                  )}
                  {question.isRepeated && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/30 px-2.5 py-0.5 font-bold text-[#FF7527]">
                      <Repeat size={12} weight="bold" />
                      Repeated {question.repeatCount}x
                    </span>
                  )}
                </div>
                <h4 className="mt-3 text-lg font-bold leading-snug tracking-tight text-gray-900 dark:text-white">
                  {question.questionText}
                </h4>
                {years.length > 0 && (
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Appeared in: {years.join(", ")}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => setSaved(!saved)}
                title={saved ? "Remove bookmark" : "Save question"}
                className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#F4F5F7] dark:bg-gray-800 text-gray-500 hover:text-gray-900 transition-colors"
              >
                {saved ? (
                  <Bookmark size={18} weight="fill" className="text-[#FF7527]" />
                ) : (
                  <BookmarkSimple size={18} weight="bold" />
                )}
              </button>
            </div>

            {question.subject && (
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-[#F8F9FB] dark:bg-[#20232C] p-4 text-sm">
                <span className="text-gray-600 dark:text-gray-400">Start with this question&apos;s subject</span>
                <Link
                  href={`/subjects/${question.subject.id}`}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#3168FF] hover:underline shrink-0"
                >
                  <span>Open subject</span>
                  <ArrowRight size={12} weight="bold" />
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  );
}
