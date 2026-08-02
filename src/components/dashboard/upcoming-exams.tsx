"use client";

import Link from "next/link";
import { CalendarBlank, CheckCircle, Clock, Sparkle, Target } from "@phosphor-icons/react";
import type { SubjectData } from "./subject-card";

interface UpcomingExamsProps {
  subjects: SubjectData[];
}

export function UpcomingExams({ subjects }: UpcomingExamsProps) {
  // Compute real study priority recommendations from available subject resources
  const pyqPrioritySubjects = subjects.filter((s) => s.pyqsCount > 0).slice(0, 2);
  const notesPrioritySubjects = subjects.filter((s) => s.notesCount > 0).slice(0, 2);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Upcoming Exams Card (With requested friendly empty state) */}
      <section className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 space-y-4" aria-labelledby="upcoming-exams-title">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <CalendarBlank size={20} weight="bold" className="text-brand" />
            <h3 id="upcoming-exams-title" className="text-base font-bold font-display text-foreground">
              Upcoming Exams
            </h3>
          </div>
          <p className="text-xs text-muted">Delhi University semester exam calendar</p>
        </div>

        {/* Empty State as requested */}
        <div className="flex flex-col items-center justify-center rounded-xl bg-surface-muted p-6 text-center space-y-2">
          <Clock size={28} weight="duotone" className="text-muted" />
          <p className="text-xs font-bold text-foreground">No exam dates have been added yet</p>
          <p className="text-[11px] text-muted max-w-xs">
            You can still organize your subjects and revision material in advance for Delhi University exams.
          </p>
        </div>

        <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border/60">
          <span>Official DU Date Sheet</span>
          <span className="font-semibold text-brand">Coming soon</span>
        </div>
      </section>

      {/* Study Priorities Card (Generated dynamically from real subject data) */}
      <section className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 space-y-4" aria-labelledby="study-priorities-title">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Target size={20} weight="bold" className="text-amber-500" />
            <h3 id="study-priorities-title" className="text-base font-bold font-display text-foreground">
              Study Priorities
            </h3>
          </div>
          <p className="text-xs text-muted">Recommended focus areas based on available vault material</p>
        </div>

        <div className="space-y-3">
          {pyqPrioritySubjects.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-blue-500/10 p-3 text-xs">
              <Sparkle size={18} weight="fill" className="text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground">PYQ Practice Recommended</p>
                <p className="text-[11px] text-muted truncate">
                  {pyqPrioritySubjects.map((s) => s.name).join(", ")}
                </p>
              </div>
              <Link
                href={`/subjects/${pyqPrioritySubjects[0].id}`}
                className="text-[11px] font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
              >
                Solve
              </Link>
            </div>
          )}

          {notesPrioritySubjects.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl bg-emerald-500/10 p-3 text-xs">
              <CheckCircle size={18} weight="fill" className="text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-foreground">Fresh Notes Available</p>
                <p className="text-[11px] text-muted truncate">
                  {notesPrioritySubjects.map((s) => s.name).join(", ")}
                </p>
              </div>
              <Link
                href={`/subjects/${notesPrioritySubjects[0].id}`}
                className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
              >
                Read
              </Link>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted pt-2 border-t border-border/60">
          <span>Priority Algorithm</span>
          <span className="font-semibold text-foreground">Active</span>
        </div>
      </section>
    </div>
  );
}
