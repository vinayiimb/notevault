"use client";

import { useState } from "react";
import { Check, X } from "@phosphor-icons/react";

// Static, data-driven MCQ — visually similar to the AI-generated QuizMode in
// Exam Kit (src/components/exam-kit/modes/quiz-mode.tsx), but takes fixed
// question/options/correctAnswer data instead of calling the LLM live. Used
// for admin-authored "quiz" content blocks on a question's Practice tab.
export function PracticeQuiz({
  question,
  options,
  correctAnswer,
  explanation,
}: {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation?: string;
}) {
  const [selected, setSelected] = useState<number | null>(null);

  return (
    <div className="rounded-2xl border border-border bg-surface p-4 sm:p-5">
      <p className="font-semibold text-foreground">{question}</p>
      <div className="mt-3 flex flex-col gap-2">
        {options.map((option, index) => {
          const isSelected = selected === index;
          const isCorrect = index === correctAnswer;
          const showState = selected !== null;
          return (
            <button
              key={index}
              type="button"
              disabled={selected !== null}
              onClick={() => setSelected(index)}
              className={`flex items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-left text-sm transition ${
                showState && isCorrect
                  ? "border-notes-emerald-soft bg-notes-emerald-soft/40"
                  : showState && isSelected
                    ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30"
                    : "border-border hover:bg-surface-muted disabled:opacity-70"
              }`}
            >
              <span>{option}</span>
              {showState && isCorrect && <Check size={16} weight="bold" className="shrink-0 text-notes-emerald-dark" />}
              {showState && isSelected && !isCorrect && <X size={16} weight="bold" className="shrink-0 text-red-700 dark:text-red-300" />}
            </button>
          );
        })}
      </div>
      {selected !== null && explanation && (
        <p className="mt-3 rounded-xl bg-surface-muted p-3 text-sm text-muted">{explanation}</p>
      )}
    </div>
  );
}
