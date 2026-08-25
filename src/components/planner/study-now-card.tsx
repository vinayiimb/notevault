"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Sparkle, ArrowsClockwise } from "@phosphor-icons/react";
import type { SerializedPlan } from "./planner-types";
import { TASK_TYPE_ICON, TASK_TYPE_LABEL } from "./task-card";

function whyReasons(plan: SerializedPlan, subjectId: string, daysUntilExam: number) {
  const reasons: string[] = [];
  if (daysUntilExam <= 14) reasons.push(`Exam in ${Math.max(daysUntilExam, 0)} day${daysUntilExam === 1 ? "" : "s"}`);
  const prep = plan.subjects.find((s) => s.subjectId === subjectId)?.preparationLevel;
  if (prep === "NOT_STARTED" || prep === "BASIC") reasons.push("You haven't covered this yet");
  reasons.push("Highest priority right now");
  return reasons;
}

export function StudyNowCard({ plan }: { plan: SerializedPlan }) {
  const [cursor, setCursor] = useState(0);
  const today = new Date();

  const eligible = useMemo(() => {
    const startOfToday = new Date(today.toDateString());
    return plan.tasks
      .filter((t) => (t.status === "TODO" || t.status === "IN_PROGRESS") && new Date(t.scheduledDate.slice(0, 10)) <= startOfToday)
      .sort((a, b) => b.priority - a.priority);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan.tasks]);

  if (eligible.length === 0) return null;

  const task = eligible[cursor % eligible.length];
  const examDate = plan.subjects.find((s) => s.subjectId === task.subjectId)?.examDate;
  const daysUntilExam = examDate ? Math.round((new Date(examDate).getTime() - today.getTime()) / 86_400_000) : 999;
  const Icon = TASK_TYPE_ICON[task.type];

  return (
    <section className="rounded-2xl border border-brand/30 bg-brand-soft/30 p-6">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand">
        <Sparkle size={14} weight="bold" />
        Study this next
      </div>

      <div className="mt-3 flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground">
          <Icon size={20} weight="bold" />
        </span>
        <div>
          <p className="text-sm font-bold text-muted">{task.subjectName}</p>
          <h3 className="text-lg font-bold text-foreground">{task.title}</h3>
          <p className="text-sm text-muted">{task.estimatedMinutes} min · {TASK_TYPE_LABEL[task.type]}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {whyReasons(plan, task.subjectId, daysUntilExam).map((reason) => (
          <span key={reason} className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-muted">
            {reason}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={task.resourceUrl} className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground hover:bg-brand/90">
          Start Studying
        </Link>
        {eligible.length > 1 && (
          <button
            type="button"
            onClick={() => setCursor((c) => c + 1)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted"
          >
            <ArrowsClockwise size={14} weight="bold" />
            Give Me Something Else
          </button>
        )}
      </div>
    </section>
  );
}
