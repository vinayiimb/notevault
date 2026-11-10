"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChatCircleDots, Check, Lock, WhatsappLogo } from "@phosphor-icons/react";
import { leadWantsChatAction, type LeadResult } from "@/lib/note-lead-actions";
import { chatLink } from "@/lib/chat-link";
import { ANY_SUBJECT } from "@/lib/note-leads";
import { NOTES_DELIVERY_TEXT, ORDER_PRICE, orderPlanLabel, type OrderPlan } from "@/lib/notes-orders";

const HELP_WHATSAPP = "919376180015";

type RzpOptions = Record<string, unknown>;
type RzpCtor = new (options: RzpOptions) => { open: () => void };

// The Razorpay window is only needed once someone is about to pay, so it isn't loaded with the page.
function loadRazorpay(): Promise<RzpCtor> {
  const w = window as unknown as { Razorpay?: RzpCtor };
  if (w.Razorpay) return Promise.resolve(w.Razorpay);
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => (w.Razorpay ? resolve(w.Razorpay) : reject(new Error("The payment window didn't load.")));
    s.onerror = () => reject(new Error("Couldn't load the payment window. Check your connection and try again."));
    document.head.appendChild(s);
  });
}

/** 919876543210 -> "+91 98••• ••210" */
function maskPhone(phone: string) {
  const m = /^91(\d{2})\d{5}(\d{3})$/.exec(phone);
  return m ? `+91 ${m[1]}••• ••${m[2]}` : "your WhatsApp";
}

const pill =
  "inline-flex h-[52px] w-full items-center justify-center rounded-full bg-brand px-7 text-[17px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985] disabled:opacity-60";

/**
 * The step after the lead form: "Want the notes today?" with one subject or the whole semester. They pay on
 * Razorpay and we send the notes on WhatsApp within the buffer, by hand, so any subject can be sold,
 * including ones whose notes are still being written. Paid orders land in /admin/leads.
 */
