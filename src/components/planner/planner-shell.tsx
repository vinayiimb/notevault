"use client";

import { useState } from "react";
import { StudyNowCard } from "./study-now-card";
import { TodayPlan } from "./today-plan";
import { WeekView } from "./week-view";
import { ProgressSummary } from "./progress-summary";
import type { SerializedPlan } from "./planner-types";

const TABS = [
  { key: "today", label: "Today" },
  { key: "week", label: "Week" },
  { key: "progress", label: "Progress" },
] as const;

export function PlannerShell({ plan }: { plan: SerializedPlan }) {
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("today");

  const nearestExam = plan.subjects.reduce<SerializedPlan["subjects"][number] | null>((min, s) => {
    if (!min) return s;
    return new Date(s.examDate) < new Date(min.examDate) ? s : min;
  }, null);
  const daysToExam = nearestExam
    ? Math.max(0, Math.round((new Date(nearestExam.examDate).getTime() - Date.now()) / 86_400_000))
    : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">My Study Planner</h1>
        {nearestExam && daysToExam !== null && (
          <p className="mt-1 text-sm text-muted">
            <span className="font-bold text-brand">{nearestExam.subjectName}</span> exam in{" "}
            <span className="font-bold text-foreground">
              {daysToExam} day{daysToExam === 1 ? "" : "s"}
            </span>
          </p>
        )}
      </div>

      <StudyNowCard plan={plan} />

      <div className="flex w-fit gap-1 rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-lg px-4 py-1.5 text-sm font-bold transition ${
              tab === t.key ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "today" && <TodayPlan plan={plan} />}
      {tab === "week" && <WeekView plan={plan} />}
      {tab === "progress" && <ProgressSummary plan={plan} />}
    </div>
  );
}
