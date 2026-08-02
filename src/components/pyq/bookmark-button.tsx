"use client";

import { useSyncExternalStore } from "react";
import { BookmarkSimple } from "@phosphor-icons/react";

const STORAGE_KEY = "notevault:bookmarked-papers:v1";
const listeners = new Set<() => void>();

function readBookmarks(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function writeBookmarks(next: string[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  for (const listener of listeners) listener();
}

// v1: per-browser only via localStorage, no new schema/auth-linked model —
// a real cross-device bookmark list would need a StudentBookmark join model
// tied to the existing Student auth, which is a bigger feature on its own.
export function BookmarkButton({ paperId }: { paperId: string }) {
  const bookmarked = useSyncExternalStore(
    subscribe,
    () => readBookmarks().includes(paperId),
    () => false,
  );

  function toggle() {
    const current = readBookmarks();
    const next = current.includes(paperId) ? current.filter((id) => id !== paperId) : [...current, paperId];
    writeBookmarks(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={bookmarked}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition ${
        bookmarked ? "border-accent bg-accent-soft text-accent" : "border-border text-foreground hover:border-accent hover:text-accent"
      }`}
    >
      <BookmarkSimple size={14} weight={bookmarked ? "fill" : "bold"} />
      {bookmarked ? "Bookmarked" : "Bookmark"}
    </button>
  );
}
