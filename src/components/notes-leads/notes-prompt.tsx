"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, Check, X } from "@phosphor-icons/react";
import { notesWhatsAppLink, parseLeadSemester } from "@/lib/note-leads";
import { OPEN_NOTES_EVENT } from "@/lib/notes-promo";
import { markWhatsAppOpened, trackIntent } from "@/lib/lead-intent";
import { PhoneOnlyForm, useKnownLead } from "./lead-form";

// Value = the time until which the pop-up stays quiet (sessionStorage, so it ends with the visit).
const OFF_KEY = "nv_notes_prompt_off";
// "No" snoozes the pop-up for a few minutes only, so the next course / semester / subject they pick asks again.
const SNOOZE_MS = 3 * 60 * 1000;
// "Yes" opened WhatsApp for them: asking again on the next pick would only annoy.
const YES_QUIET_MS = 12 * 60 * 60 * 1000;
// /papers: the student just opened a paper. Let it start loading first.
const PAPER_DELAY_MS = 1400;
// PYQ pages reached from Google or a link: a short beat (asking later lost people who leave within seconds).
const LANDING_DELAY_MS = 2000;

// Someone who already left a number is the likeliest buyer, so they are asked again, but at most once a day.
const KNOWN_KEY = "nv_notes_prompt_known_at";
const KNOWN_COOLDOWN_MS = 24 * 60 * 60 * 1000;

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
  "lead-pop apple-scope m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[26rem] overflow-y-auto rounded-[28px] bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/40 backdrop:backdrop-blur-sm";

const TILE = "bg-gradient-to-b from-[#3fa0ff] to-[#0071e3] text-white shadow-[0_8px_20px_rgb(0_113_227/0.35)]";

/**
 * "Need notes for this subject?" — Yes/No first, so people who don't want notes never see a form. Yes opens the
 * form, and once it is saved the pop-up offers to buy the notes (one subject or the whole semester).
 *
 * - /papers (source "paper-pdf"): ~1.4 s after a paper opens (`paperId`).
 * - PYQ pages (source "pyq-page"): ~2 s after arriving.
 *   What the form asks depends on what the page knows: subject (phone only), course (semester, an optional
 *   subject, phone) or nothing (course too).
 *
 * Yes: WhatsApp opens with the message already written and the owner is alerted (💎); when they come back to the page
 * the on-site chat (PingChat) opens by itself (see chat-now-fab). No: nobody is alerted; the pop-up asks for their
 * WhatsApp number instead (the lead form). X / Esc / the backdrop just close it. Someone who already left a number is
 * asked again (they are the likeliest buyers), at most once a day.
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
  source: "paper-pdf" | "pyq-page";
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
  const [step, setStep] = useState<"ask" | "form" | "thanks" | null>(null);

  const landing = source === "pyq-page";
  const semNumber = parseLeadSemester(semester);
  const what = subject ?? course?.name ?? "your DU subject";
  // What the funnel beacons and the chat's first message say about this visitor's request (never personal data).
  const intentCtx = { source, programme: course?.name, subject, semester: semNumber };
  const intentRef = useRef(intentCtx);
  useEffect(() => {
    intentRef.current = intentCtx; // the window-level promo listener below reads the latest values
  });
  const waHref = notesWhatsAppLink({ subject, programme: course?.name, semester: semNumber });

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
  }, [auto, landing, paperId, known]);

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

  // Said Yes (the pop-up button or a promo card): the owner is alerted once (💎), WhatsApp opens with the message
  // already written, and the chat opens when they come back to this page.
  const waRef = useRef(waHref);
  useEffect(() => {
    waRef.current = waHref;
  });
  function afterYes() {
    trackIntent("yes", intentRef.current);
    markWhatsAppOpened();
    quietFor(YES_QUIET_MS);
    setStep(null);
  }
  useEffect(() => {
    // Promo card tap: window.open still runs inside the tap, so no pop-up blocker objects.
    const open = () => {
      window.open(waRef.current, "_blank", "noopener,noreferrer");
      afterYes();
    };
    window.addEventListener(OPEN_NOTES_EVENT, open);
    return () => window.removeEventListener(OPEN_NOTES_EVENT, open);
  }, []);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!step) {
      if (d.open) d.close();
      return;
    }
    if (!d.open) {
      d.showModal();
      // Start focus on the content itself, not on the first control (a ring on the close button looks like a bug).
      bodyRef.current?.focus({ preventScroll: true });
    }
  }, [step]);

  // Close without a word to the team (X, Esc, backdrop, or finishing the form).
  function dismiss() {
    quietFor(SNOOZE_MS);
    setStep(null);
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
        dismiss();
      }}
      // Click on the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === ref.current && dismiss()}
      aria-labelledby="notes-prompt-title"
      className={DIALOG}
    >
      {step && (
        <div ref={bodyRef} tabIndex={-1} className="relative px-5 pb-6 pt-7 outline-none sm:px-7 sm:pb-7">
          <button
            type="button"
            onClick={() => dismiss()}
            aria-label="Close"
            className="absolute right-3.5 top-3.5 flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted transition hover:text-foreground sm:right-4 sm:top-4"
          >
            <X size={14} weight="bold" />
          </button>

          {step === "ask" && (
            <div className="text-center">
              <span aria-hidden className={`mx-auto flex size-16 items-center justify-center rounded-[18px] ${TILE}`}>
                <BookOpenText size={32} weight="fill" />
              </span>
              <h2 id="notes-prompt-title" className="mt-5 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
                {known ? "Still need" : "Need"} notes for {what}?
              </h2>
              <p className="mx-auto mt-2 max-w-[19rem] text-[15px] leading-snug text-muted">
                Solved answers, the most repeated questions and exam tips. Tap Yes and we will message you on WhatsApp.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <a
                  href={waHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={afterYes}
                  className="inline-flex h-[52px] items-center justify-center rounded-full bg-brand px-7 text-[17px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985]"
                >
                  Yes, get the notes
                </a>
                <button
                  type="button"
                  onClick={sayNo}
                  className="inline-flex h-[52px] items-center justify-center rounded-full bg-surface-muted px-7 text-[17px] font-medium text-foreground transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.985]"
                >
                  No, thanks
                </button>
              </div>
            </div>
          )}

          {step === "form" && (
            <>
              <h2 id="notes-prompt-title" className="pr-10 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
                Want them on WhatsApp instead?
              </h2>
              <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">Just leave your number. That is all we need.</p>
              <PhoneOnlyForm source={source} programmeName={course?.name} subjectName={subject} semester={semNumber} onSuccess={() => setStep("thanks")} />
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
