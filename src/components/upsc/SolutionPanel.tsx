"use client";

import React from "react";
import { UPSCQuestion } from "@/lib/upsc-data";

interface SolutionPanelProps {
  question: UPSCQuestion;
}

export const SolutionPanel: React.FC<SolutionPanelProps> = ({ question }) => {
  const isDropped =
    question.correct_answer.toLowerCase().includes("drop") ||
    question.correct_answer.toLowerCase().includes("x") ||
    question.correct_answer.toLowerCase().includes("cancel");

  return (
    <div className="mt-6 pt-6 border-t-2 border-dashed border-border/80 bg-amber-500/5 dark:bg-amber-500/5 -mx-6 -mb-6 p-6 rounded-b-2xl">
      {/* Solution Header & Correct Answer Badge */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5">
          <span className="h-7 w-7 rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-sm border border-emerald-500/30">
            ✓
          </span>
          <span className="text-sm font-bold text-foreground">
            Official / Verified Solution
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Correct Option:</span>
          <span
            className={`px-3 py-1 rounded-lg text-sm font-bold font-mono ${
              isDropped
                ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                : "bg-emerald-500 text-white shadow-xs"
            }`}
          >
            {question.correct_answer || "Needs verification"}
          </span>
        </div>
      </div>

      {/* Detailed Solution Body */}
      {question.detailed_solution && (
        <div className="mb-4 space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Detailed Explanation & Statement Analysis
          </h4>
          <div className="text-sm leading-relaxed text-foreground/90 bg-card p-4 rounded-xl border border-border whitespace-pre-line">
            {question.detailed_solution}
          </div>
        </div>
      )}

      {/* Core Concept & Exam Takeaway Box */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {question.core_concept && (
          <div className="p-3.5 rounded-xl bg-blue-500/10 dark:bg-blue-500/10 border border-blue-500/20">
            <div className="text-xs font-bold text-blue-700 dark:text-blue-300 flex items-center gap-1.5 mb-1">
              <span>💡</span> Core Concept Tested
            </div>
            <p className="text-xs text-blue-900 dark:text-blue-100/90 leading-relaxed">
              {question.core_concept}
            </p>
          </div>
        )}

        {question.exam_takeaway && (
          <div className="p-3.5 rounded-xl bg-purple-500/10 dark:bg-purple-500/10 border border-purple-500/20">
            <div className="text-xs font-bold text-purple-700 dark:text-purple-300 flex items-center gap-1.5 mb-1">
              <span>🎯</span> High-Yield Revision Takeaway
            </div>
            <p className="text-xs text-purple-900 dark:text-purple-100/90 leading-relaxed">
              {question.exam_takeaway}
            </p>
          </div>
        )}
      </div>

      {/* Tags & Source Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-3 border-t border-border/60">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-muted-foreground font-medium">Tags:</span>
          {question.tags.map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/50 text-[11px]"
            >
              #{tag}
            </span>
          ))}
        </div>

        <div className="text-[11px] text-muted-foreground font-mono">
          PDF Ref: {question.source_pdf} (p. {question.source_page})
        </div>
      </div>
    </div>
  );
};
