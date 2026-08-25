"use client";

import Link from "next/link";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  BookOpenText,
  ClockCounterClockwise,
  FileArchive,
  NotePencil,
  Scroll,
  Exam,
  CheckCircle,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { updateTaskStatusAction, rescheduleTaskAction } from "@/lib/planner-actions";
import type { SerializedTask } from "./planner-types";

export const TASK_TYPE_ICON = {
  LEARN: BookOpenText,
  REVISE: ClockCounterClockwise,
  SOLVE_PYQS: FileArchive,
  PRACTICE: NotePencil,
  ATTEMPT_PAPER: Scroll,
  MOCK_TEST: Exam,
} as const;

export const TASK_TYPE_LABEL: Record<SerializedTask["type"], string> = {
  LEARN: "Study",
  REVISE: "Revise",
  SOLVE_PYQS: "Solve PYQs",
  PRACTICE: "Practice",
  ATTEMPT_PAPER: "Attempt Paper",
  MOCK_TEST: "Mock Test",
};

export function TaskCard({ task }: { task: SerializedTask }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const Icon = TASK_TYPE_ICON[task.type];

  function setStatus(status: "IN_PROGRESS" | "DONE" | "SKIPPED") {
    startTransition(async () => {
      await updateTaskStatusAction(task.id, status);
      router.refresh();
    });
  }

  function reschedule() {
    startTransition(async () => {
      await rescheduleTaskAction(task.id);
      router.refresh();
    });
  }

  const done = task.status === "DONE";
  const missed = task.status === "SKIPPED";
  const movedOn = task.status === "RESCHEDULED";

  return (
    <div
      className={`rounded-2xl border border-border p-4 transition ${
        done || movedOn ? "bg-surface-muted/50 opacity-70" : "bg-surface"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
            done ? "bg-green-soft text-green" : "bg-brand-soft text-brand"
          }`}
        >
          {done ? <CheckCircle size={18} weight="bold" /> : <Icon size={18} weight="bold" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
            <span className="font-bold uppercase tracking-wide text-brand">{TASK_TYPE_LABEL[task.type]}</span>
            <span>· {task.subjectName}</span>
            <span>· {task.estimatedMinutes} min</span>
          </div>
          <Link
            href={task.resourceUrl}
            onClick={() => task.status === "TODO" && setStatus("IN_PROGRESS")}
            className={`mt-1 block text-sm font-semibold hover:text-brand ${done ? "text-muted line-through" : "text-foreground"}`}
          >
            {task.title}
          </Link>
        </div>
      </div>

      {!done && !movedOn && (
        <div className="mt-3 flex flex-wrap gap-2">
          {!missed && (
            <Link
              href={task.resourceUrl}
              onClick={() => setStatus("IN_PROGRESS")}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground hover:bg-brand/90"
            >
              Start
            </Link>
          )}
          <button
            type="button"
            disabled={isPending}
            onClick={() => setStatus("DONE")}
            className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            <CheckCircle size={14} weight="bold" />
            Done
          </button>
          {missed ? (
            <button
              type="button"
              disabled={isPending}
              onClick={reschedule}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand-soft disabled:opacity-50"
            >
              <ArrowsClockwise size={14} weight="bold" />
              Reschedule
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={() => setStatus("SKIPPED")}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold text-muted hover:bg-surface-muted disabled:opacity-50"
            >
              Skip
            </button>
          )}
        </div>
      )}
    </div>
  );
}
