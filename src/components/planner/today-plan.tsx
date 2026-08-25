"use client";

import { useState } from "react";
import { Plus } from "@phosphor-icons/react";
import { TaskCard } from "./task-card";
import { AddTaskForm } from "./add-task-form";
import type { SerializedPlan, SerializedTask } from "./planner-types";

function isSameDay(iso: string, date: Date) {
  return new Date(iso).toDateString() === date.toDateString();
}

function isOverdue(task: SerializedTask, today: Date) {
  return (
    (task.status === "TODO" || task.status === "IN_PROGRESS") &&
    new Date(task.scheduledDate).toDateString() !== today.toDateString() &&
    new Date(task.scheduledDate) < today
  );
}

export function TodayPlan({ plan }: { plan: SerializedPlan }) {
  const [addingTask, setAddingTask] = useState(false);
  const today = new Date();

  const overdue = plan.tasks.filter((t) => isOverdue(t, today));
  const todayTasks = plan.tasks.filter((t) => isSameDay(t.scheduledDate, today));
  const plannedMinutes = todayTasks
    .filter((t) => t.status !== "SKIPPED" && t.status !== "RESCHEDULED")
    .reduce((sum, t) => sum + t.estimatedMinutes, 0);
  const hours = Math.floor(plannedMinutes / 60);
  const minutes = plannedMinutes % 60;

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-bold text-foreground">
            You missed {overdue.length} task{overdue.length > 1 ? "s" : ""} from earlier.
          </p>
          <p className="mt-1 text-xs text-muted">Reschedule from the task card, or catch up below.</p>
          <div className="mt-3 space-y-3">
            {overdue.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">
            {today.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}
          </h2>
          <p className="text-sm text-muted">
            {plannedMinutes > 0 ? `${hours > 0 ? `${hours}h ` : ""}${minutes}m planned` : "Nothing left today"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddingTask((v) => !v)}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground hover:bg-surface-muted"
        >
          <Plus size={14} weight="bold" />
          Add Task
        </button>
      </div>

      {addingTask && (
        <AddTaskForm plan={plan} onDone={() => setAddingTask(false)} />
      )}

      {todayTasks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          No tasks scheduled for today. Enjoy the break, or add one yourself.
        </div>
      ) : (
        <div className="space-y-3">
          {todayTasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      )}
    </div>
  );
}
