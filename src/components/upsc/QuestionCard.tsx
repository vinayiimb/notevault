"use client";

import React, { useState, useEffect } from "react";
import { UPSCQuestion, FilterState } from "@/lib/upsc-data";
import { SolutionPanel } from "./SolutionPanel";

interface QuestionCardProps {
  question: UPSCQuestion;
  currentIndex: number;
  totalQuestions: number;
  mode: FilterState["mode"];
  isBookmarked: boolean;
  onToggleBookmark: () => void;
  userAttempt?: { selectedOption: string; isCorrect: boolean; timeSpent: number };
  onRecordAttempt: (selectedOption: string, isCorrect: boolean, timeSpent: number) => void;
  onNextQuestion: () => void;
  onPrevQuestion: () => void;
  hasNext: boolean;
  hasPrev: boolean;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  currentIndex,
  totalQuestions,
  mode,
  isBookmarked,
  onToggleBookmark,
  userAttempt,
  onRecordAttempt,
  onNextQuestion,
  onPrevQuestion,
  hasNext,
  hasPrev,
}) => {
  const [showSolution, setShowSolution] = useState(mode === "browse");
  const [secondsSpent, setSecondsSpent] = useState(userAttempt?.timeSpent || 0);
  const [selectedOption, setSelectedOption] = useState<string | null>(
    userAttempt?.selectedOption || null
  );

  // Sync state when question changes
  useEffect(() => {
    setShowSolution(mode === "browse");
    setSelectedOption(userAttempt?.selectedOption || null);
    setSecondsSpent(userAttempt?.timeSpent || 0);
  }, [question.question_id, mode, userAttempt]);

  // Stopwatch timer for question attempt
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsSpent((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [question.question_id]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  const handleSelectOption = (label: string) => {
    if (userAttempt && mode === "practice") {
      // already attempted, allow re-click
    }
    setSelectedOption(label);
    const isCorrect =
      question.correct_answer.toLowerCase().includes(label.toLowerCase()) ||
      label.toLowerCase().includes(question.correct_answer.toLowerCase());
    onRecordAttempt(label, isCorrect, secondsSpent);
    if (mode === "practice") {
      setShowSolution(true);
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "ArrowRight" && hasNext) {
        onNextQuestion();
      } else if (e.key === "ArrowLeft" && hasPrev) {
        onPrevQuestion();
      } else if (e.key === "s" || e.key === "S") {
        setShowSolution((prev) => !prev);
      } else if (e.key === "b" || e.key === "B") {
        onToggleBookmark();
      } else if (["1", "2", "3", "4"].includes(e.key)) {
        const idx = parseInt(e.key) - 1;
        if (question.options[idx]) {
          handleSelectOption(question.options[idx].label);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasNext, hasPrev, question, onNextQuestion, onPrevQuestion, onToggleBookmark]);

  const diffBadgeColor = {
    Easy: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    Moderate: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    Hard: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  }[question.difficulty] || "bg-muted text-muted-foreground";

  return (
    <div className="bg-card border border-border/90 rounded-2xl p-6 sm:p-8 shadow-sm transition-all relative">
      {/* Top Metadata Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-5 border-b border-border/70">
        <div className="flex flex-wrap items-center gap-2">
          {/* Year Badge */}
          <span className="px-2.5 py-1 rounded-lg bg-amber-500 text-white font-mono font-bold text-xs shadow-2xs">
            UPSC {question.year}
          </span>

          {/* Subject Badge */}
          <span className="px-2.5 py-1 rounded-lg bg-muted text-foreground font-semibold text-xs border border-border">
            {question.subject}
          </span>

          {/* Topic Badge */}
          <span className="px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground font-medium text-xs border border-border/60">
            {question.topic}
          </span>

          {/* Question Type Badge */}
          <span className="px-2 py-0.5 rounded-md bg-secondary/40 text-secondary-foreground text-[11px] font-mono border border-border/40 hidden sm:inline-block">
            {question.question_type}
          </span>

          {/* Difficulty Badge */}
          <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${diffBadgeColor}`}>
            {question.difficulty}
          </span>
        </div>

        {/* Right side: Timer & Bookmark */}
        <div className="flex items-center gap-3">
          {/* Stopwatch */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono bg-muted/50 px-2.5 py-1 rounded-lg border border-border/60">
            <span>⏱️</span>
            <span>{formatTime(secondsSpent)}</span>
          </div>

          {/* Bookmark Button */}
          <button
            onClick={onToggleBookmark}
            className={`p-2 rounded-xl border transition-all ${
              isBookmarked
                ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400"
                : "bg-muted/30 border-border text-muted-foreground hover:text-foreground hover:bg-muted"
            }`}
            title="Bookmark this question [B]"
            aria-label="Bookmark question"
          >
            <span className="text-sm">{isBookmarked ? "🔖 Saved" : "🔖 Save"}</span>
          </button>
        </div>
      </div>

      {/* Question Counter Bar */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-4 pb-2">
        <span className="font-mono font-medium text-foreground/80">
          Question #{question.question_number} ({currentIndex + 1} of {totalQuestions})
        </span>
        <span className="text-muted-foreground/80 font-mono">
          Prelims Paper-I (2 Marks)
        </span>
      </div>

      {/* Original Question Text - Verbatim Exact */}
      <div className="my-5">
        <div className="text-base sm:text-lg font-medium text-foreground leading-relaxed whitespace-pre-line tracking-tight font-serif sm:font-sans">
          {question.original_question}
        </div>
      </div>

      {/* Options List */}
      {question.options && question.options.length > 0 && (
        <div className="space-y-2.5 my-6">
          {question.options.map((opt, idx) => {
            const isSelected = selectedOption === opt.label;
            const isAnswerCorrect =
              question.correct_answer.toLowerCase().includes(opt.label.toLowerCase());

            let optStyle =
              "bg-muted/20 hover:bg-muted/50 border-border/70 text-foreground";

            if (showSolution || userAttempt) {
              if (isAnswerCorrect) {
                optStyle =
                  "bg-emerald-500/10 border-emerald-500/50 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-500/30";
              } else if (isSelected && !isAnswerCorrect) {
                optStyle =
                  "bg-rose-500/10 border-rose-500/50 text-rose-950 dark:text-rose-100 ring-1 ring-rose-500/30";
              }
            } else if (isSelected) {
              optStyle = "bg-primary/10 border-primary text-foreground ring-1 ring-primary";
            }

            return (
              <button
                key={opt.label}
                onClick={() => handleSelectOption(opt.label)}
                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border transition-all flex items-start gap-3.5 group cursor-pointer ${optStyle}`}
              >
                <span
                  className={`w-7 h-7 rounded-lg font-mono font-bold text-xs flex items-center justify-center shrink-0 transition-colors ${
                    showSolution && isAnswerCorrect
                      ? "bg-emerald-500 text-white"
                      : showSolution && isSelected && !isAnswerCorrect
                      ? "bg-rose-500 text-white"
                      : isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-background border border-border"
                  }`}
                >
                  {opt.label.replace(/[()]/g, "").toUpperCase()}
                </span>
                <div className="text-sm font-normal text-foreground/90 leading-relaxed pt-0.5">
                  {opt.text}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Action Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5 border-t border-border/70">
        <div className="flex items-center gap-2">
          {/* Solution Toggle Button */}
          <button
            onClick={() => setShowSolution((prev) => !prev)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 ${
              showSolution
                ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                : "bg-card text-foreground hover:bg-muted border-border"
            }`}
          >
            <span>{showSolution ? "🙈 Hide Solution" : "💡 Show Solution"}</span>
            <kbd className="text-[10px] font-mono px-1 rounded bg-muted/60 text-muted-foreground">
              S
            </kbd>
          </button>

          {/* Quick Attempt Feedback Badge */}
          {userAttempt && (
            <span
              className={`text-xs px-2.5 py-1 rounded-lg font-medium border ${
                userAttempt.isCorrect
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                  : "bg-rose-500/10 text-rose-600 border-rose-500/30"
              }`}
            >
              {userAttempt.isCorrect ? "✓ Correct" : "✕ Incorrect"}
            </span>
          )}
        </div>

        {/* Previous / Next Question Navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={onPrevQuestion}
            disabled={!hasPrev}
            className="px-3 py-2 rounded-xl text-xs font-medium bg-card hover:bg-muted border border-border disabled:opacity-40 disabled:pointer-events-none text-foreground transition-all flex items-center gap-1"
          >
            <span>← Prev</span>
            <kbd className="text-[10px] font-mono px-1 rounded bg-muted/60 text-muted-foreground">
              [←]
            </kbd>
          </button>
          <button
            onClick={onNextQuestion}
            disabled={!hasNext}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-all flex items-center gap-1 shadow-2xs"
          >
            <span>Next →</span>
            <kbd className="text-[10px] font-mono px-1 rounded bg-primary-foreground/20 text-primary-foreground">
              [→]
            </kbd>
          </button>
        </div>
      </div>

      {/* Collapsible Solution Panel */}
      {showSolution && <SolutionPanel question={question} />}
    </div>
  );
};
