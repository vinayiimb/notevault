"use client";

import React from "react";
import { ALL_YEARS } from "@/lib/upsc-data";

interface YearFilterProps {
  selectedYears: string[];
  onToggleYear: (year: string) => void;
  onSelectAllYears: () => void;
  onClearYears: () => void;
}

export const YearFilter: React.FC<YearFilterProps> = ({
  selectedYears,
  onToggleYear,
  onSelectAllYears,
  onClearYears,
}) => {
  const isAllSelected = selectedYears.length === ALL_YEARS.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Years (2013–2025)
        </label>
        <div className="flex items-center gap-1.5 text-[11px]">
          <button
            onClick={onSelectAllYears}
            className="text-amber-600 dark:text-amber-400 hover:underline font-medium"
          >
            All
          </button>
          <span className="text-muted-foreground">·</span>
          <button
            onClick={onClearYears}
            className="text-muted-foreground hover:text-foreground font-medium"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Grid of Year Pills */}
      <div className="grid grid-cols-4 gap-1.5">
        {ALL_YEARS.map((yr) => {
          const isSelected = selectedYears.includes(yr);
          return (
            <button
              key={yr}
              onClick={() => onToggleYear(yr)}
              className={`py-1 px-1.5 rounded-lg text-xs font-mono font-medium border transition-all text-center ${
                isSelected
                  ? "bg-amber-500 text-white border-amber-600 font-bold shadow-2xs"
                  : "bg-muted/30 text-muted-foreground hover:bg-muted border-border/70"
              }`}
            >
              {yr}
            </button>
          );
        })}
      </div>
    </div>
  );
};
