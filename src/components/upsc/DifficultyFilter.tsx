"use client";

import React from "react";
import { DIFFICULTIES } from "@/lib/upsc-data";

interface DifficultyFilterProps {
  selectedDifficulty: string | null;
  onSelectDifficulty: (difficulty: string | null) => void;
}

export const DifficultyFilter: React.FC<DifficultyFilterProps> = ({
  selectedDifficulty,
  onSelectDifficulty,
}) => {
  const diffColors: Record<string, { bg: string; dot: string; text: string }> = {
    Easy: { bg: "hover:border-emerald-500/50", dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400" },
    Moderate: { bg: "hover:border-amber-500/50", dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400" },
    Hard: { bg: "hover:border-rose-500/50", dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400" },
    All: { bg: "hover:border-primary/50", dot: "bg-primary", text: "text-foreground" },
  };

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
        Difficulty Level
      </label>
      <div className="grid grid-cols-4 gap-1.5">
        {DIFFICULTIES.map((diff) => {
          const isSelected =
            (diff === "All" && (!selectedDifficulty || selectedDifficulty === "All")) ||
            selectedDifficulty === diff;
          const conf = diffColors[diff] || diffColors.All;
          return (
            <button
              key={diff}
              onClick={() => onSelectDifficulty(diff === "All" ? null : diff)}
              className={`py-1.5 px-2 rounded-lg text-xs font-medium border flex items-center justify-center gap-1.5 transition-all ${
                isSelected
                  ? "bg-card text-foreground font-semibold border-border shadow-xs ring-1 ring-border"
                  : `bg-muted/30 text-muted-foreground ${conf.bg} border-border/60`
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${conf.dot}`} />
              <span>{diff}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
