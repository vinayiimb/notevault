"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpenText, Check, CheckCircle, Copy, Infinity as InfinityIcon, Star, Trophy, X } from "@phosphor-icons/react";
import type { NotesCatalogProgramme } from "@/lib/paid-notes";
import { PAID_FEATURES, PLANS, itemKey, planFor, upiPayLink } from "@/lib/paid-notes-pricing";
import { submitPaymentAction, type FormResult } from "@/lib/paid-notes-actions";

const card = "rounded-3xl bg-surface p-6 shadow-xs ring-1 ring-border/60 sm:p-8";
const inputClass =
  "w-full rounded-xl border border-border bg-surface-muted/50 px-4 py-3 text-sm focus:border-brand focus:outline-none";

export function PaidNotesCheckout({
  catalog,
  owned,
  initialPlan,
  initialItem,
  upiId,
  upiPayeeName,
  upiQrUrl,
  defaultEmail,
}: {
  catalog: NotesCatalogProgramme[];
  owned: string[];
  initialPlan: number;
  initialItem?: string;
  upiId: string | null;
  upiPayeeName: string | null;
  upiQrUrl: string | null;
  defaultEmail: string | null;
}) {
  const ownedSet = useMemo(() => new Set(owned), [owned]);
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const p of catalog) for (const s of p.subjects) map.set(itemKey(p.slug, s.slug), s.name);
    return map;
  }, [catalog]);
  const buyable = [...nameOf.keys()].filter((k) => !ownedSet.has(k)).length;

  const startItem = initialItem && nameOf.has(initialItem) && !ownedSet.has(initialItem) ? initialItem : null;
  // A pack bigger than what's left to buy could never be completed.
  const [plan, setPlan] = useState(() => (planFor(initialPlan).subjects <= buyable ? planFor(initialPlan) : PLANS[0]));
  const [programme, setProgramme] = useState(startItem?.split("/")[0] ?? catalog[0]?.slug ?? "");
  const [selected, setSelected] = useState<string[]>(startItem ? [startItem] : []);
  const [paying, setPaying] = useState(false);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<FormResult, FormData>(submitPaymentAction, {});
  const payRef = useRef<HTMLDivElement>(null);

  const current = catalog.find((p) => p.slug === programme);
  const remaining = plan.subjects - selected.length;

  function choosePlan(next: (typeof PLANS)[number]) {
    setPlan(next);
    setSelected((s) => s.slice(0, next.subjects));
    setPaying(false);
  }

  function toggle(key: string) {
    setPaying(false);
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : s.length < plan.subjects ? [...s, key] : s));
  }

  function completePurchase() {
    setPaying(true);
    requestAnimationFrame(() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  async function copyUpi() {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state.ok) {
    return (
      <Shell>
        <div className={`${card} text-center`}>
          <CheckCircle size={52} weight="fill" className="mx-auto text-green-600" />
          <h2 className="mt-4 text-xl font-semibold">Payment submitted</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            We&apos;ll verify your UPI payment (usually within a few hours) and send your login — your Gmail and a password —
            on WhatsApp. Sign in with it to open your notes on any device.
          </p>
          <Link href="/paid-notes/login" className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">
            Got the login? Sign in →
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      {/* Plan switcher */}
      <div className="grid grid-cols-3 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-border/60">
        {PLANS.map((p) => (
          <button
            key={p.subjects}
            type="button"
            disabled={p.subjects > buyable}
            onClick={() => choosePlan(p)}
            className={`rounded-xl px-2 py-2 text-xs font-medium transition disabled:opacity-40 sm:text-sm ${
              p.subjects === plan.subjects ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {p.subjects === 1 ? "1 subject" : p.subjects === 5 ? "Semester" : `${p.subjects} subjects`}
            <span className="block text-[11px] opacity-80">₹{p.price}</span>
          </button>
        ))}
      </div>

      {/* Package card */}
      <div className="overflow-hidden rounded-3xl bg-surface shadow-xs ring-1 ring-border/60">
        <div className="relative h-32 bg-[#b3acf7] dark:bg-[#4b4499]" aria-hidden>
          <Star size={44} weight="fill" className="absolute left-10 top-8 rotate-12 text-amber-400" />
          <Star size={28} weight="fill" className="absolute left-6 top-16 -rotate-6 text-amber-400" />
          <Trophy size={52} weight="duotone" className="absolute right-28 top-6 -rotate-6 text-[#2b2470]" />
          <BookOpenText size={52} weight="duotone" className="absolute right-8 top-10 rotate-6 text-[#2b2470]" />
        </div>
        <div className="-mt-6 rounded-t-3xl bg-surface p-6 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            {plan.name}
            {plan.badge && (
              <span className="ml-2 align-middle rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">{plan.badge}</span>
            )}
          </h1>
          <p className="mt-5 font-medium">Package features:</p>
          <ul className="mt-3 flex flex-col gap-3 text-sm">
            <Feature label="Subjects of your choice" value={<span className="font-semibold text-foreground">{plan.subjects}</span>} />
            {PAID_FEATURES.map((f) => (
              <Feature key={f} label={f} value={<Check size={18} weight="bold" className="text-green-600" />} />
            ))}
            <Feature label="Access" value={<span className="flex items-center gap-1 text-brand"><InfinityIcon size={20} weight="bold" /> Lifetime</span>} />
          </ul>
        </div>
      </div>

      {/* Subjects */}
      <div className={card}>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-semibold">Choose your {plan.subjects === 1 ? "subject" : `${plan.subjects} subjects`}</h2>
          <span className="shrink-0 text-xs text-muted">{selected.length}/{plan.subjects} chosen</span>
        </div>
        <label className="mt-4 block text-xs font-medium text-muted" htmlFor="pn-course">Course</label>
        <select id="pn-course" value={programme} onChange={(e) => setProgramme(e.target.value)} className={`mt-1.5 ${inputClass}`}>
          {catalog.map((p) => (
            <option key={p.slug} value={p.slug}>{p.name}</option>
          ))}
        </select>
        <ul className="mt-4 flex flex-col gap-2">
          {current?.subjects.map((s) => {
            const key = itemKey(current.slug, s.slug);
            const isOwned = ownedSet.has(key);
            const isOn = selected.includes(key);
            const full = !isOn && remaining === 0;
            return (
              <li
                key={key}
                className={`flex items-center rounded-xl border pr-4 text-sm transition ${isOn ? "border-brand bg-brand/5" : "border-border"} ${full || isOwned ? "opacity-50" : ""}`}
              >
                <button
                  type="button"
                  disabled={isOwned || full}
                  onClick={() => toggle(key)}
                  aria-pressed={isOn}
                  className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
                >
                  <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${isOn ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}>
                    {isOn && <Check size={12} weight="bold" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    {s.name}
                    {s.semester ? <span className="ml-2 text-xs text-muted">Sem {s.semester}</span> : null}
                  </span>
                </button>
                {isOwned ? (
                  <span className="text-xs font-medium text-green-600">Owned</span>
                ) : (
                  <Link href={`/notes/${key}`} className="text-xs text-muted hover:text-brand">Preview</Link>
                )}
              </li>
            );
          })}
        </ul>
        {selected.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {selected.map((key) => (
              <li key={key} className="flex items-center gap-1.5 rounded-full bg-surface-muted py-1 pl-3 pr-1.5 text-xs">
                {nameOf.get(key)}
                <button type="button" onClick={() => toggle(key)} aria-label={`Remove ${nameOf.get(key)}`} className="rounded-full p-0.5 hover:bg-border">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Price */}
      <div className={card}>
        {plan.listPrice > plan.price && (
          <>
            <Row label="Original price" value={<span className="text-muted line-through">₹{plan.listPrice}</span>} />
            <Row label="Pack discount" value={<span className="text-green-600">−₹{plan.listPrice - plan.price}</span>} />
            <div className="my-3 border-t border-border" />
          </>
        )}
        <Row label={<strong>Total</strong>} value={<strong className="text-lg">₹{plan.price}</strong>} />
      </div>

      {!paying && (
        <button
          type="button"
          disabled={remaining > 0}
          onClick={completePurchase}
          className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-green-600 text-base font-semibold text-white transition hover:bg-green-700 disabled:bg-green-600/40"
        >
          {remaining > 0 ? `Choose ${remaining} more subject${remaining > 1 ? "s" : ""}` : <>Complete purchase <ArrowRight size={18} weight="bold" /></>}
        </button>
      )}

      {/* Payment */}
      {paying && (
        <div ref={payRef} className={`${card} scroll-mt-24`}>
          <h2 className="font-semibold">Pay ₹{plan.price} by UPI</h2>
          {upiQrUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={upiQrUrl} alt="UPI QR code" className="mx-auto mt-5 size-56 rounded-2xl border border-border bg-white object-contain p-2" />
          )}
          {upiId && (
            <>
              <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-surface-muted/50 px-4 py-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{upiId}</span>
                <button type="button" onClick={copyUpi} className="flex items-center gap-1 text-xs font-semibold text-brand">
                  {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <a
                href={upiPayLink(upiId, upiPayeeName, plan.price)}
                className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-brand text-sm font-semibold text-brand sm:hidden"
              >
                Open UPI app to pay ₹{plan.price}
              </a>
            </>
          )}
          <p className="mt-3 text-xs leading-relaxed text-muted">
            Scan with GPay, PhonePe, Paytm or any UPI app and pay exactly <strong className="text-foreground">₹{plan.price}</strong>
            {upiPayeeName ? ` to ${upiPayeeName}` : ""}. Then copy the 12-digit UTR / UPI Ref No. from the receipt.
          </p>

          <form action={formAction} className="mt-6 border-t border-border pt-6">
            {selected.map((key) => (
              <input key={key} type="hidden" name="item" value={key} />
            ))}
            <label className="block text-xs font-medium text-muted" htmlFor="pn-utr">UTR / UPI reference number</label>
            <input id="pn-utr" name="utr" required inputMode="numeric" autoComplete="off" placeholder="e.g. 412345678901" className={`mt-1.5 ${inputClass}`} />
            <label className="mt-3 block text-xs font-medium text-muted" htmlFor="pn-email">Gmail (this becomes your login)</label>
            <input id="pn-email" name="email" type="email" required defaultValue={defaultEmail ?? ""} placeholder="you@gmail.com" className={`mt-1.5 ${inputClass}`} />
            <label className="mt-3 block text-xs font-medium text-muted" htmlFor="pn-phone">WhatsApp number (we send your login here)</label>
            <input id="pn-phone" name="phone" type="tel" required inputMode="tel" placeholder="98765 43210" className={`mt-1.5 ${inputClass}`} />
            {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
            <button
              type="submit"
              disabled={pending}
              className="mt-5 flex min-h-13 w-full items-center justify-center rounded-2xl bg-green-600 text-base font-semibold text-white transition hover:bg-green-700 disabled:opacity-60"
            >
              {pending ? "Submitting…" : `I've paid ₹${plan.price} — submit`}
            </button>
            <p className="mt-3 text-center text-xs text-muted">Access is activated after we verify the payment.</p>
          </form>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="border-b border-border bg-surface py-5 text-center">
        <p className="text-xl font-semibold tracking-tight sm:text-2xl">Checkout · DU PYQ Online</p>
      </div>
      <div className="mx-auto flex w-full max-w-md flex-col gap-5 px-4 py-8">{children}</div>
    </>
  );
}

function Feature({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between gap-4 text-muted">
      <span>– {label}</span>
      {value}
    </li>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span>{label}</span>
      {value}
    </div>
  );
}
