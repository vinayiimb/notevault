"use client";

import { useState, useTransition } from "react";
import { generateConceptList, gradeConceptConnection, type ConceptGrade } from "@/lib/ai";

function pickPair(concepts: string[], avoid?: [string, string]): [string, string] {
  if (concepts.length < 2) return [concepts[0], concepts[0]];
  let a = 0;
  let b = 0;
  do {
    a = Math.floor(Math.random() * concepts.length);
    b = Math.floor(Math.random() * concepts.length);
  } while (
    a === b ||
    (avoid && concepts[a] === avoid[0] && concepts[b] === avoid[1]) ||
    (avoid && concepts[a] === avoid[1] && concepts[b] === avoid[0])
  );
  return [concepts[a], concepts[b]];
}

export function ConceptMapMode({ notes, subject }: { notes: string; subject: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [concepts, setConcepts] = useState<string[] | null>(null);
  const [pair, setPair] = useState<[string, string] | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<ConceptGrade | null>(null);
  const [grading, startGrading] = useTransition();

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateConceptList(notes, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setConcepts(res.data.concepts);
      setPair(pickPair(res.data.concepts));
      setAnswer("");
      setGrade(null);
    });
  }

  function nextPair() {
    if (!concepts) return;
    setPair((prev) => pickPair(concepts, prev ?? undefined));
    setAnswer("");
    setGrade(null);
  }

  function submit() {
    if (!pair || !answer.trim()) return;
    setError(null);
    startGrading(async () => {
      const res = await gradeConceptConnection(notes, pair[0], pair[1], answer, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setGrade(res.data);
    });
  }

  if (!concepts) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">
          Pulls 5-10 core concepts from your notes and asks you to explain how two of
          them relate &mdash; the kind of thinking theory exams actually test.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Reading your notes..." : "Find concepts"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="text-xs uppercase tracking-wide text-muted">Explain the connection</p>
      <div className="mt-3 flex items-center justify-center gap-4 text-center">
        <span className="rounded-lg bg-accent-soft px-4 py-2 font-medium text-accent">
          {pair?.[0]}
        </span>
        <span className="text-muted">&harr;</span>
        <span className="rounded-lg bg-accent-soft px-4 py-2 font-medium text-accent">
          {pair?.[1]}
        </span>
      </div>

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={3}
        disabled={!!grade}
        placeholder="In one or two sentences, how are these related?"
        className="mt-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none disabled:opacity-70"
      />

      {!grade && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={submit}
            disabled={grading || !answer.trim()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {grading ? "Grading..." : "Submit"}
          </button>
        </div>
      )}

      {grade && (
        <div className="mt-4 flex flex-col gap-3">
          <div
            className={`rounded-lg px-3 py-1.5 text-xs font-medium w-fit ${
              grade.level === "deep"
                ? "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-400"
                : grade.level === "partial"
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                  : "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-400"
            }`}
          >
            {grade.level === "deep"
              ? "Deep understanding"
              : grade.level === "partial"
                ? "Partial understanding"
                : "Superficial"}
          </div>
          <p className="text-sm">{grade.feedback}</p>
          <div className="rounded-lg border-l-2 border-accent bg-accent-soft/40 px-4 py-3 text-sm text-muted">
            <span className="font-medium text-foreground">Model answer: </span>
            {grade.modelConnection}
          </div>
          <div className="text-right">
            <button
              type="button"
              onClick={nextPair}
              className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
            >
              Next pair &rarr;
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
