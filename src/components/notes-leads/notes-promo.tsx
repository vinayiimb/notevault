"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { openNotesFlow } from "@/lib/notes-promo";
import { ORDER_PRICE } from "@/lib/notes-orders";

/** The one line we sell with, on every card and pop-up. */
export const NOTES_TAGLINE = { first: "Most Repeated Questions", second: "+ PYQ Solutions" } as const;

/**
 * The in-page "get the notes" card: a light Apple-style tile in a thin blue-violet-pink gradient frame. Tapping it opens the
 * same flow as the pop-up (plans, then pay). The page needs a <NotesPrompt> mounted; it opens it.
 *
 * Callers still pass `title="Need notes for Economics?"`; only the "Economics" part is used (as the small "For …" line),
 * the headline is always the tagline. `apple-scope` restores the Apple palette on pages that keep the classic theme.
 */
export function NotesPromoCard({
  title,
  text = "Exam-focused and unit-wise, sent to you on WhatsApp.",
  cta = "See plans",
  className = "",
}: {
  title?: string;
  text?: string;
  cta?: string;
  className?: string;
}) {
  const forWhat = title?.match(/^Need notes for (.+)\?$/)?.[1];
  return (
    // Gradient hairline frame (blue -> violet -> pink) around a calm light tile; the gradient also lights the tagline.
    <div className={`apple-scope rounded-[30px] bg-[linear-gradient(120deg,#0a84ff,#8b5cf6_45%,#ec4899)] p-[1.5px] shadow-[0_24px_60px_-28px_rgb(139_92_246/0.55)] sm:rounded-[34px] ${className}`}>
      <section
        aria-label="Most Repeated Questions and PYQ Solutions"
        className="relative isolate overflow-hidden rounded-[28.5px] bg-[#fbfbfd] p-6 text-[#1d1d1f] sm:rounded-[32.5px] sm:p-10 dark:bg-[#1c1c1e] dark:text-[#f5f5f7]"
      >
        {/* two soft washes of the same gradient, low enough that text stays crisp */}
        <span aria-hidden className="pointer-events-none absolute -right-28 -top-36 -z-10 size-[24rem] rounded-full bg-[radial-gradient(circle,rgb(139_92_246/0.16),transparent_65%)]" />
        <span aria-hidden className="pointer-events-none absolute -bottom-40 -left-24 -z-10 size-[22rem] rounded-full bg-[radial-gradient(circle,rgb(10_132_255/0.12),transparent_65%)]" />

        <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
          <div className="min-w-0">
            {forWhat && <p className="mb-3 truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-[#6e6e73] dark:text-[#a1a1a6]">For {forWhat}</p>}
            <h3 className="text-balance text-[32px] font-semibold leading-[1.06] tracking-[-0.04em] sm:text-[46px]">
              {NOTES_TAGLINE.first}
              <br />
              <span className="bg-[linear-gradient(100deg,#0066cc,#7c3aed_50%,#db2777)] bg-clip-text text-transparent dark:bg-[linear-gradient(100deg,#4da3ff,#c084fc_50%,#f472b6)]">{NOTES_TAGLINE.second}</span>
            </h3>
            <p className="mt-4 max-w-xl text-[16px] leading-snug text-[#6e6e73] sm:text-[18px] dark:text-[#a1a1a6]">{text}</p>
            <p className="mt-5 flex flex-wrap gap-2 text-[14px] font-medium">
              <span className="rounded-full bg-black/[0.05] px-3.5 py-1.5 dark:bg-white/10">MRQ from ₹{ORDER_PRICE.mrq1}</span>
              <span className="rounded-full bg-black/[0.05] px-3.5 py-1.5 dark:bg-white/10">Notes from ₹{ORDER_PRICE.notes1}</span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => openNotesFlow()}
            className="inline-flex h-14 w-full shrink-0 items-center justify-center gap-2 rounded-full bg-[#0071e3] px-9 text-[18px] font-semibold tracking-[-0.01em] text-white transition duration-300 ease-[var(--ease-apple)] hover:bg-[#0077ed] active:scale-[0.985] lg:w-auto"
          >
            {cta}
            <ArrowRight size={18} weight="bold" />
          </button>
        </div>
      </section>
    </div>
  );
}
