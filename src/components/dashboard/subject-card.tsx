"use client";

import Link from "next/link";
import { ArrowRight, BookmarkSimple } from "@phosphor-icons/react";
import { useSavedItems } from "@/lib/dashboard-store";

export interface SubjectData {
  id: string;
  name: string;
  code?: string;
  courseType?: "DSC" | "GE" | "SEC" | "VAC" | "AEC" | "CORE";
  description?: string | null;
  notesCount: number;
  pyqsCount: number;
  answersCount: number;
  latestResourceTitle?: string | null;
  latestResourceType?: "NOTES" | "PYQ" | null;
}

interface SubjectCardProps {
  subject: SubjectData;
}

export function SubjectCard({ subject }: SubjectCardProps) {
  const { isItemSaved, saveItem, removeSavedItem } = useSavedItems();
  const saved = isItemSaved(subject.id);

  // Extract course type from description or code if not explicitly given
  const detectCourseType = (): { label: string; colorClass: string } => {
    const text = (subject.description || subject.name).toUpperCase();
    if (text.includes("CORE") || subject.courseType === "CORE") {
      return { label: "CORE", colorClass: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
    }
    if (text.includes("GENERIC") || text.includes("GE") || subject.courseType === "GE") {
      return { label: "GE", colorClass: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
    }
    if (text.includes("SKILL") || text.includes("SEC") || subject.courseType === "SEC") {
      return { label: "SEC", colorClass: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
    }
    if (text.includes("VALUE") || text.includes("VAC") || subject.courseType === "VAC") {
      return { label: "VAC", colorClass: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };
    }
    if (text.includes("ABILITY") || text.includes("AEC") || subject.courseType === "AEC") {
      return { label: "AEC", colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
    }
    return { label: "DSC", colorClass: "bg-brand/10 text-brand border-brand/20" };
  };

  const badge = detectCourseType();

  const handleToggleBookmark = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (saved) {
      removeSavedItem(subject.id);
    } else {
      saveItem({
        id: subject.id,
        type: "subject",
        title: subject.name,
        url: `/subjects/${subject.id}`,
      });
    }
  };

  return (
    <article className="group relative flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-lg space-y-4">
      {/* Top Header */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${badge.colorClass}`}>
            {badge.label}
          </span>
          <button
            type="button"
            onClick={handleToggleBookmark}
            title={saved ? "Remove from saved" : "Save subject"}
            className={`flex size-8 items-center justify-center rounded-lg transition-colors ${
              saved
                ? "bg-amber-500/10 text-amber-500"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            <BookmarkSimple size={18} weight={saved ? "fill" : "bold"} />
          </button>
        </div>

        <div>
          <h3 className="text-base font-bold text-foreground group-hover:text-brand transition-colors line-clamp-2">
            {subject.name}
          </h3>
          {subject.description && (
            <p className="mt-1 text-xs text-muted line-clamp-1">{subject.description}</p>
          )}
        </div>
      </div>

      {/* Resource Indicators */}
      <div className="space-y-3 pt-2 border-t border-border/60">
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-xl bg-surface-muted p-2">
            <span className="block font-bold text-foreground">{subject.notesCount}</span>
            <span className="text-[10px] text-muted font-medium">Notes</span>
          </div>
          <div className="rounded-xl bg-surface-muted p-2">
            <span className="block font-bold text-foreground">{subject.pyqsCount}</span>
            <span className="text-[10px] text-muted font-medium">PYQs</span>
          </div>
          <div className="rounded-xl bg-surface-muted p-2">
            <span className="block font-bold text-foreground">{subject.answersCount}</span>
            <span className="text-[10px] text-muted font-medium">Keys</span>
          </div>
        </div>

        {subject.latestResourceTitle && (
          <div className="flex items-center gap-2 rounded-xl bg-brand-soft/60 px-3 py-2 text-[11px]">
            <span className="flex size-2 shrink-0 rounded-full bg-brand animate-pulse" />
            <span className="truncate text-foreground font-medium">
              <strong className="font-semibold text-brand">Latest:</strong> {subject.latestResourceTitle}
            </span>
          </div>
        )}
      </div>

      {/* Footer Action */}
      <Link
        href={`/subjects/${subject.id}`}
        className="inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 text-xs font-semibold text-brand-foreground hover:bg-brand-hover transition-colors shadow-sm"
      >
        <span>Open Subject</span>
        <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
