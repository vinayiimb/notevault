"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setNicknameAction } from "@/lib/student-actions";

export function NicknamePrompt() {
  const [value, setValue] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) {
      setError("Pick a name first.");
      return;
    }
    setError(null);
    const formData = new FormData();
    formData.set("nickname", value);
    startTransition(async () => {
      await setNicknameAction(formData);
      router.refresh();
    });
  }

  return (
    <div className="rounded-2xl bg-brand-soft p-5 sm:p-6">
      <p className="font-display text-lg font-bold">Pick a name for the leaderboard</p>
      <p className="mt-1 text-sm text-muted">
        Just for the leaderboard — no email or password needed. Your streak and oranges are
        already being tracked for this browser.
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          maxLength={24}
          placeholder="e.g. StudyNinja"
          className="min-h-11 min-w-0 flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm focus:border-brand focus:outline-none"
        />
        <button
          type="submit"
          disabled={isPending}
          className="min-h-11 shrink-0 rounded-xl bg-brand px-5 py-2 text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-warning">{error}</p>}
    </div>
  );
}
