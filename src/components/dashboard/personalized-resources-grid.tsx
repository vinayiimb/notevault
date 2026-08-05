"use client";

import Link from "next/link";
import {
  BookBookmark,
  BookmarkSimple,
  BookOpen,
  CheckCircle,
  CheckSquare,
  Compass,
  FileText,
  Lightbulb,
  ListChecks,
} from "@phosphor-icons/react";

interface ResourceCategory {
  id: string;
  title: string;
  countBadge: string;
  description: string;
  archiveText: string;
  href: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

const RESOURCE_CATEGORIES: ResourceCategory[] = [
  {
    id: "pyqs",
    title: "Previous-Year Papers",
    countBadge: "14 papers for your subjects",
    description: "Browse by subject, year and paper type.",
    archiveText: "Total archive: 1,248 papers",
    href: "/pyq-notes",
    icon: ListChecks,
    iconBg: "bg-blue-50 dark:bg-blue-950/50",
    iconColor: "text-[#3168FF] dark:text-blue-400",
  },
  {
    id: "notes",
    title: "Notes",
    countBadge: "22 notes available",
    description: "Unit-wise and revision-focused material.",
    archiveText: "Total archive: 430 revision sets",
    href: "/browse/college",
    icon: FileText,
    iconBg: "bg-amber-50 dark:bg-amber-950/50",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "answer-keys",
    title: "Answer Keys",
    countBadge: "8 solved papers available",
    description: "Reviewed answers and model structures.",
    archiveText: "Total archive: 215 verified solutions",
    href: "/browse/college",
    icon: CheckSquare,
    iconBg: "bg-emerald-50 dark:bg-emerald-950/50",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
  {
    id: "syllabus",
    title: "Official Syllabus",
    countBadge: "5 current subject syllabi",
    description: "Official units, outcomes and readings.",
    archiveText: "Updated for DU NEP 2024-26",
    href: "/programs",
    icon: Compass,
    iconBg: "bg-purple-50 dark:bg-purple-950/50",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  {
    id: "important-questions",
    title: "Important Questions",
    countBadge: "36 repeated questions",
    description: "Questions organised by topic and frequency.",
    archiveText: "Powered by PYQ Intelligence",
    href: "/tools/exam-kit",
    icon: Lightbulb,
    iconBg: "bg-rose-50 dark:bg-rose-950/50",
    iconColor: "text-rose-600 dark:text-rose-400",
  },
  {
    id: "books",
    title: "Books and Resources",
    countBadge: "12 recommended resources",
    description: "Reading lists, open-access material and reference books.",
    archiveText: "Curated DU reading library",
    href: "/browse/college",
    icon: BookBookmark,
    iconBg: "bg-indigo-50 dark:bg-indigo-950/50",
    iconColor: "text-indigo-600 dark:text-indigo-400",
  },
];

export function PersonalizedResourcesGrid() {
  return (
    <section className="space-y-4">
      {/* Section Header */}
      <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
        MAIN STUDY RESOURCES
      </h3>

      {/* 6-Card Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCE_CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          return (
            <Link
              key={cat.id}
              href={cat.href}
              className="group flex flex-col justify-between rounded-[18px] bg-white dark:bg-[#1A1D24] p-5 sm:p-6 shadow-[0_2px_12px_rgba(0,0,0,0.025)] border border-[#EBECEF] dark:border-gray-800/80 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200 hover:-translate-y-0.5"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex size-11 items-center justify-center rounded-[14px] ${cat.iconBg} ${cat.iconColor} shadow-2xs group-hover:scale-105 transition-transform`}>
                    <Icon size={24} weight="bold" />
                  </span>
                  <span className="inline-block rounded-full bg-[#F2F4F8] dark:bg-[#232732] px-3 py-1 text-[11px] font-bold text-gray-700 dark:text-gray-300 border border-gray-200/60 dark:border-gray-700">
                    {cat.countBadge}
                  </span>
                </div>

                <h4 className="mt-4 text-lg font-extrabold text-gray-900 dark:text-white group-hover:text-[#3168FF] dark:group-hover:text-blue-400 transition-colors">
                  {cat.title}
                </h4>

                <p className="mt-1 text-xs font-medium text-[#646B78] dark:text-gray-400 leading-relaxed">
                  {cat.description}
                </p>
              </div>

              <div className="mt-5 pt-3.5 border-t border-[#F0F2F6] dark:border-gray-800/80 flex items-center justify-between text-[11px] font-semibold text-gray-400 dark:text-gray-500">
                <span>{cat.archiveText}</span>
                <span className="text-[#3168FF] dark:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 font-bold">
                  Browse →
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
