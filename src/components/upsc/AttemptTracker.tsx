"use client";

import React from "react";

interface AttemptTrackerProps {
  total: number;
  attempted: number;
  correct: number;
  incorrect: number;
  onResetAttempts?: () => void;
}

export const AttemptTracker: React.FC<AttemptTrackerProps> = ({
  total,
  attempted,
  correct,
  incorrect,
  onResetAttempts,
}) => {
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
  const progressPercent = total > 0 ? Math.round((attempted / total) * 100) : 0;

  return (
    <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <span>📊</span> Live Practice Stats
        </h3>
        {attempted > 0 && onResetAttempts && (
          <button
            onClick={onResetAttempts}
            className="text-[11px] text-muted-foreground hover:text-destructive transition-colors underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 mb-3">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">Progress</span>
          <span className="font-medium text-foreground">
            {attempted} / {total} ({progressPercent}%)
          </span>
        </div>
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
          <div
            style={{ width: `${total > 0 ? (correct / total) * 100 : 0}%` }}
            className="bg-emerald-500 h-full transition-all duration-300"
          />
          <div
            style={{ width: `${total > 0 ? (incorrect / total) * 100 : 0}%` }}
            className="bg-rose-500 h-full transition-all duration-300"
          />
        </div>
      </div>

      {/* 3 Metrics Cards */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
          <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
            {correct}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Correct</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
          <div className="text-base font-bold text-rose-600 dark:text-rose-400">
            {incorrect}
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Incorrect</div>
        </div>
        <div className="p-2 rounded-lg bg-muted/40 border border-border/40">
          <div className="text-base font-bold text-amber-600 dark:text-amber-400">
            {accuracy}%
          </div>
          <div className="text-[10px] text-muted-foreground font-medium">Accuracy</div>
        </div>
      </div>
    </div>
  );
};
