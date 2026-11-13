"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, CaretLeft, Check, WhatsappLogo, X } from "@phosphor-icons/react";
import { parseLeadSemester } from "@/lib/note-leads";
import { CLOSE_NOTES_EVENT, OPEN_NOTES_EVENT } from "@/lib/notes-promo";
import { markWhatsAppOpened, trackIntent } from "@/lib/lead-intent";
import { PhoneOnlyForm, useKnownLead } from "./lead-form";
import { NotesPricing } from "./notes-pricing";
import { ChatPay } from "./chat-pay";
import { NOTES_TAGLINE } from "./notes-promo";
import { CHAT_ORDER, type PricingPlan } from "@/lib/notes-orders";
import { salesWhatsAppLink } from "@/lib/sales-whatsapp";

// Value = the time until which the pop-up stays quiet (sessionStorage, so it ends with the visit).
const OFF_KEY = "nv_notes_prompt_off";
// "No" snoozes the pop-up for under a minute only: it should be there whenever someone opens a page, and a few
// seconds of quiet is enough to not nag on a quick second click.
const SNOOZE_MS = 45 * 1000;
// "Yes" opened WhatsApp for them: asking again straight away would only annoy.
const YES_QUIET_MS = 5 * 60 * 1000;
// /papers: the student just opened a paper. Let it start loading first.
const PAPER_DELAY_MS = 1400;
// PYQ pages reached from Google or a link: a short beat (asking later lost people who leave within seconds).
const LANDING_DELAY_MS = 2000;

// Someone who already left a number is the likeliest buyer, so they are asked again, but not on every single page.
const KNOWN_KEY = "nv_notes_prompt_known_at";
const KNOWN_COOLDOWN_MS = 10 * 60 * 1000;

// How many page-specific prompts (a PYQ page that knows its subject, /papers...) are mounted right now. The
// site-wide prompt in the layout stays quiet while one exists, so a visitor never gets two pop-ups.
let pagePrompts = 0;

function askedRecently() {
  try {
    const t = Number(localStorage.getItem(KNOWN_KEY));
    return t > 0 && Date.now() - t < KNOWN_COOLDOWN_MS;
  } catch {
    return false;
  }
}

function markAsked() {
  try {
    localStorage.setItem(KNOWN_KEY, String(Date.now()));
  } catch {}
}

function quietFor(ms: number) {
  try {
    sessionStorage.setItem(OFF_KEY, String(Date.now() + ms));
  } catch {}
}

function promptOff() {
  try {
    return Date.now() < Number(sessionStorage.getItem(OFF_KEY));
  } catch {
    return false;
  }
}

// Centred on every screen size (the bottom of a phone is the least-seen place on it).
const DIALOG =
  "lead-pop apple-scope m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[26rem] overflow-y-auto rounded-[32px] bg-white p-0 text-foreground shadow-[0_0_0_0.5px_rgb(0_0_0/0.08),0_30px_80px_rgb(0_0_0/0.28)] backdrop:bg-black/30 backdrop:backdrop-blur-md";

/**
 * "Need notes for this subject?" — Yes/No first, so people who don't want notes never see a form. Yes opens the
 * form, and once it is saved the pop-up offers to buy the notes (one subject or the whole semester).
 *
 * - /papers (source "paper-pdf"): ~1.4 s after a paper opens (`paperId`).
 * - PYQ pages (source "pyq-page"): ~2 s after arriving.
 *   What the form asks depends on what the page knows: subject (phone only), course (semester, an optional
 *   subject, phone) or nothing (course too).
 *
 * Yes (the owner is alerted, 💎): WhatsApp opens on the sales number with "Hi i need notes" already typed; when they
 * come back to the page the on-site chat opens by itself (see chat-now-fab). A promo card ("See plans") opens the
 * MRQ / Notes plans instead: tap a plan to pay on the site (WhatsApp number, then Razorpay), or message us on WhatsApp. No: nobody is alerted; the pop-up asks for their WhatsApp number instead
 * (the lead form). X / Esc / the backdrop just close it. Someone who already left a number is asked again (they are
 * the likeliest buyers), but not on every page.
 *
 * source "site" is the one mounted in the layout for every public page (NotesPromptSite); it stays quiet on pages
 * that have their own prompt.
 */
