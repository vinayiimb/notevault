"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarBlank, Sparkle } from "@phosphor-icons/react";
import { resumePlanAction } from "@/lib/planner-actions";
import { PlannerWizard } from "./planner-wizard";
import type { WizardProgram } from "./planner-types";

interface PlannerLandingProps {
  programs: WizardProgram[];
  upcomingExams: { id: string; subjectName: string; examDate: string }[];
  resumablePlanId: string | null;
}

function daysUntil(iso: string) {
  const today = new Date(new Date().toDateString());
  const target = new Date(new Date(iso).toDateString());
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function PlannerLanding({ programs, upcomingExams, resumablePlanId }: PlannerLandingProps) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const nearestExam = upcomingExams[0];

  if (wizardOpen) {
    return <PlannerWizard programs={programs} onCancel={() => setWizardOpen(false)} />;
  }

  return (
    <div className="mx-auto max-w-2xl py-8 text-center">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-bold text-brand">
        <Sparkle size={14} weight="bold" />
        Study Planner
      </span>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Build Your DU Exam Plan</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm text-muted sm:text-base">
        Tell us your subjects, exam dates, and available study time. We&apos;ll build a personalized plan using your
        syllabus and previous-year questions.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setWizardOpen(true)}
          className="rounded-xl bg-brand px-6 py-3 text-sm font-bold text-brand-foreground hover:bg-brand/90"
        >
          Create My Plan
        </button>
        {resumablePlanId && (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await resumePlanAction(resumablePlanId);
                router.refresh();
              })
            }
            className="rounded-xl border border-border px-6 py-3 text-sm font-bold text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            {isPending ? "Resuming…" : "Continue Existing Plan"}
          </button>
        )}
      </div>

      {nearestExam && (
        <div className="mx-auto mt-8 flex w-fit items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm">
          <CalendarBlank size={16} weight="bold" className="text-brand" />
          <span className="font-semibold text-foreground">{nearestExam.subjectName}</span>
          <span className="text-muted">in {Math.max(0, daysUntil(nearestExam.examDate))} days</span>
        </div>
      )}
    </div>
  );
}