export function NotesPurchase({
  result,
  onPayingChange,
  onClose,
}: {
  result: LeadResult;
  /** true while Razorpay's window is open: the pop-up steps aside, since a native modal blocks clicks outside it. */
  onPayingChange: (paying: boolean) => void;
  onClose: () => void;
}) {
  const semester = result.semester ?? 0;
  const canBuy = !!(result.phone && result.programme && result.programmeSlug && semester) && result.canBuy === true;
  const canSubject = canBuy && !!result.subject && result.subject !== ANY_SUBJECT && !!result.subjectSlug;
  const [plan, setPlan] = useState<OrderPlan>("semester");
  const [phase, setPhase] = useState<"choose" | "paid" | "pending" | "later">(canBuy ? "choose" : "later");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (canBuy) loadRazorpay().catch(() => {}); // warm up; a failure is reported when they press Pay
  }, [canBuy]);

  const subjectName = canSubject ? result.subject! : "";
  const label = orderPlanLabel({ plan, subject: subjectName, semester });

  async function pay() {
    setError(null);
    setBusy(true);
    let settled = false;
    try {
      const orderRes = await fetch("/api/notes-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          phone: result.phone,
          programme: result.programme,
          programmeSlug: result.programmeSlug,
          semester,
          subject: plan === "subject" ? subjectName : "",
          subjectSlug: plan === "subject" ? result.subjectSlug : "",
        }),
      });
      const order = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) throw new Error(order.error ?? "Could not start the payment.");

      const Razorpay = await loadRazorpay();
      onPayingChange(true);
      const rzp = new Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount * 100,
        currency: "INR",
        name: "DU PYQ Online",
        description: `${label} notes · ${result.programme}`,
        prefill: { contact: `+${result.phone}` },
        theme: { color: "#0071e3" },
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          settled = true;
          onPayingChange(false);
          const verify = await fetch("/api/notes-orders/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          }).catch(() => null);
          // Money has moved either way; if verification didn't land, the webhook records the order.
          setPhase(verify?.ok ? "paid" : "pending");
          setBusy(false);
        },
        modal: {
          ondismiss: () => {
            if (settled) return;
            onPayingChange(false);
            setBusy(false);
          },
        },
      });
      rzp.open();
    } catch (err) {
      onPayingChange(false);
      setBusy(false);
      setError(err instanceof Error ? err.message : "Could not start the payment.");
    }
  }

  if (phase !== "choose") {
    const paid = phase === "paid" || phase === "pending";
    return (
      <div role="status" className="py-4 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success text-white">
          <Check size={28} weight="bold" />
        </span>
        <h2 id="notes-prompt-title" className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">
          {phase === "paid" ? "Payment received. Thank you!" : phase === "pending" ? "Payment received." : "Thanks! We'll message you."}
        </h2>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          {paid ? (
            <>
              Your notes ({label}) will arrive on WhatsApp ({maskPhone(result.phone ?? "")}) {NOTES_DELIVERY_TEXT}.
              {phase === "pending" && " We're still confirming the payment on our side; you don't need to pay again."}
            </>
          ) : (
            "We'll message you personally on WhatsApp to help with your notes. If you'd like to pay, we'll share the details there."
          )}
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <a
            href={`https://wa.me/${HELP_WHATSAPP}?text=${encodeURIComponent(
              paid ? `Hi! I just paid for ${label} notes (${result.programme}, Sem ${semester}).` : `Hi! I need ${result.subject ?? ""} notes from DU PYQ Online.`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-[15px] font-semibold text-white transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.98]"
          >
            <WhatsappLogo size={18} weight="fill" />
            Chat with us
          </a>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center rounded-full bg-surface-muted px-5 text-[15px] font-medium transition hover:brightness-95"
          >
            Done
          </button>
        </div>
        {phase === "later" && canBuy && (
          <button type="button" onClick={() => setPhase("choose")} className="mt-3 text-[14px] font-medium text-brand transition hover:underline">
            Pay now instead
          </button>
        )}
      </div>
    );
  }

  const options: { plan: OrderPlan; title: string; detail: string; badge?: string }[] = [
    ...(canSubject ? [{ plan: "subject" as const, title: "This subject", detail: subjectName }] : []),
    { plan: "semester", title: `Whole Semester ${semester}`, detail: "All subjects of the semester, one price", badge: "Best value" },
  ];
  const selected: OrderPlan = options.some((o) => o.plan === plan) ? plan : "semester";

  return (
    <div>
      <h2 id="notes-prompt-title" className="pr-10 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
        Want the notes today?
      </h2>
      <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">
        {result.programme} · Semester {semester}
      </p>

      <div role="radiogroup" aria-label="Choose your notes" className="flex flex-col gap-2.5">
        {options.map((o) => {
          const on = o.plan === selected;
          return (
            <button
              key={o.plan}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPlan(o.plan)}
              className={`relative flex items-center gap-3 rounded-[18px] px-4 py-3.5 text-left ring-2 transition duration-200 ${
                on ? "bg-brand/5 ring-brand" : "bg-surface-muted ring-transparent hover:brightness-95"
              } ${o.badge ? "mt-1.5" : ""}`}
            >
              {o.badge && (
                <span className="absolute -top-2.5 right-4 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-foreground">
                  {o.badge}
                </span>
              )}
              <span
                aria-hidden
                className={`flex size-[22px] shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand bg-brand text-white" : "border-muted/50"}`}
              >
                {on && <Check size={12} weight="bold" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[16px] font-semibold leading-tight">{o.title}</span>
                <span className="mt-0.5 line-clamp-2 block text-[14px] leading-snug text-muted">{o.detail}</span>
              </span>
              <span className="shrink-0 text-[19px] font-semibold tracking-tight tabular-nums">₹{ORDER_PRICE[o.plan]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[14px] text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <button type="button" onClick={pay} disabled={busy} className={`${pill} mt-4`}>
        {busy ? "Opening payment…" : `Pay ₹${ORDER_PRICE[selected]}`}
      </button>
      <p className="mt-3 text-center text-[13px] leading-snug text-muted">
        <Lock size={13} weight="bold" className="mr-1 inline-block align-[-2px]" />
        Secure payment by Razorpay. Notes on WhatsApp {NOTES_DELIVERY_TEXT}.
      </p>

      <div className="my-3 flex items-center gap-3 text-[12px] uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <a
        href={chatLink(`Hi! I need ${selected === "subject" ? subjectName : "all subjects"} notes for ${result.programme ?? "my course"}, Semester ${semester}`.replace(/\s+/g, " "))}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-muted px-6 text-[16px] font-medium text-foreground transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.985]"
      >
        <ChatCircleDots size={20} weight="fill" className="text-brand" />
        Chat now
      </a>
      <button
        type="button"
        onClick={() => {
          void leadWantsChatAction({ phone: result.phone ?? "" }).catch(() => undefined); // tells the owner on WhatsApp
          setPhase("later");
        }}
        className="mt-2.5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-surface-muted px-6 text-[16px] font-medium text-foreground transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.985]"
      >
        <WhatsappLogo size={18} weight="fill" className="text-[#25D366]" />
        Message me on WhatsApp first
      </button>
      <p className="mt-2 text-center text-[13px] leading-snug text-muted">Chat with us live, or we&apos;ll message you on WhatsApp. You can pay after we talk.</p>
      <div className="mt-2 text-center text-[13px]">
        <Link href="/refund-policy" target="_blank" className="text-muted underline-offset-2 transition hover:text-foreground hover:underline">
          Refund policy
        </Link>
      </div>
    </div>
  );
}