export function NotesPrompt({
  source,
  paperId,
  course,
  subject,
  semester,
  auto = true,
  pickKey,
}: {
  source: "paper-pdf" | "pyq-page" | "site";
  /** /papers browser only: the paper that is open. The prompt waits for one. */
  paperId?: string | null;
  course?: { name: string; slug?: string };
  subject?: string;
  semester?: string | number | null;
  /** Accepted for the existing callers; the "No" form asks for the number only, so these are no longer used. */
  subjects?: string[];
  courses?: { slug: string; name: string }[];
  /** false: never pops up by itself; it only opens when a promo card is tapped. */
  auto?: boolean;
  /** /papers: changes whenever the student picks a course, semester or subject. Each pick asks at once (no delay). */
  pickKey?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const known = useKnownLead();
  const ignoreClose = useRef(false);
  const [step, setStep] = useState<"ask" | "plans" | "pay" | "form" | "thanks" | null>(null);
  const [payPlan, setPayPlan] = useState<PricingPlan>("notes7");
  const [payReady, setPayReady] = useState<boolean | null>(null); // can the site take a payment right now? (asked when the plans open)
  const [paying, setPaying] = useState(false);

  const landing = source !== "paper-pdf";
  const siteWide = source === "site";
  const semNumber = parseLeadSemester(semester);
  // What the funnel beacons and the chat's first message say about this visitor's request (never personal data).
  const intentCtx = { source, programme: course?.name, subject, semester: semNumber };
  const intentRef = useRef(intentCtx);
  useEffect(() => {
    intentRef.current = intentCtx; // the window-level promo listener below reads the latest values
  });
  // The lead form's server action only knows the original sources.
  const leadSource = source === "site" ? "pyq-page" : source;

  useEffect(() => {
    if (siteWide) return;
    pagePrompts += 1;
    return () => {
      pagePrompts -= 1;
    };
  }, [siteWide]);

  // Testing aid: opening any page with ?popup=reset forgets "said Yes / said No / already asked today" on this device.
  // (First effect on purpose: the ones below read that state.)
  useEffect(() => {
    try {
      if (new URLSearchParams(location.search).get("popup") === "reset") {
        sessionStorage.removeItem(OFF_KEY);
        localStorage.removeItem(KNOWN_KEY);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!auto || (!landing && !paperId)) return;
    if (promptOff() || (known && askedRecently())) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let shown = false;
    const arm = () => {
      timer = setTimeout(() => {
        if (document.visibilityState !== "visible" || promptOff()) return; // a hidden tab re-arms when it comes back
        if (siteWide && pagePrompts > 0) return; // this page has its own, more specific prompt
        shown = true;
        if (known) markAsked();
        setStep((s) => s ?? "ask");
      }, landing ? LANDING_DELAY_MS : PAPER_DELAY_MS);
    };
    // A page opened in a background tab used to lose its one chance: the timer fired while nobody was looking.
    const onVisible = () => {
      if (shown || document.visibilityState !== "visible") return;
      clearTimeout(timer);
      arm();
    };
    arm();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [auto, landing, paperId, known, siteWide]);

  // Course / semester / subject just picked: ask right away (the lead is warmest at the click).
  const firstPick = useRef(true);
  useEffect(() => {
    if (!pickKey) return;
    if (firstPick.current) {
      firstPick.current = false;
      if (!pickKey.replace(/\|/g, "")) return; // nothing picked yet
    }
    if (promptOff() || (known && askedRecently())) return;
    const t = setTimeout(() => { // next tick = "instantly" to the eye, and keeps setState out of the effect body
      if (known) markAsked();
      setStep((s) => s ?? "ask");
    }, 0);
    return () => clearTimeout(t);
  }, [pickKey, known]);

  // Said Yes on the pop-up: WhatsApp opens on the sales number with "Hi i need notes" already typed (the link itself),
  // the owner is alerted once (💎), and the chat opens when they come back to this page.
  function afterYes() {
    trackIntent("yes", intentRef.current);
    markWhatsAppOpened();
    quietFor(YES_QUIET_MS);
    setStep(null);
  }
  useEffect(() => {
    // Promo card tap: that is a Yes.
    const open = (e: Event) => {
      if (siteWide && pagePrompts > 0) return; // the page's own prompt handles it
      // A card tap is a Yes. Coming back from WhatsApp opens the plans too, but that Yes was already counted.
      if (!(e as CustomEvent<{ quiet?: boolean }>).detail?.quiet) trackIntent("yes", intentRef.current);
      setStep("plans");
    };
    // The chat is about to open for a team reply: step aside, unless they are in the middle of paying.
    const close = () => setStep((s) => (s === "pay" ? s : null));
    window.addEventListener(OPEN_NOTES_EVENT, open);
    window.addEventListener(CLOSE_NOTES_EVENT, close);
    return () => {
      window.removeEventListener(OPEN_NOTES_EVENT, open);
      window.removeEventListener(CLOSE_NOTES_EVENT, close);
    };
  }, [siteWide]);

  useEffect(() => {
    if (step !== "plans" || payReady !== null) return;
    fetch("/api/notes-orders/ready")
      .then((r) => r.json())
      .then((d: { ready?: boolean }) => setPayReady(d.ready === true))
      .catch(() => setPayReady(false));
  }, [step, payReady]);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!step) {
      if (d.open) d.close();
      return;
    }
    // While Razorpay's window is open the dialog steps aside (a native modal blocks clicks outside it).
    if (paying) {
      if (d.open) {
        ignoreClose.current = true;
        d.close();
      }
      return;
    }
    if (!d.open) {
      d.showModal();
      // Start focus on the content itself, not on the first control (a ring on the close button looks like a bug).
      bodyRef.current?.focus({ preventScroll: true });
    }
  }, [step, paying]);

  // Close without a word to the team (X, Esc, backdrop, or finishing the form).
  function dismiss() {
    quietFor(SNOOZE_MS);
    setStep(null);
  }

  // Close the dialog right now (not on the next render) so Razorpay's window never opens behind a native modal.
  function setPayingNow(next: boolean) {
    const d = ref.current;
    if (next && d?.open) {
      ignoreClose.current = true;
      d.close();
    }
    setPaying(next);
  }

  // "No": nobody is alerted. Ask for a WhatsApp number instead (the team only hears when a number is left).
  function sayNo() {
    quietFor(SNOOZE_MS);
    setStep("form");
  }

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (ignoreClose.current) {
          ignoreClose.current = false;
          return;
        }
        dismiss();
      }}
      // Click on the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === ref.current && dismiss()}
      aria-labelledby="notes-prompt-title"
      className={DIALOG}
    >
      {step && (
        <div ref={bodyRef} tabIndex={-1} className={`relative outline-none ${step === "form" || step === "thanks" ? "px-5 pb-6 pt-7 sm:px-7 sm:pb-7" : ""}`}>
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label="Close"
            className="absolute right-3.5 top-3.5 flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted transition hover:text-foreground sm:right-4 sm:top-4"
          >
            <X size={14} weight="bold" />
          </button>

          {step === "ask" && (
            <div className="px-6 pb-5 pt-12 text-center sm:px-8 sm:pb-6">
              <span aria-hidden className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#f5f5f7] text-[#0071e3]">
                <BookOpenText size={28} weight="regular" />
              </span>
              <h2 id="notes-prompt-title" className="mt-6 text-[26px] font-semibold leading-[1.08] tracking-[-0.04em] text-[#1d1d1f] sm:text-[32px]">
                <span className="mb-2 block text-[15px] font-medium tracking-normal text-[#6e6e73]">{known ? "Still need" : "Do you need"}</span>
                {NOTES_TAGLINE.first}
                <br />
                <span className="text-[#0071e3]">{NOTES_TAGLINE.second}</span>
              </h2>
              <p className="mx-auto mt-4 max-w-[19rem] text-[16px] leading-[1.35] text-[#6e6e73]">
                {subject ? `For ${subject}, sent to you on WhatsApp.` : "Exam-focused, unit-wise, sent to you on WhatsApp."}
              </p>
              <p className="mt-4 text-[14px] font-medium text-[#1d1d1f]">
                MRQ from ₹49
                <span aria-hidden className="mx-2 text-[#c7c7cc]">
                  |
                </span>
                Notes from ₹99
              </p>
              <a
                href={salesWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                onClick={afterYes}
                className="mt-7 inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-full bg-[#0071e3] px-7 text-[17px] font-semibold tracking-[-0.01em] text-white transition duration-300 ease-[var(--ease-apple)] hover:bg-[#0077ed] active:scale-[0.985]"
              >
                <WhatsappLogo size={20} weight="fill" aria-hidden />
                Yes, chat on WhatsApp
              </a>
              <button
                type="button"
                onClick={sayNo}
                className="mt-1.5 inline-flex h-11 w-full items-center justify-center rounded-full text-[16px] font-medium text-[#0071e3] transition duration-200 hover:bg-[#0071e3]/[0.06] active:bg-[#0071e3]/10"
              >
                Not now
              </button>
            </div>
          )}

          {step === "plans" && (
            <NotesPricing
              onPlan={(p) => {
                setPayPlan(p);
                setStep("pay");
              }}
              onWhatsApp={() => {
                trackIntent("wa", intentRef.current);
                markWhatsAppOpened(); // the chat opens when they come back to this page
                quietFor(YES_QUIET_MS);
                setStep(null);
              }}
            />
          )}

          {step === "pay" && (
            <div className="px-5 pb-6 pt-14 sm:px-7 sm:pb-7">
              <button
                type="button"
                onClick={() => setStep("plans")}
                className="absolute left-3.5 top-3.5 flex h-8 items-center gap-0.5 rounded-full bg-surface-muted pl-2 pr-3 text-[13px] font-medium text-muted transition hover:text-foreground sm:left-4 sm:top-4"
              >
                <CaretLeft size={13} weight="bold" />
                Plans
              </button>
              <ChatPay
                programme={{ slug: CHAT_ORDER.programmeSlug, name: CHAT_ORDER.programme }}
                semester={0}
                plan={payPlan}
                subject={payPlan.endsWith("7") ? null : { slug: CHAT_ORDER.subjectSlug, name: CHAT_ORDER.subject }}
                canBuy={payReady !== false}
                onPayingChange={setPayingNow}
                onClose={() => dismiss()}
                waHref={salesWhatsAppLink()}
              />
            </div>
          )}

          {step === "form" && (
            <>
              <h2 id="notes-prompt-title" className="pr-10 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
                Want them on WhatsApp instead?
              </h2>
              <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">Just leave your number. That is all we need.</p>
              <PhoneOnlyForm source={leadSource} programmeName={course?.name} subjectName={subject} semester={semNumber} onSuccess={() => setStep("thanks")} />
            </>
          )}

          {step === "thanks" && (
            <div className="text-center">
              <span aria-hidden className="mx-auto flex size-14 items-center justify-center rounded-full bg-success text-white">
                <Check size={28} weight="bold" />
              </span>
              <h2 id="notes-prompt-title" className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">Thanks! We&apos;ll message you on WhatsApp.</h2>
              <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">We will ask which subject you need, then send the notes.</p>
              <button type="button" onClick={dismiss} className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-surface-muted px-6 text-[15px] font-medium transition hover:brightness-95">Done</button>
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
