"use client";

import React from "react";

export const ExamSelector: React.FC = () => {
  return (
    <div className="space-y-2">
      <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
        Target Examination
      </label>
      <div className="p-2.5 rounded-xl bg-muted/40 border border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center font-bold text-xs border border-amber-500/20">
            CSE
          </div>
          <div>
            <div className="text-xs font-bold text-foreground">UPSC Civil Services</div>
            <div className="text-[11px] text-muted-foreground">General Studies (Paper-I)</div>
          </div>
        </div>
        <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
          Prelims
        </span>
      </div>
    </div>
  );
};
