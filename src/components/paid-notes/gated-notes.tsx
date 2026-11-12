"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, LockSimple } from "@phosphor-icons/react";
import { HtmlNoteFrame } from "@/components/content/notes/html-note-frame";
import { isHtmlNote } from "@/lib/content/html-note";
import { NotesReadingChrome } from "@/components/content/notes/reading-chrome";
import { extractContentHeadings, preprocessNotesMarkdown, type ContentHeading } from "@/lib/content/toc";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { PLANS, PREVIEW_SECONDS, SINGLE_PRICE, STUDENT_PDF_DOWNLOAD, itemKey } from "@/lib/paid-notes-pricing";
import { NoteGuard } from "./note-guard";

// Counts down the free preview's reading time while `active` and the tab is visible. Seconds used are kept in
// localStorage per note, so a refresh doesn't restart it. Client-side only: a visitor who clears site data gets a fresh
// 3 minutes (the server can't tell who an anonymous reader is). Returns the seconds left.
function usePreviewTimer(key: string, active: boolean) {
  const [used, setUsed] = useState(0);
  useEffect(() => {
    if (!active) return;
    const storeKey = `notevault:preview-used:${key}`;
    let seconds = 0;
    try {
      seconds = Math.min(PREVIEW_SECONDS, Number(localStorage.getItem(storeKey)) || 0);
    } catch {}
    setUsed(seconds);
    const id = setInterval(() => {
      if (document.hidden || seconds >= PREVIEW_SECONDS) return;
      seconds += 1;
      setUsed(seconds);
      try {
        localStorage.setItem(storeKey, String(seconds));
      } catch {}
    }, 1000);
    return () => clearInterval(id);
  }, [key, active]);
  return PREVIEW_SECONDS - used;
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// A paid note: the server renders only the free preview (cached, crawlable);
// this asks /api/notes-access what the visitor may do. Admins get the rest
// swapped in. An enrolled student is sent to their dashboard, where the full
// note lives after login. Everyone else sees the unlock card under the preview.
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
  const [full, setFull] = useState<{ content: string; headings: ContentHeading[] } | null>(null);
  const [locked, setLocked] = useState(false);
  const [owned, setOwned] = useState(false);
  const [adminView, setAdminView] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/notes-access?p=${encodeURIComponent(programmeSlug)}&s=${encodeURIComponent(subjectSlug)}`)
      .then(async (res) => {
        if (cancelled) return;
        const { content, admin, owned: ownsIt } = res.ok ? ((await res.json()) as { content?: string; admin?: boolean; owned?: boolean }) : {};
        if (ownsIt) return setOwned(true);
        if (!content) return setLocked(true);
        setAdminView(!!admin);
        const preprocessed = isHtmlNote(content) ? content : preprocessNotesMarkdown(content);
        setFull({ content: preprocessed, headings: isHtmlNote(content) ? [] : extractContentHeadings(preprocessed) });
      })
      .catch(() => !cancelled && setLocked(true));
    return () => {
      cancelled = true;
    };
  }, [programmeSlug, subjectSlug]);

  const timeLeft = usePreviewTimer(itemKey(programmeSlug, subjectSlug), locked);
  const expired = locked && timeLeft <= 0;

  const checkoutHref = `/paid-notes/checkout?plan=1&add=${encodeURIComponent(itemKey(programmeSlug, subjectSlug))}`;
  const readerHref = `/account/notes/${programmeSlug}/${subjectSlug}`;

  return (
    <>
      {!adminView && <NoteGuard />}
      {/* the reader below is full-bleed, so the bars above it keep to its width */}
      <div className="mx-auto max-w-[69rem] px-4 sm:px-6">
      {adminView && (
        <p className="mb-3 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <strong className="font-semibold">Admin view:</strong> you&apos;re signed in as admin, so you see the full note.
          Students see the first ~15% for 3 minutes, then the unlock card. Use a private window to check the student view.
        </p>
      )}
      {owned && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-brand/10 px-4 py-2.5">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <CheckCircle size={18} weight="fill" className="shrink-0 text-brand" />
            <span className="min-w-0">
              <strong className="font-semibold">You own this note.</strong>
              <span className="hidden text-muted sm:inline"> Read it in your dashboard.</span>
            </span>
          </p>
          <Link href={readerHref} className="inline-flex min-h-9 shrink-0 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
            Open
          </Link>
        </div>
      )}
      {locked && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-foreground/[0.045] px-4 py-2.5">
          <p className="flex min-w-0 items-center gap-2 text-sm">
            <LockSimple size={16} weight="bold" className="shrink-0 text-brand" />
            <span className="min-w-0">
              <strong className="font-semibold">Free preview{expired ? " ended" : ` \u00b7 ${clock(timeLeft)} left`}.</strong>
              <span className="hidden text-muted sm:inline"> Unlock the full notes &amp; solutions.</span>
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/paid-notes" className="hidden text-sm font-medium text-muted hover:text-foreground sm:inline">Pricing</Link>
            <Link href={checkoutHref} className="inline-flex min-h-9 items-center rounded-full bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand-hover">
              Unlock ₹{SINGLE_PRICE}
            </Link>
          </div>
        </div>
      )}
      </div>
      {expired ? null : isHtmlNote(full?.content ?? preview) ? (
        <HtmlNoteFrame html={full?.content ?? preview} title={title} />
      ) : (
        <NotesReadingChrome
          title={title}
          programmeName={programmeName}
          content={full?.content ?? preview}
          headings={full?.headings ?? headings}
          subjectTheme={subjectTheme}
          downloadable={!!full}
        />
      )}
      {(locked || owned) && (
        <div className={`relative px-4 sm:px-6 ${expired ? "mt-8" : "-mt-24"}`}>
          {!expired && <div className="pointer-events-none h-24 bg-gradient-to-b from-transparent to-background" />}
          <div className="mx-auto max-w-xl rounded-3xl bg-surface p-6 text-center shadow-[0_1px_2px_rgba(0,0,0,.05),0_20px_50px_-14px_rgba(0,0,0,.22)] ring-1 ring-foreground/[0.06] sm:p-8">
            <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-brand/10 text-brand">
              <LockSimple size={22} weight="bold" />
            </span>
            <h2 className="mt-4 text-xl font-semibold tracking-tight">
              {owned ? "The full note is in your dashboard" : expired ? "Your 3-minute free preview has ended" : "You\u2019ve read the free preview"}
            </h2>
            {owned ? (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  You own {title}. Open it in your student dashboard for the complete notes, solved answers and diagrams.
                </p>
                <div className="mt-6 flex justify-center">
                  <Link
                    href={readerHref}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand-hover sm:w-auto"
                  >
                    Open in my dashboard
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  Unlock the complete {title} notes with full solutions and diagrams{STUDENT_PDF_DOWNLOAD ? " and PDF download" : ""} — for just ₹{SINGLE_PRICE}. You read them in your student dashboard after logging in.
                </p>
                <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
                  <Link
                    href={checkoutHref}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-6 text-sm font-semibold text-brand-foreground hover:bg-brand-hover sm:w-auto"
                  >
                    Unlock for ₹{SINGLE_PRICE}
                  </Link>
                  <Link href={`/login?next=${encodeURIComponent(readerHref)}`} className="text-sm font-medium text-brand hover:underline">
                    Already bought? Log in
                  </Link>
                </div>
                <p className="mt-5 text-xs text-muted">
                  {PLANS.slice(1).map((p) => `${p.subjects} subjects for ₹${p.price}`).join(" · ")} ·{" "}
                  <Link href="/paid-notes" className="underline hover:text-foreground">see all plans</Link>
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
