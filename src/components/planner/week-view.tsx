"use client";

import Link from "next/link";
import type { SerializedPlan } from "./planner-types";
import { TASK_TYPE_LABEL } from "./task-card";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function WeekView({ plan }: { plan: SerializedPlan }) {
  const weekStart = startOfWeek(new Date());
  const days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    return date;
  });

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
      {days.map((date) => {
        const dayTasks = plan.tasks.filter(
          (t) => new Date(t.scheduledDate).toDateString() === date.toDateString() && t.status !== "RESCHEDULED"
        );
        const minutes = dayTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
        const isToday = date.toDateString() === new Date().toDateString();
        const doneCount = dayTasks.filter((t) => t.status === "DONE").length;

        return (
          <div
            key={date.toISOString()}
            className={`rounded-2xl border p-4 ${isToday ? "border-brand bg-brand-soft/30" : "border-border bg-surface"}`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-muted">
                {date.toLocaleDateString("en-IN", { weekday: "short" })}
              </span>
              <span className="text-xs font-bold text-muted">{date.getDate()}</span>
            </div>

            {dayTasks.length === 0 ? (
              <p className="mt-3 text-xs text-muted">No tasks</p>
            ) : (
              <>
                <p className="mt-2 text-xs font-semibold text-foreground">
                  {Math.round(minutes / 60 * 10) / 10}h · {doneCount}/{dayTasks.length} done
                </p>
                <ul className="mt-2 space-y-1.5">
                  {dayTasks.slice(0, 3).map((task) => (
                    <li key={task.id}>
                      <Link
                        href={task.resourceUrl}
                        className={`block truncate text-xs font-medium hover:text-brand ${
                          task.status === "DONE" ? "text-muted line-through" : "text-foreground"
                        }`}
                        title={`${TASK_TYPE_LABEL[task.type]} · ${task.title}`}
                      >
                        {task.subjectName}
                      </Link>
                    </li>
                  ))}
                  {dayTasks.length > 3 && (
                    <li className="text-[11px] font-semibold text-muted">+{dayTasks.length - 3} more</li>
                  )}
                </ul>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
