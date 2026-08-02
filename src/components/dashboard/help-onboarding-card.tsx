"use client";

import { useState } from "react";
import { Check, Sparkle, X } from "@phosphor-icons/react";

const ONBOARDING_DISMISSED_KEY = "notevault_onboarding_dismissed";

interface OnboardingProps {
  hasCourseSelected?: boolean;
  hasSemesterSelected?: boolean;
}

export function HelpOnboardingCard({
  hasCourseSelected = true,
  hasSemesterSelected = true,
}: OnboardingProps) {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(ONBOARDING_DISMISSED_KEY) === "true";
    }
    return false;
  });

  const handleDismiss = () => {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem(ONBOARDING_DISMISSED_KEY, "true");
    }
  };

  if (dismissed) return null;

  const STEPS = [
    { label: "Select course", completed: hasCourseSelected },
    { label: "Select semester", completed: hasSemesterSelected },
    { label: "Explore subjects", completed: true },
    { label: "Save your first resource", completed: false },
  ];

  return (
    <div className="relative overflow-hidden rounded-2xl border border-brand/30 bg-gradient-to-r from-brand-soft via-surface to-surface p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-brand text-brand-foreground font-bold">
            <Sparkle size={16} weight="fill" />
          </span>
          <div>
            <h3 className="text-sm font-bold text-foreground">Complete your study setup</h3>
            <p className="text-xs text-muted">Quick onboarding steps for Delhi University students</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss onboarding card"
          className="flex size-7 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        >
          <X size={16} weight="bold" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((step, idx) => (
          <div
            key={step.label}
            className={`flex items-center gap-3 rounded-xl border p-3 text-xs font-semibold ${
              step.completed
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-border bg-surface text-muted"
            }`}
          >
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                step.completed ? "bg-emerald-500 text-white" : "bg-surface-muted text-muted"
              }`}
            >
              {step.completed ? <Check size={12} weight="bold" /> : idx + 1}
            </span>
            <span className="truncate">{step.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
