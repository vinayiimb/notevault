"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpenText } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";
import { SINGLE_PRICE, itemKey } from "@/lib/paid-notes-pricing";

// One fetch per page load, shared by every subject a student clicks through.
let available: Promise<{ paid: boolean; items: string[] }> | null = null;

// A single quiet line under a /papers subject heading — only when that
// subject actually has notes. No banner, no popup.
export function NotesNudge({ course, subject }: { course: string; subject: string }) {
  const [state, setState] = useState<{ key: string; paid: boolean } | null>(null);

  useEffect(() => {
    available ??= fetch("/api/notes-available")
      .then((r) => r.json())
      .catch(() => ({ paid: false, items: [] }));
    const key = itemKey(slugify(course), slugify(subject));
    let cancelled = false;
    available.then(({ paid, items }) => {
      if (!cancelled) setState(items.includes(key) ? { key, paid } : null);
    });
    return () => {
      cancelled = true;
    };
  }, [course, subject]);

  if (!state) return null;
  return (
    <Link
      href={`/notes/${state.key}`}
      className="mt-2 inline-flex items-center gap-1.5 whitespace-nowrap text-xs sm:whitespace-normal font-medium text-accent hover:underline"
    >
      <BookOpenText size={14} weight="bold" className="shrink-0" />
      {/* Phones get a short label: the heading column there is narrow. */}
      {state.paid ? (
        <>
          <span className="sm:hidden">Full notes · ₹{SINGLE_PRICE} →</span>
          <span className="hidden sm:inline">Full notes &amp; solutions for this subject — ₹{SINGLE_PRICE} · read the preview free</span>
        </>
      ) : (
        <>
          <span className="sm:hidden">Free notes →</span>
          <span className="hidden sm:inline">Notes for this subject are available — read free</span>
        </>
      )}
    </Link>
  );
}
