"use client";

import { ArrowRight } from "@phosphor-icons/react";
import { openNotesFlow } from "@/lib/notes-promo";
import { ORDER_PRICE } from "@/lib/notes-orders";

/** The one line we sell with, on every card and pop-up. */
export const NOTES_TAGLINE = { first: "Most Repeated Questions", second: "+ PYQ Solutions" } as const;

/**
 * The in-page "get the notes" card: a dark Apple-style banner that stands out on the white page. Tapping it opens the
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
    <section
      aria-label="Most Repeated Questions and PYQ Solutions"
      className={`apple-scope relative isolate overflow-hidden rounded-[28px] bg-[#1d1d1f] p-6 text-white shadow-[0_1px_2px_rgb(0_0_0/0.08),0_24px_60px_rgb(0_0_0/0.18)] sm:rounded-[32px] sm:p-10 ${className}`}
    >
      {/* one soft light in the corner, nothing more */}
      <span aria-hidden className="pointer-events-none absolute -right-24 -top-32 -z-10 size-[26rem] rounded-full bg-[#0071e3]/25 blur-3xl" />

      <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-12">
        <div className="min-w-0">
          {forWhat && <p className="mb-3 truncate text-[13px] font-semibold uppercase tracking-[0.08em] text-white/55">For {forWhat}</p>}
          <h3 className="text-balance text-[32px] font-semibold leading-[1.04] tracking-[-0.04em] sm:text-[46px]">
            {NOTES_TAGLINE.first}
            <br />
            <span className="text-[#2997ff]">{NOTES_TAGLINE.second}</span>
          </h3>
          <p className="mt-4 max-w-xl text-[16px] leading-snug text-white/65 sm:text-[18px]">{text}</p>
          <p className="mt-5 flex flex-wrap gap-2 text-[14px] font-medium">
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-white/90">MRQ from ₹{ORDER_PRICE.mrq1}</span>
            <span className="rounded-full bg-white/10 px-3.5 py-1.5 text-white/90">Notes from ₹{ORDER_PRICE.notes1}</span>
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
  );
}
