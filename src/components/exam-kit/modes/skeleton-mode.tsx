"use client";

import { useState, useTransition } from "react";
import {
  generateSkeletonQuestion,
  gradeSkeletonAnswer,
  type SkeletonGrade,
} from "@/lib/ai";

export function SkeletonMode({ notes, subject }: { notes: string; subject: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [question, setQuestion] = useState<string | null>(null);
  const [thesis, setThesis] = useState("");
  const [headings, setHeadings] = useState(["", "", ""]);
  const [citations, setCitations] = useState(["", "", ""]);
  const [grade, setGrade] = useState<SkeletonGrade | null>(null);
  const [grading, startGrading] = useTransition();

  function generate() {
    setError(null);
    setThesis("");
    setHeadings(["", "", ""]);
    setCitations(["", "", ""]);
    setGrade(null);
    startTransition(async () => {
      const res = await generateSkeletonQuestion(notes, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setQuestion(res.data.question);
    });
  }

  function submit() {
    if (!question || !thesis.trim() || headings.some((h) => !h.trim())) return;
    setError(null);
    startGrading(async () => {
      const res = await gradeSkeletonAnswer(notes, question, thesis, headings, citations, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGrade(res.data);
    });
  }

  if (!question) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">
          Practice structuring a long-answer essay without writing the full thing:
          thesis, three headings, one citation per heading.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Writing a question..." : "Get a question"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-xs uppercase tracking-wide text-muted">Long-answer question</p>
      <p className="mt-2 text-lg font-medium">{question}</p>

      <div className="mt-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Core thesis (1 sentence)</label>
          <input
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            disabled={!!grade}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-70"
          />
        </div>

        {[0, 1, 2].map((i) => (
          <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Heading {i + 1}</label>
              <input
                value={headings[i]}
                onChange={(e) =>
                  setHeadings((h) => h.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                disabled={!!grade}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-70"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Scholar / case / article</label>
              <input
                value={citations[i]}
                onChange={(e) =>
                  setCitations((c) => c.map((v, idx) => (idx === i ? e.target.value : v)))
                }
                disabled={!!grade}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-70"
              />
            </div>
          </div>
        ))}
      </div>

      {!grade && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={grading || !thesis.trim() || headings.some((h) => !h.trim())}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {grading ? "Critiquing..." : "Submit skeleton"}
          </button>
        </div>
      )}

      {grade && (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4">
          <div
            className={`w-fit rounded-lg px-3 py-1.5 text-xs font-medium ${
              grade.structureScore === "strong"
                ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                : grade.structureScore === "workable"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
            }`}
          >
            Structure: {grade.structureScore}
          </div>
          <p className="text-sm">{grade.logicFeedback}</p>
          {grade.missedPerspective && (
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">Missing: </span>
              {grade.missedPerspective}
            </p>
          )}
          <div className="rounded-lg border-l-2 border-accent bg-accent-soft/40 px-4 py-3 text-sm">
            <p className="font-medium text-foreground">Model skeleton</p>
            <p className="mt-1 text-muted">{grade.modelSkeleton.thesis}</p>
            <ol className="mt-2 list-decimal pl-5 text-muted">
              {grade.modelSkeleton.headings.map((h, i) => (
                <li key={i}>
                  {h}
                  <span className="text-xs"> &mdash; {grade.modelSkeleton.citations[i]}</span>
                </li>
              ))}
            </ol>
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={generate}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
            >
              New question
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
