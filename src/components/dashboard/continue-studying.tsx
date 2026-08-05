"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Clock, FileText, ListChecks } from "@phosphor-icons/react";

export interface StudyActivityItem {
  id: string;
  title: string;
  type: "NOTES" | "PYQ" | "ANSWER_KEY" | "SYLLABUS";
  subjectId: string;
  subjectName: string;
  lastOpenedAgo: string;
  progress?: number;
  statusText?: string;
  href?: string;
}

interface ContinueStudyingProps {
  items?: StudyActivityItem[];
}

const DEFAULT_RECENT_ITEMS: StudyActivityItem[] = [
  {
    id: "fm-2024",
    title: "Financial Management 2024 PYQ",
    type: "PYQ",
    subjectId: "fm",
    subjectName: "Financial Management",
    lastOpenedAgo: "Last opened 2 hours ago",
    progress: 44,
    statusText: "Question 4 of 9 · 44% completed",
    href: "/pyq-notes",
  },
  {
    id: "pp-notes",
    title: "Unit 2: Capital Budgeting Decisions",
    type: "NOTES",
    subjectId: "fm",
    subjectName: "Financial Management",
    lastOpenedAgo: "Last opened yesterday",
    progress: 78,
    statusText: "Section 6 of 8 · 78% revised",
    href: "/browse/college",
  },
  {
    id: "ba-practice",
    title: "Predictive Modelling Formula Sheet",
    type: "NOTES",
    subjectId: "ba",
    subjectName: "Business Analytics",
    lastOpenedAgo: "Last opened 2 days ago",
    progress: 30,
    statusText: "Page 3 of 10 · 30% read",
    href: "/browse/college",
  },
];

export function ContinueStudying({ items = [] }: ContinueStudyingProps) {
  // Use provided items or fall back to high-fidelity mock recent items, limited to max 3
  const activeItems = items && items.length > 0
    ? items.slice(0, 3).map((item, index) => ({
        ...item,
        progress: item.progress ?? (index === 0 ? 44 : index === 1 ? 78 : 30),
        statusText: item.statusText ?? (index === 0 ? "Question 4 of 9 · 44% completed" : "In progress"),
        href: "/pyq-notes",
      }))
    : DEFAULT_RECENT_ITEMS;

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
          CONTINUE STUDYING
        </h3>
        <Link
          href="/pyq-notes"
          className="text-xs font-semibold text-[#3168FF] hover:underline transition-colors"
        >
          View Full History →
        </Link>
      </div>

      {/* 3-Card Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
        {activeItems.map((item) => {
          const Icon = item.type === "PYQ" ? ListChecks : item.type === "NOTES" ? FileText : BookOpen;
          return (
            <div
              key={item.id}
              className="group flex flex-col justify-between rounded-[18px] bg-white dark:bg-[#1A1D24] p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] border border-[#EAEBF0] dark:border-gray-800/80 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200"
            >
              <div>
                {/* Subject & Icon */}
                <div className="flex items-center justify-between text-xs font-bold text-gray-400">
                  <span className="truncate pr-2">{item.subjectName}</span>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#F2F4F8] dark:bg-[#232732] text-gray-600 dark:text-gray-300 group-hover:bg-[#3168FF] group-hover:text-white transition-colors">
                    <Icon size={16} weight="bold" />
                  </span>
                </div>

                {/* Title */}
                <h4 className="mt-2 text-base font-extrabold text-gray-900 dark:text-white line-clamp-1 group-hover:text-[#3168FF] transition-colors">
                  {item.title}
                </h4>

                {/* Status text */}
                <p className="mt-1.5 text-xs font-semibold text-[#646B78] dark:text-gray-400">
                  {item.statusText}
                </p>

                {/* Progress Bar */}
                <div className="mt-3.5 h-1.5 w-full overflow-hidden rounded-full bg-[#EBECEF] dark:bg-gray-800">
                  <div
                    className="h-full rounded-full bg-[#3168FF] transition-all duration-500"
                    style={{ width: `${item.progress || 35}%` }}
                  />
                </div>

                {/* Timestamp */}
                <div className="mt-3 flex items-center gap-1 text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  <Clock size={13} />
                  <span>{item.lastOpenedAgo}</span>
                </div>
              </div>

              {/* Action Button */}
              <div className="mt-5 pt-4 border-t border-[#F0F2F6] dark:border-gray-800/80">
                <Link
                  href={item.href || "/pyq-notes"}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#F4F5F9] dark:bg-[#232732] hover:bg-[#3168FF] dark:hover:bg-[#3168FF] text-gray-800 dark:text-gray-200 hover:text-white py-2.5 px-4 text-xs font-bold transition-all duration-200 active:scale-95"
                >
                  <span>Continue Attempt</span>
                  <ArrowRight size={13} weight="bold" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
