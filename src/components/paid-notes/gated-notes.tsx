"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LockSimple } from "@phosphor-icons/react";
import { NotesReadingChrome } from "@/components/content/notes/reading-chrome";
import { extractContentHeadings, preprocessNotesMarkdown, type ContentHeading } from "@/lib/content/toc";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { PLANS, SINGLE_PRICE, itemKey } from "@/lib/paid-notes-pricing";

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
  const [adminView, setAdminView] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes-access?p=${encodeURIComponent(programmeSlug)}&s=${encodeURIComponent(subjectSlug)}`)
      .then(async (res) => {
        if (cancelled) return;
        const { content, admin } = res.ok ? ((await res.json()) as { content?: string; admin?: boolean }) : {};
        if (!content) return setLocked(true);
        setAdminView(!!admin);
        const preprocessed = preprocessNotesMarkdown(content);
        setFull({ content: preprocessed, headings: extractContentHeadings(preprocessed) });
      })
      .catch(() => !cancelled && setLocked(true));
    return () => {
      cancelled = true;
    };
  }, [programmeSlug, subjectSlug]);

  const checkoutHref = `/paid-notes/checkout?plan=1&add=${encodeURIComponent(itemKey(programmeSlug, subjectSlug))}`;

  return (
    <>
      {adminView && (
        <p className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong className="font-semibold">Admin view:</strong> you&apos;re signed in as admin, so you see the full note.
          Students see the first ~30%, then the unlock card. Use a private window to check the student view.
        </p>
      )}
      {locked && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-2xl border border-brand/30 bg-brand/5 px-4 py-3">
          <p className="flex items-center gap-2 text-sm">
            <LockSimple size={16} weight="bold" className="shrink-0 text-brand" />
            <span>
              <strong className="font-semibold">Free preview.</strong>{" "}
              <span className="text-muted">Unlock the full notes &amp; solutions.</span>
            </span>
          </p>
          <div className="flex items-center gap-3">
            <Link href="/paid-notes" className="text-sm font-medium text-muted hover:text-foreground">Pricing</Link>
            <Link href={checkoutHref} className="inline-flex min-h-9 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
              Unlock ₹{SINGLE_PRICE}
            </Link>
          </div>
        </div>
      )}
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
                href={checkoutHref}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand-hover sm:w-auto"
              >
                Unlock for ₹{SINGLE_PRICE}
              </Link>
              <Link
                href={`/login?next=${encodeURIComponent(pathname)}`}
                className="text-sm font-medium text-brand hover:underline"
              >
                Already bought? Sign in
              </Link>
            </div>
            <p className="mt-5 text-xs text-muted">
              {PLANS.slice(1).map((p) => `${p.subjects} subjects for ₹${p.price}`).join(" · ")} ·{" "}
              <Link href="/paid-notes" className="underline hover:text-foreground">see all plans</Link>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
