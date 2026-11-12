"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { NotesPurchase } from "@/components/notes-leads/notes-purchase";
import type { LeadResult } from "@/lib/note-lead-actions";
import { LEAD_PHONE_KEY, parseLeadPhone } from "@/lib/note-leads";
import type { OrderPlan } from "@/lib/notes-orders";

const HELP_WHATSAPP = "919376180015";

/** Phone first (the notes are delivered on WhatsApp), then the same purchase step the pop-up uses. */
export function ChatPay({
  programme,
  semester,
  plan,
  subject,
  canBuy,
}: {
  programme: { slug: string; name: string };
  semester: number;
  plan: OrderPlan;
  subject: { slug: string; name: string } | null;
  canBuy: boolean;
}) {
  const router = useRouter();
  const phoneRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<LeadResult | null>(null);

  useEffect(() => {
    try {
      const el = phoneRef.current;
      if (el && !el.value) el.value = localStorage.getItem(LEAD_PHONE_KEY) ?? ""; // a student who asked for notes before only taps Continue
    } catch {}
  }, []);

  function next(e: React.FormEvent) {
    e.preventDefault();
    const raw = phoneRef.current?.value ?? "";
    const phone = parseLeadPhone(raw);
    if (!phone) return setError("Enter a valid 10-digit mobile number.");
    try { localStorage.setItem(LEAD_PHONE_KEY, raw.trim()); } catch {}
    setResult({
      ok: true,
      phone,
      programme: programme.name,
      programmeSlug: programme.slug,
      semester,
      subject: subject?.name,
      subjectSlug: subject?.slug,
      hasNotes: false,
      canBuy,
    });
  }

  if (result) {
    return <NotesPurchase result={result} initialPlan={plan} hideContact onPayingChange={() => {}} onClose={() => { window.close(); router.push("/"); }} />;
  }

  return (
    <div>
      <p className="text-[13px] font-semibold uppercase tracking-wide text-brand">Almost there</p>
      <h1 className="mt-1 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
        {semester === 0 ? (plan === "subject" ? "Single subject" : plan === "three" ? "3 subjects" : "Whole semester") : plan === "subject" && subject ? subject.name : `Whole Semester ${semester}`}
      </h1>
      <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">
        {semester === 0 ? "Pay now, then tell us your course and subject on WhatsApp" : `${programme.name} · Semester ${semester}`}
      </p>

      {!canBuy ? (
        <div role="alert" className="rounded-2xl bg-surface-muted p-4 text-[15px] leading-snug">
          Online payment isn&apos;t available right now. Message us on WhatsApp and we&apos;ll sort it out.
          <a
            href={`https://wa.me/${HELP_WHATSAPP}?text=${encodeURIComponent(`Hi! I want ${subject?.name ?? `Semester ${semester}`} notes (${programme.name}, Sem ${semester}).`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex h-11 items-center justify-center rounded-full bg-[#25D366] text-[15px] font-semibold text-white"
          >
            Message us on WhatsApp
          </a>
        </div>
      ) : (
        <form onSubmit={next} className="flex flex-col gap-3">
          <label htmlFor="chatpay-phone" className="text-[13px] font-semibold">
            Your WhatsApp number <span className="font-normal text-muted">(we send the notes here)</span>
          </label>
          <input
            id="chatpay-phone"
            inputMode="tel"
            autoComplete="tel"
            placeholder="98765 43210"
            ref={phoneRef}
            onChange={() => setError(null)}
            className="h-[52px] rounded-2xl bg-surface-muted px-4 text-[17px] outline-none ring-2 ring-transparent transition focus:ring-brand"
          />
          {error && <p role="alert" className="text-[14px] text-red-600 dark:text-red-400">{error}</p>}
          <button type="submit" className="inline-flex h-[52px] items-center justify-center rounded-full bg-brand px-7 text-[17px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985]">
            Continue to payment
          </button>
          <p className="text-center text-[13px] text-muted">We&apos;ll only message you about these notes.</p>
        </form>
      )}
    </div>
  );
}
