"use client";

import { useState, useTransition } from "react";
import { generateBlanks, type Blanks } from "@/lib/ai";

function normalize(s: string) {
  return s.toLowerCase().replace(/[^\w\s]/g, "").replace(/\s+/g, " ").trim();
}

export function BlanksMode({ notes, subject }: { notes: string; subject: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [blanks, setBlanks] = useState<Blanks["blanks"] | null>(null);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [revealed, setRevealed] = useState(false);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateBlanks(notes, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setBlanks(res.data.blanks);
      setIndex(0);
      setScore(0);
      setGuess("");
      setFeedback(null);
      setRevealed(false);
    });
  }

  function check() {
    if (!blanks) return;
    const b = blanks[index];
    const g = normalize(guess);
    const ans = normalize(b.answer);
    const ok = g.length > 0 && (g === ans || (ans.includes(g) && g.length >= Math.min(4, ans.length)) || ans.includes(g) || g.includes(ans));
    if (ok) {
      if (!revealed) setScore((s) => s + 1);
      setFeedback({ ok: true, text: `Correct - ${b.answer}` });
    } else {
      setFeedback({ ok: false, text: "Not quite - try again or reveal." });
    }
  }

  function reveal() {
    if (!blanks) return;
    setRevealed(true);
    setFeedback({ ok: false, text: `Answer: ${blanks[index].answer}` });
  }

  function next() {
    setIndex((i) => i + 1);
    setGuess("");
    setFeedback(null);
    setRevealed(false);
  }

  if (!blanks) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Generate 6 fill-in-the-blank recall drills.</p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Creating drills..." : "Generate drills"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (index >= blanks.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-medium">Drills complete</p>
        <p className="text-sm text-muted">
          You got {score} of {blanks.length} on the first try.
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(0);
            setScore(0);
            setFeedback(null);
            setRevealed(false);
          }}
          className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
        >
          Go again
        </button>
      </div>
    );
  }

  const b = blanks[index];

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex justify-between text-sm text-muted">
        <span>
          Drill {index + 1} of {blanks.length}
        </span>
        <span>Correct: {score}</span>
      </div>
      <p className="mt-4 text-lg leading-relaxed">
        {b.sentence.split(/_{2,}/).map((part, i, arr) => (
          <span key={i}>
            {part}
            {i < arr.length - 1 && (
              <span className="mx-1 inline-block min-w-[80px] border-b-2 border-accent px-2 text-center font-medium text-accent">
                {revealed || feedback?.ok ? b.answer : "?"}
              </span>
            )}
          </span>
        ))}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          value={guess}
          onChange={(e) => setGuess(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && check()}
          placeholder="Type the missing word or phrase..."
          className="min-w-[200px] flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
        <button
          type="button"
          onClick={check}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted"
        >
          Check
        </button>
        <button
          type="button"
          onClick={reveal}
          className="rounded-lg border border-border px-3 py-2 text-sm transition hover:bg-surface-muted"
        >
          Reveal
        </button>
      </div>
      {feedback && (
        <p className={`mt-3 text-sm font-medium ${feedback.ok ? "text-green-600" : "text-red-500"}`}>
          {feedback.text}
        </p>
      )}
      {feedback && (
        <div className="mt-4 text-right">
          <button
            type="button"
            onClick={next}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}
