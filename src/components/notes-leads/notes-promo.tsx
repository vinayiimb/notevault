"use client";

import { ArrowRight, BookOpenText } from "@phosphor-icons/react";
import { openNotesFlow } from "@/lib/notes-promo";
import { ORDER_PRICE } from "@/lib/notes-orders";

/**
 * An in-page "get the notes" card. Tapping it opens the same notes flow as the pop-up (form, then pay or have us
 * reach out) and tells the pop-up not to appear later: the visitor has been offered the notes once already.
 * The page needs a <NotesPrompt> mounted; it opens it.
 *
 * Apple look (soft grey tile, SF type, blue pill). `apple-scope` restores the Apple palette on pages that keep
 * the classic theme, such as /papers.
 */
export function NotesPromoCard({
  title = "Need notes for your subject?",
  text = "Solved answers, the most repeated questions and exam tips, sent on WhatsApp.",
  cta = "Get the notes",
  className = "",
}: {
  title?: string;
  text?: string;
  cta?: string;
  className?: string;
}) {
  return (
    <section
      aria-label="Get notes"
      className={`apple-scope flex flex-col gap-5 rounded-[24px] bg-surface-muted p-5 text-foreground shadow-[var(--shadow-tile)] sm:flex-row sm:items-center sm:gap-6 sm:p-7 ${className}`}
    >
      <div className="flex min-w-0 flex-1 items-start gap-4">
        <span
          aria-hidden
          className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-gradient-to-b from-[#3fa0ff] to-[#0071e3] text-white shadow-[0_8px_20px_rgb(0_113_227/0.32)] sm:size-14 sm:rounded-[16px]"
        >
          <BookOpenText size={26} weight="fill" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[19px] font-semibold leading-snug tracking-[-0.02em] sm:text-[22px]">{title}</h3>
          <p className="mt-1 text-[15px] leading-snug text-muted">{text}</p>
          <p className="mt-2.5 text-[14px] font-medium text-foreground/80">
            ₹{ORDER_PRICE.subject} a subject
            <span aria-hidden className="mx-1.5 text-muted">
              ·
            </span>
            ₹{ORDER_PRICE.semester} for the whole semester
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={openNotesFlow}
        className="inline-flex h-12 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-7 text-[16px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985] sm:w-auto"
      >
        {cta}
        <ArrowRight size={16} weight="bold" />
      </button>
    </section>
  );
}
