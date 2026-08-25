"use client";

import React from "react";
import { FilterState, QUESTION_TYPES, SubjectHierarchy } from "@/lib/upsc-data";
import { ExamSelector } from "./ExamSelector";
import { YearFilter } from "./YearFilter";
import { DifficultyFilter } from "./DifficultyFilter";
import { TopicAccordion } from "./TopicAccordion";
import { AttemptTracker } from "./AttemptTracker";

interface QuestionFiltersSidebarProps {
  hierarchy: SubjectHierarchy[];
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  onResetFilters: () => void;
  stats: {
    total: number;
    attempted: number;
    correct: number;
    incorrect: number;
  };
  onResetAttempts?: () => void;
}

export const QuestionFiltersSidebar: React.FC<QuestionFiltersSidebarProps> = ({
  hierarchy,
  filters,
  onFilterChange,
  onResetFilters,
  stats,
  onResetAttempts,
}) => {
  return (
    <aside className="w-full lg:w-80 shrink-0 space-y-6">
      {/* Live Attempt & Score Tracker */}
      <AttemptTracker
        total={stats.total}
        attempted={stats.attempted}
        correct={stats.correct}
        incorrect={stats.incorrect}
        onResetAttempts={onResetAttempts}
      />

      {/* Main Filter Container */}
      <div className="bg-card border border-border/80 rounded-2xl p-4 sm:p-5 shadow-xs space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
            <span>⚙️</span> Filter Questions
          </h2>
          <button
            onClick={onResetFilters}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline font-medium"
          >
            Reset All
          </button>
        </div>

        {/* 1. Target Exam Selection */}
        <ExamSelector />

        {/* 2. Years Filter (2013-2025) */}
        <YearFilter
          selectedYears={filters.selectedYears}
          onToggleYear={(yr) => {
            const next = filters.selectedYears.includes(yr)
              ? filters.selectedYears.filter((y) => y !== yr)
              : [...filters.selectedYears, yr];
            onFilterChange({ selectedYears: next });
          }}
          onSelectAllYears={() =>
            onFilterChange({
              selectedYears: [
                "2025", "2024", "2023", "2022", "2021", "2020",
                "2019", "2018", "2017", "2016", "2015", "2014", "2013"
              ],
            })
          }
          onClearYears={() => onFilterChange({ selectedYears: [] })}
        />

        {/* 3. Question Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Question Format
          </label>
          <select
            value={filters.selectedQuestionType || "All Types"}
            onChange={(e) =>
              onFilterChange({
                selectedQuestionType:
                  e.target.value === "All Types" ? null : e.target.value,
              })
            }
            className="w-full text-xs py-2 px-3 bg-muted/40 hover:bg-muted border border-border rounded-lg text-foreground outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            {QUESTION_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </div>

        {/* 4. Difficulty Filter */}
        <DifficultyFilter
          selectedDifficulty={filters.selectedDifficulty}
          onSelectDifficulty={(diff) => onFilterChange({ selectedDifficulty: diff })}
        />

        {/* 5. Attempt Status Filter */}
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
            Attempt Status
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: "all", label: "All Questions" },
              { id: "unattempted", label: "Unattempted" },
              { id: "attempted", label: "Attempted" },
              { id: "incorrect", label: "Incorrect Only" },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() =>
                  onFilterChange({
                    attemptStatus: st.id as FilterState["attemptStatus"],
                  })
                }
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  filters.attemptStatus === st.id
                    ? "bg-card font-semibold text-foreground border-border shadow-xs ring-1 ring-border"
                    : "bg-muted/30 text-muted-foreground hover:bg-muted border-border/60"
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>

        {/* 6. Hierarchical Subject & Topic Explorer */}
        <TopicAccordion
          hierarchy={hierarchy}
          selectedSubject={filters.selectedSubject}
          selectedTopic={filters.selectedTopic}
          onSelectSubject={(subj) => onFilterChange({ selectedSubject: subj })}
          onSelectTopic={(top, subj) =>
            onFilterChange({ selectedTopic: top, selectedSubject: subj })
          }
        />
      </div>
    </aside>
  );
};
