"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { Check, CheckCircle, Copy, X } from "@phosphor-icons/react";
import type { NotesCatalogProgramme } from "@/lib/paid-notes";
import { PACKS, itemKey, priceFor, upiPayLink, upsellFor } from "@/lib/paid-notes-pricing";
import { submitPaymentAction, type FormResult } from "@/lib/paid-notes-actions";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none";

export function PaidNotesCheckout({
  catalog,
  owned,
  initialItem,
  upiId,
  upiPayeeName,
  upiQrUrl,
  defaultEmail,
}: {
  catalog: NotesCatalogProgramme[];
  owned: string[];
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

  const startItem = initialItem && nameOf.has(initialItem) && !ownedSet.has(initialItem) ? initialItem : null;
  const [programme, setProgramme] = useState(startItem?.split("/")[0] ?? catalog[0]?.slug ?? "");
  const [selected, setSelected] = useState<string[]>(startItem ? [startItem] : []);
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<FormResult, FormData>(submitPaymentAction, {});

  const current = catalog.find((p) => p.slug === programme);
  const count = selected.length;
  const amount = priceFor(count);
  const fullPrice = count * PACKS[0].price;
  const upsell = upsellFor(count);

  function toggle(key: string) {
    setSelected((s) => (s.includes(key) ? s.filter((k) => k !== key) : [...s, key]));
  }

  async function copyUpi() {
    if (!upiId) return;
    await navigator.clipboard.writeText(upiId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (state.ok) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-border bg-surface p-8 text-center">
        <CheckCircle size={44} weight="fill" className="mx-auto text-green-600" />
        <h2 className="mt-4 text-xl font-semibold">Payment submitted</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We&apos;ll verify your UPI payment (usually within a few hours) and send your login — your email and a password —
          on WhatsApp. Sign in with it to open your notes on any device.
        </p>
        <Link href="/paid-notes/login" className="mt-6 inline-block text-sm font-semibold text-brand hover:underline">
          Got the login? Sign in →
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Pricing */}
      <div className="mt-8 grid grid-cols-3 gap-2 sm:gap-4">
        {PACKS.map((p) => (
          <div
            key={p.subjects}
            className={`relative rounded-2xl border bg-surface p-3 text-center sm:p-5 ${p.subjects === 3 ? "border-brand" : "border-border"}`}
          >
            {p.subjects === 3 && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-brand px-2 py-0.5 text-[10px] font-semibold text-brand-foreground sm:text-xs">
                Most popular
              </span>
            )}
            <p className="text-xl font-bold sm:text-3xl">₹{p.price}</p>
            <p className="mt-1 text-xs font-medium sm:text-sm">{p.subjects} subject{p.subjects > 1 ? "s" : ""}</p>
            <p className="mt-0.5 text-[11px] text-muted sm:text-xs">₹{Math.round(p.price / p.subjects)}/subject</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted">Mix any subjects from any course — the cheapest combination is applied automatically.</p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px]">
        {/* Step 1: subjects */}
        <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
          <h2 className="font-semibold">1. Choose your course &amp; subjects</h2>
          <label className="mt-4 block text-xs font-medium text-muted" htmlFor="pn-course">Course</label>
          <select id="pn-course" value={programme} onChange={(e) => setProgramme(e.target.value)} className={`mt-1.5 ${inputClass}`}>
            {catalog.map((p) => (
              <option key={p.slug} value={p.slug}>{p.name}</option>
            ))}
          </select>

          <p className="mt-5 text-xs font-medium text-muted">Subjects with notes</p>
          <ul className="mt-2 flex flex-col gap-2">
            {current?.subjects.map((s) => {
              const key = itemKey(current.slug, s.slug);
              const isOwned = ownedSet.has(key);
              const isOn = selected.includes(key);
              return (
                <li
                  key={key}
                  className={`flex items-center rounded-xl border pr-3.5 text-sm transition ${isOn ? "border-brand bg-brand/5" : "border-border hover:border-brand/50"}`}
                >
                  <button
                    type="button"
                    disabled={isOwned}
                    onClick={() => toggle(key)}
                    aria-pressed={isOn}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left disabled:opacity-60"
                  >
                    <span className={`flex size-5 shrink-0 items-center justify-center rounded-md border ${isOn ? "border-brand bg-brand text-brand-foreground" : "border-border"}`}>
                      {isOn && <Check size={12} weight="bold" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      {s.name}
                      {s.semester && <span className="ml-2 text-xs text-muted">Sem {s.semester}</span>}
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
        </section>

        {/* Summary + pay */}
        <aside className="flex flex-col gap-6 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
            <h2 className="font-semibold">Your selection</h2>
            {count === 0 ? (
              <p className="mt-3 text-sm text-muted">No subjects yet — pick from the list.</p>
            ) : (
              <ul className="mt-3 flex flex-wrap gap-2">
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
            <div className="mt-4 flex items-baseline justify-between border-t border-border pt-4">
              <span className="text-sm text-muted">{count} subject{count === 1 ? "" : "s"}</span>
              <span className="text-2xl font-bold">
                {amount > 0 && amount < fullPrice && <span className="mr-2 text-sm font-normal text-muted line-through">₹{fullPrice}</span>}
                ₹{amount}
              </span>
            </div>
            {upsell && (
              <p className="mt-2 rounded-lg bg-brand/5 px-3 py-2 text-xs text-brand">
                Add 1 more subject for just ₹{upsell.extra} more.
              </p>
            )}
          </section>

          {count > 0 && (
            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="font-semibold">2. Pay ₹{amount} by UPI</h2>
              {upiQrUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={upiQrUrl} alt="UPI QR code" className="mx-auto mt-4 size-52 rounded-xl border border-border bg-white object-contain p-2" />
              )}
              {upiId && (
                <>
                  <div className="mt-4 flex items-center gap-2 rounded-xl border border-border bg-background px-3.5 py-2.5">
                    <span className="min-w-0 flex-1 truncate font-mono text-sm">{upiId}</span>
                    <button type="button" onClick={copyUpi} className="flex items-center gap-1 text-xs font-semibold text-brand">
                      {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <a
                    href={upiPayLink(upiId, upiPayeeName, amount)}
                    className="mt-3 flex min-h-11 items-center justify-center rounded-xl border border-brand text-sm font-semibold text-brand sm:hidden"
                  >
                    Open UPI app to pay ₹{amount}
                  </a>
                </>
              )}
              <p className="mt-3 text-xs leading-relaxed text-muted">
                Scan with GPay, PhonePe, Paytm or any UPI app and pay exactly <strong className="text-foreground">₹{amount}</strong>
                {upiPayeeName ? ` to ${upiPayeeName}` : ""}. Then note the 12-digit UTR / UPI Ref No. from the payment receipt.
              </p>
            </section>
          )}

          {count > 0 && (
            <form action={formAction} className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <h2 className="font-semibold">3. Submit your payment</h2>
              {selected.map((key) => (
                <input key={key} type="hidden" name="item" value={key} />
              ))}
              <label className="mt-4 block text-xs font-medium text-muted" htmlFor="pn-utr">UTR / UPI reference number</label>
              <input id="pn-utr" name="utr" required inputMode="numeric" autoComplete="off" placeholder="e.g. 412345678901" className={`mt-1.5 ${inputClass}`} />
              <label className="mt-3 block text-xs font-medium text-muted" htmlFor="pn-email">Gmail (this becomes your login)</label>
              <input id="pn-email" name="email" type="email" required defaultValue={defaultEmail ?? ""} placeholder="you@gmail.com" className={`mt-1.5 ${inputClass}`} />
              <label className="mt-3 block text-xs font-medium text-muted" htmlFor="pn-phone">WhatsApp number (we send your login here)</label>
              <input id="pn-phone" name="phone" type="tel" required inputMode="tel" placeholder="98765 43210" className={`mt-1.5 ${inputClass}`} />
              {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
              <button
                type="submit"
                disabled={pending}
                className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
              >
                {pending ? "Submitting…" : `I've paid ₹${amount} — submit`}
              </button>
              <p className="mt-3 text-center text-xs text-muted">Access is activated after we verify the payment.</p>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
