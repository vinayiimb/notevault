"use client";

import { useState } from "react";
import { CaretRight, Check, WhatsappLogo } from "@phosphor-icons/react";
import { salesWhatsAppLink } from "@/lib/sales-whatsapp";
import type { PricingPlan } from "@/lib/notes-orders";

const TABS = [
  {
    key: "mrq",
    plans: ["mrq1", "mrq7"],
    label: "MRQ",
    title: "Most Repeated Questions",
    points: ["Exam-focused questions", "Previous year trend based", "Unit-wise & topic-wise"],
    single: 49,
    seven: { price: 249, was: 299, off: 17 },
  },
  {
    key: "notes",
    plans: ["notes1", "notes7"],
    label: "Notes",
    title: "Complete & Detailed Notes",
    points: ["In-depth & easy to understand", "Unit-wise structured notes", "Concepts, diagrams & examples"],
    single: 99,
    seven: { price: 449, was: 693, off: 35 }, // 7 x ₹99
  },
] as const;

/**
 * MRQ / Notes pricing, Apple look: an iOS segmented control, one quiet list of plans, one accent colour.
 * Three ways forward: MRQ or Notes (pay on the site: `onPlan`), or WhatsApp on the sales number with
 * "Hi i need notes" already typed in (`onWhatsApp`, a plain link so no pop-up blocker objects).
 */
export function NotesPricing({ onPlan, onWhatsApp }: { onPlan: (plan: PricingPlan) => void; onWhatsApp?: () => void }) {
  const [i, setI] = useState(0);
  const tab = TABS[i];
  const href = salesWhatsAppLink();

  return (
    <div className="px-5 pb-6 pt-14 sm:px-7 sm:pb-7">
      {/* Segmented control */}
      <div role="tablist" aria-label="What do you need" className="relative mx-auto grid max-w-[15rem] grid-cols-2 rounded-full bg-[#eeeef1] p-[3px]">
        <span
          aria-hidden
          className="absolute inset-y-[3px] left-[3px] w-[calc(50%-3px)] rounded-full bg-white shadow-[0_1px_3px_rgb(0_0_0/0.14),0_0_0_0.5px_rgb(0_0_0/0.04)] transition-transform duration-300 ease-[var(--ease-apple)]"
          style={{ transform: `translateX(${i * 100}%)` }}
        />
        {TABS.map((t, n) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={i === n}
            onClick={() => setI(n)}
            className={`relative z-10 h-9 rounded-full text-[14px] font-semibold tracking-[-0.01em] transition-colors duration-300 ${i === n ? "text-[#1d1d1f]" : "text-[#6e6e73]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div key={tab.key} className="pv-in">
        <h2 id="notes-prompt-title" className="mt-8 text-center text-[28px] font-semibold leading-[1.1] tracking-[-0.03em] text-[#1d1d1f] sm:text-[30px]">
          {tab.title}
        </h2>

        <ul className="mx-auto mt-5 max-w-[17rem] space-y-2.5">
          {tab.points.map((p) => (
            <li key={p} className="flex items-center gap-2.5 text-[15px] leading-snug text-[#424245]">
              <Check size={15} weight="bold" aria-hidden className="shrink-0 text-[#0071e3]" />
              {p}
            </li>
          ))}
        </ul>

        {/* Inset grouped list */}
        <div className="mt-7 overflow-hidden rounded-[18px] bg-[#f5f5f7]">
          <Plan onPick={() => onPlan(tab.plans[0])} label="1 Subject" price={tab.single} />
          <div aria-hidden className="mx-5 h-px bg-black/[0.07]" />
          <Plan onPick={() => onPlan(tab.plans[1])} label="7 Subjects" price={tab.seven.price} was={tab.seven.was} off={tab.seven.off} />
        </div>
      </div>

      {/* Third way: skip the payment and just talk to us */}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onWhatsApp}
        className="group mt-3 flex items-center gap-3 rounded-[18px] bg-[#f5f5f7] px-5 py-4 transition-colors duration-200 hover:bg-black/[0.05] active:bg-black/[0.07]"
      >
        <WhatsappLogo size={24} weight="fill" aria-hidden className="shrink-0 text-[#25d366]" />
        <span className="min-w-0 flex-1">
          <span className="block text-[17px] font-semibold leading-tight tracking-[-0.015em] text-[#1d1d1f]">Message us on WhatsApp</span>
          <span className="mt-0.5 block text-[13px] text-[#6e6e73]">Not sure yet? Ask us anything.</span>
        </span>
        <CaretRight size={14} weight="bold" aria-hidden className="text-[#c7c7cc] transition-transform duration-300 ease-[var(--ease-apple)] group-hover:translate-x-0.5" />
      </a>

      <p className="mt-5 text-center text-[13px] leading-snug text-[#86868b]">Pay securely online. Notes arrive on WhatsApp.</p>
    </div>
  );
}

function Plan({ onPick, label, price, was, off }: { onPick: () => void; label: string; price: number; was?: number; off?: number }) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={`${label}, ₹${price}. Pay on the site`}
      className="group flex w-full items-center gap-3 px-5 py-4 text-left transition-colors duration-200 hover:bg-black/[0.035] active:bg-black/[0.06]"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[17px] font-semibold leading-tight tracking-[-0.015em] text-[#1d1d1f]">
          {label}
          {was != null && <span className="rounded-full bg-[#0071e3]/10 px-2 py-0.5 text-[11px] font-semibold tracking-normal text-[#0071e3]">Best deal</span>}
        </p>
        {was != null && (
          <p className="mt-1 text-[13px] text-[#6e6e73]">
            <s className="decoration-[#86868b]">₹{was}</s>
            <span className="mx-1.5">·</span>
            Save {off}%
          </p>
        )}
      </div>
      <span className="text-[26px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-[#1d1d1f]">₹{price}</span>
      <CaretRight size={14} weight="bold" aria-hidden className="text-[#c7c7cc] transition-transform duration-300 ease-[var(--ease-apple)] group-hover:translate-x-0.5" />
    </button>
  );
}
