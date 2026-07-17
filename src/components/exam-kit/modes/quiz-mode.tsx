"use client";

import { useState, useTransition } from "react";
import { generateQuiz, type Quiz } from "@/lib/ai";

const LETTERS = ["A", "B", "C", "D"];

export function QuizMode({ notes, subject }: { notes: string; subject: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [quiz, setQuiz] = useState<Quiz["questions"] | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateQuiz(notes, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setQuiz(res.data.questions);
      setIndex(0);
      setScore(0);
      setPicked(null);
    });
  }

  if (!quiz) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Generate an 8-question exam-style quiz.</p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Building your quiz..." : "Generate quiz"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (index >= quiz.length) {
    const pct = score / quiz.length;
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-xs uppercase tracking-wide text-muted">Your score</p>
        <p className="font-mono text-4xl font-semibold">
          {score} / {quiz.length}
        </p>
        <p className="text-sm text-muted">
          {pct >= 0.85
            ? "Excellent - you know this material."
            : pct >= 0.6
              ? "Solid - review the ones you missed."
              : "Worth another pass through the notes before the exam."}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setScore(0);
            setPicked(null);
          }}
          className="mt-2 rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
        >
          Retake quiz
        </button>
      </div>
    );
  }

  const q = quiz[index];

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex justify-between text-sm text-muted">
        <span>
          Question {index + 1} of {quiz.length}
        </span>
        <span>Score: {score}</span>
      </div>
      <p className="mt-3 text-lg font-medium">{q.q}</p>
      <div className="mt-4 flex flex-col gap-2">
        {q.options.map((opt, i) => {
          const isAnswer = i === q.answer;
          const isPicked = i === picked;
          const showResult = picked !== null;
          return (
            <button
              key={i}
              type="button"
              disabled={showResult}
              onClick={() => {
                setPicked(i);
                if (i === q.answer) setScore((s) => s + 1);
              }}
              className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition ${
                showResult && isAnswer
                  ? "border-green-400 bg-green-50 dark:bg-green-950/30"
                  : showResult && isPicked
                    ? "border-red-400 bg-red-50 dark:bg-red-950/30"
                    : "border-border hover:border-accent"
              }`}
            >
              <span className="font-mono text-xs text-muted">{LETTERS[i]}</span>
              {opt}
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <>
          <div className="mt-4 rounded-lg border-l-2 border-accent bg-accent-soft/40 px-4 py-3 text-sm text-muted">
            {q.why}
          </div>
          <div className="mt-4 text-right">
            <button
              type="button"
              onClick={() => {
                setIndex((i) => i + 1);
                setPicked(null);
              }}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
            >
              Next question &rarr;
            </button>
          </div>
        </>
      )}
    </div>
  );
}
