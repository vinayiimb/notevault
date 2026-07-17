"use client";

import { useState, useTransition } from "react";
import {
  generateCounterArgument,
  gradeRebuttal,
  type RebuttalGrade,
} from "@/lib/ai";

export function DevilsAdvocateMode({ notes, subject }: { notes: string; subject: string }) {
  const [statement, setStatement] = useState("");
  const [counter, setCounter] = useState<string | null>(null);
  const [rebuttal, setRebuttal] = useState("");
  const [grade, setGrade] = useState<RebuttalGrade | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [challenging, startChallenging] = useTransition();
  const [judging, startJudging] = useTransition();

  function challenge() {
    if (!statement.trim()) return;
    setError(null);
    startChallenging(async () => {
      const res = await generateCounterArgument(notes, statement, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setCounter(res.data.counterArgument);
      setRebuttal("");
      setGrade(null);
    });
  }

  function submitRebuttal() {
    if (!counter || !rebuttal.trim()) return;
    setError(null);
    startJudging(async () => {
      const res = await gradeRebuttal(notes, statement, counter, rebuttal, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGrade(res.data);
    });
  }

  function reset() {
    setStatement("");
    setCounter(null);
    setRebuttal("");
    setGrade(null);
    setError(null);
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-xs uppercase tracking-wide text-muted">Your position</p>
      <textarea
        value={statement}
        onChange={(e) => setStatement(e.target.value)}
        disabled={!!counter}
        rows={2}
        placeholder='e.g. "The Right to Privacy is absolute."'
        className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-70"
      />

      {!counter && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={challenge}
            disabled={challenging || !statement.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {challenging ? "Thinking of a counter..." : "Challenge me"}
          </button>
        </div>
      )}

      {counter && (
        <div className="mt-4 rounded-lg border-l-2 border-accent bg-accent-soft/40 px-4 py-3 text-sm">
          <p className="font-medium text-foreground">Counter-argument</p>
          <p className="mt-1 text-muted">{counter}</p>
        </div>
      )}

      {counter && !grade && (
        <div className="mt-4 flex flex-col gap-2">
          <label className="text-sm font-medium">Your rebuttal</label>
          <textarea
            value={rebuttal}
            onChange={(e) => setRebuttal(e.target.value)}
            rows={3}
            placeholder="Use facts from your notes to answer the objection."
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={submitRebuttal}
              disabled={judging || !rebuttal.trim()}
              className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
            >
              {judging ? "Judging..." : "Submit rebuttal"}
            </button>
          </div>
        </div>
      )}

      {grade && (
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4">
          <div
            className={`w-fit rounded-lg px-3 py-1.5 text-xs font-medium ${
              grade.verdict === "solid"
                ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
            }`}
          >
            {grade.verdict === "solid" ? "You win this round" : "Needs work"}
          </div>
          <p className="text-sm">{grade.feedback}</p>
          {grade.flaw && (
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">Flaw: </span>
              {grade.flaw}
            </p>
          )}
          <div className="text-right">
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
            >
              New round
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
