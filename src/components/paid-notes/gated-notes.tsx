"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockSimple } from "@phosphor-icons/react";
import { NotesReadingChrome } from "@/components/content/notes/reading-chrome";
import { extractContentHeadings, preprocessNotesMarkdown, type ContentHeading } from "@/lib/content/toc";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { PACKS, SINGLE_PRICE, itemKey } from "@/lib/paid-notes-pricing";

// A paid note: the server renders only the free preview (cached, crawlable);
// this asks /api/notes-access whether the visitor may read the rest and
// swaps it in, or shows the unlock card under the preview.
export function GatedNotes({
  programmeSlug,
  subjectSlug,
  title,
  programmeName,
  preview,
  headings,
  subjectTheme,
}: {
  programmeSlug: string;
  subjectSlug: string;
  title: string;
  programmeName?: string;
  preview: string;
  headings: ContentHeading[];
  subjectTheme: { light: NotesLabColorTokens; dark: NotesLabColorTokens };
}) {
  const pathname = usePathname();
  const [full, setFull] = useState<{ content: string; headings: ContentHeading[] } | null>(null);
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes-access?p=${encodeURIComponent(programmeSlug)}&s=${encodeURIComponent(subjectSlug)}`)
      .then(async (res) => {
        if (cancelled) return;
        const { content } = res.ok ? ((await res.json()) as { content?: string }) : {};
        if (!content) return setLocked(true);
        const preprocessed = preprocessNotesMarkdown(content);
        setFull({ content: preprocessed, headings: extractContentHeadings(preprocessed) });
      })
      .catch(() => !cancelled && setLocked(true));
    return () => {
      cancelled = true;
    };
  }, [programmeSlug, subjectSlug]);

  return (
    <>
      <NotesReadingChrome
        title={title}
        programmeName={programmeName}
        content={full?.content ?? preview}
        headings={full?.headings ?? headings}
        subjectTheme={subjectTheme}
        downloadable={!!full}
      />
      {locked && (
        <div className="relative -mt-24">
          <div className="pointer-events-none h-24 bg-gradient-to-b from-transparent to-background" />
          <div className="mx-auto max-w-xl rounded-2xl border border-border bg-surface p-6 text-center shadow-sm sm:p-8">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
              <LockSimple size={22} weight="bold" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">You&apos;ve read the free preview</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Unlock the complete {title} notes with full solutions, diagrams and PDF download — for just ₹{SINGLE_PRICE}.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href={`/paid-notes?add=${encodeURIComponent(itemKey(programmeSlug, subjectSlug))}`}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand-hover sm:w-auto"
              >
                Unlock for ₹{SINGLE_PRICE}
              </Link>
              <Link
                href={`/paid-notes/login?next=${encodeURIComponent(pathname)}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Already bought? Sign in
              </Link>
            </div>
            <p className="mt-5 text-xs text-muted">
              {PACKS.slice(1).map((p) => `${p.label.split(" · ")[0]} for ₹${p.price}`).join(" · ")}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
