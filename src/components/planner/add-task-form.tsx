"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addCustomTaskAction, type AddCustomTaskInput } from "@/lib/planner-actions";
import type { SerializedPlan } from "./planner-types";
import { TASK_TYPE_LABEL } from "./task-card";

const TASK_TYPES = Object.keys(TASK_TYPE_LABEL) as AddCustomTaskInput["type"][];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function AddTaskForm({ plan, onDone }: { plan: SerializedPlan; onDone: () => void }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const input: AddCustomTaskInput = {
      planId: plan.id,
      subjectId: String(formData.get("subjectId")),
      type: formData.get("type") as AddCustomTaskInput["type"],
      title: String(formData.get("title")),
      scheduledDate: String(formData.get("scheduledDate")),
      estimatedMinutes: Number(formData.get("estimatedMinutes")),
      priority: formData.get("priority") as AddCustomTaskInput["priority"],
    };
    startTransition(async () => {
      try {
        await addCustomTaskAction(input);
        router.refresh();
        onDone();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't add that task.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface p-4">
      <div>
        <label className="text-xs font-bold text-muted">Task</label>
        <input
          name="title"
          required
          placeholder="e.g. Read teacher's notes"
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <label className="text-xs font-bold text-muted">Subject</label>
          <select
            name="subjectId"
            required
            defaultValue={plan.subjects[0]?.subjectId}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent"
          >
            {plan.subjects.map((s) => (
              <option key={s.subjectId} value={s.subjectId}>
                {s.subjectName}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted">Type</label>
          <select
            name="type"
            defaultValue="LEARN"
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent"
          >
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>
                {TASK_TYPE_LABEL[t]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-muted">Date</label>
          <input
            name="scheduledDate"
            type="date"
            required
            defaultValue={todayIso()}
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="text-xs font-bold text-muted">Minutes</label>
          <input
            name="estimatedMinutes"
            type="number"
            min={5}
            max={240}
            defaultValue={45}
            required
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-bold text-muted">Priority</label>
        <div className="mt-1 flex gap-2">
          {(["HIGH", "MEDIUM", "LOW"] as const).map((p, i) => (
            <label key={p} className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-bold has-[:checked]:border-brand has-[:checked]:bg-brand-soft has-[:checked]:text-brand">
              <input type="radio" name="priority" value={p} defaultChecked={i === 1} className="sr-only" />
              {p.charAt(0) + p.slice(1).toLowerCase()}
            </label>
          ))}
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-red-500">{error}</p>}

      <div className="flex gap-2 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
        >
          {isPending ? "Adding…" : "Add Task"}
        </button>
        <button type="button" onClick={onDone} className="rounded-lg border border-border px-4 py-2 text-sm font-bold text-muted hover:bg-surface-muted">
          Cancel
        </button>
      </div>
    </form>
  );
}
