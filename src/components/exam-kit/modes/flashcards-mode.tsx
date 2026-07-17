"use client";

import { useState, useTransition } from "react";
import { generateFlashcards, type Flashcards } from "@/lib/ai";

function shuffle<T>(arr: T[]): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function FlashcardsMode({ notes, subject }: { notes: string; subject: string }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [cards, setCards] = useState<Flashcards["cards"] | null>(null);
  const [queue, setQueue] = useState<Flashcards["cards"]>([]);
  const [flipped, setFlipped] = useState(false);
  const [again, setAgain] = useState(0);

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateFlashcards(notes, subject);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const shuffled = shuffle(res.data.cards);
      setCards(res.data.cards);
      setQueue(shuffled);
      setAgain(0);
      setFlipped(false);
    });
  }

  if (!cards) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-sm text-muted">Generate 10 flashcards from your notes.</p>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Writing flashcards..." : "Generate flashcards"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-surface p-8 text-center">
        <p className="text-lg font-medium">Deck cleared</p>
        <p className="text-sm text-muted">
          {cards.length} cards &middot; {again} needed a second look
        </p>
        <button
          type="button"
          onClick={() => {
            setQueue(shuffle(cards));
            setAgain(0);
          }}
          className="rounded-lg border border-border px-4 py-2 text-sm transition hover:bg-surface-muted"
        >
          Shuffle and study again
        </button>
      </div>
    );
  }

  const card = queue[0];

  return (
    <div className="flex flex-col items-center gap-5">
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="flex min-h-[200px] w-full max-w-lg flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface p-8 text-center transition hover:border-accent"
      >
        <span className="text-xs font-medium uppercase tracking-wide text-muted">
          {flipped ? "Answer" : "Question"}
        </span>
        <span className="text-lg font-medium">{flipped ? card.back : card.front}</span>
      </button>
      <p className="text-xs text-muted">Click the card to flip it</p>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => {
            setQueue((q) => [...q.slice(1), q[0]]);
            setAgain((a) => a + 1);
            setFlipped(false);
          }}
          className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-500 transition hover:bg-red-50 dark:hover:bg-red-950/30"
        >
          Again
        </button>
        <button
          type="button"
          onClick={() => {
            setQueue((q) => q.slice(1));
            setFlipped(false);
          }}
          className="rounded-lg border border-green-300 px-4 py-2 text-sm text-green-600 transition hover:bg-green-50 dark:hover:bg-green-950/30"
        >
          Got it
        </button>
      </div>
      <p className="text-sm text-muted">{queue.length} card{queue.length === 1 ? "" : "s"} left</p>
    </div>
  );
}
