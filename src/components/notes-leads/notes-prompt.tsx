"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, X } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";
import { itemKey } from "@/lib/paid-notes-pricing";
import type { LeadResult } from "@/lib/note-lead-actions";
import { notesWhatsAppLink, parseLeadSemester, type LeadCourse, type LeadSubject } from "@/lib/note-leads";
import { OPEN_NOTES_EVENT } from "@/lib/notes-promo";
import { chatLink } from "@/lib/chat-link";
import { CHAT_NUDGE_EVENT, markWhatsAppOpened, trackIntent } from "@/lib/lead-intent";
import { LeadForm, useKnownLead } from "./lead-form";
import { NotesPurchase } from "./notes-purchase";

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
 * Yes: WhatsApp opens with a message already written (subject, course, semester, 💎). No / the X / Esc / the
 * backdrop: the on-site chat opens instead, greeting with ⭐ (the pop-up stays quiet for a few minutes). Someone who
 * already left a number is asked again (they are the likeliest buyers), at most once a day.
 */
export function NotesPrompt({
  source,
  paperId,
  course,
  subject,
  semester,
  subjects,
  courses,
  auto = true,
  pickKey,
}: {
  source: "paper-pdf" | "pyq-page";
  /** /papers browser only: the paper that is open. The prompt waits for one. */
  paperId?: string | null;
  course?: { name: string; slug?: string };
  subject?: string;
  semester?: string | number | null;
  /** Course known, subject not: the subjects (as printed on the papers) to choose from. */
  subjects?: string[];
  /** Nothing known: the courses to choose from. */
  courses?: LeadCourse[];
  /** false: never pops up by itself; it only opens when a promo card is tapped. */
  auto?: boolean;
  /** /papers: changes whenever the student picks a course, semester or subject. Each pick asks at once (no delay). */
  pickKey?: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const ignoreClose = useRef(false);
  const known = useKnownLead();
  const [step, setStep] = useState<"ask" | "form" | "buy" | null>(null);
  const [result, setResult] = useState<LeadResult | null>(null);
  const [paying, setPaying] = useState(false);
  const [available, setAvailable] = useState<Set<string> | null>(null);

  const landing = source === "pyq-page";
  const scope = subject && course ? "subject" : course ? "course" : "any";
  const courseSlug = course ? (course.slug ?? slugify(course.name)) : "";
  const subjectSlug = subject ? slugify(subject) : "";
  const semNumber = parseLeadSemester(semester);
  const what = subject ?? course?.name ?? "your DU subject";
  // What the funnel beacons and the chat's first message say about this visitor's request (never personal data).
  const intentCtx = { source, programme: course?.name, subject, semester: semNumber };
  const intentRef = useRef(intentCtx);
  useEffect(() => {
    intentRef.current = intentCtx; // the window-level promo listener below reads the latest values
  });
  const waHref = notesWhatsAppLink({ subject, programme: course?.name, semester: semNumber });
  const chatHref = chatLink(`Hi! I need notes for ${what}${subject && course ? ` (${course.name})` : ""}${semNumber ? `, Semester ${semNumber}` : ""}`);

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

  // A promo card ("Get the notes") was tapped: that is a Yes. WhatsApp opens with the message already written
  // (still inside the tap, so no pop-up blocker objects), and the team is told.
  const waRef = useRef(waHref);
  useEffect(() => {
    waRef.current = waHref;
  });
  useEffect(() => {
    const open = () => {
      trackIntent("yes", intentRef.current);
      window.open(waRef.current, "_blank", "noopener,noreferrer");
      markWhatsAppOpened();
      quietFor(YES_QUIET_MS);
      setStep(null);
    };
    window.addEventListener(OPEN_NOTES_EVENT, open);
    return () => window.removeEventListener(OPEN_NOTES_EVENT, open);
  }, []);

  // While Razorpay's window is open the dialog steps aside (a native modal blocks clicks outside it).
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!step) {
      if (d.open) d.close();
      return;
    }
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

  // Which of this course's subjects have notes (same cached list /papers uses), to group the subject picker.
  useEffect(() => {
    if (step !== "form" || scope !== "course" || available) return;
    fetch("/api/notes-available")
      .then((r) => r.json())
      .then((d: { items?: string[] }) => setAvailable(new Set(d.items ?? [])))
      .catch(() => setAvailable(new Set()));
  }, [step, scope, available]);

  // `nudge`: they said No (or closed it) before leaving a number, so the chat opens by itself with a ⭐ greeting.
  function dismiss(nudge = true) {
    quietFor(SNOOZE_MS);
    if (nudge && (step === "ask" || step === "form")) {
      window.dispatchEvent(new CustomEvent(CHAT_NUDGE_EVENT, { detail: { href: chatHref, what, star: true, ...intentRef.current } }));
    }
    setStep(null);
  }

  const subjectChoices: LeadSubject[] = [
    ...new Map(
      (subjects ?? []).map((name) => [
        slugify(name),
        { slug: slugify(name), name, hasNotes: !!available?.has(itemKey(courseSlug, slugify(name))), semester: semNumber },
      ]),
    ).values(),
  ];

  // Close the dialog right now (not on the next render) so Razorpay's window never opens behind a native modal.
  function setPayingNow(next: boolean) {
    const d = ref.current;
    if (next && d?.open) {
      ignoreClose.current = true;
      d.close();
    }
    setPaying(next);
  }

  const onSuccess = (r: LeadResult) => {
    setResult(r);
    setStep("buy");
  };

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
                  onClick={() => {
                    trackIntent("yes", intentCtx); // tells the team now, and puts them in the chat inbox with a 💎 line
                    markWhatsAppOpened(); // the chat opens when they come back to this page
                    quietFor(YES_QUIET_MS);
                    setStep(null);
                  }}
                  className="inline-flex h-[52px] items-center justify-center rounded-full bg-brand px-7 text-[17px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985]"
                >
                  Yes, get the notes
                </a>
                <button
                  type="button"
                  onClick={() => dismiss()}
                  className="inline-flex h-[52px] items-center justify-center rounded-full bg-surface-muted px-7 text-[17px] font-medium text-foreground transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.985]"
                >
                  Not now
                </button>
              </div>
            </div>
          )}

          {step === "form" && (
            <>
              <h2 id="notes-prompt-title" className="pr-10 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
                Where should we send them?
              </h2>
              <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">
                {scope === "subject" ? `${subject} · ${course?.name}` : scope === "course" ? course?.name : "Tell us what you need"}
              </p>
              {scope === "subject" ? (
                <LeadForm
                  courses={[{ slug: courseSlug, name: course!.name }]}
                  initial={{ course: courseSlug, subject: subjectSlug, semester: semNumber }}
                  initialSubjects={[{ slug: subjectSlug, name: subject!, hasNotes: false, semester: semNumber }]}
                  source={source}
                  variant="inline"
                  submitLabel="Continue"
                  stacked
                  showSuccess={false}
                  onSuccess={onSuccess}
                />
              ) : (
                <LeadForm
                  courses={scope === "course" ? [{ slug: courseSlug, name: course!.name }] : (courses ?? [])}
                  initial={scope === "course" ? { course: courseSlug, semester: semNumber } : undefined}
                  initialSubjects={scope === "course" ? subjectChoices : undefined}
                  source={source}
                  subjectRequired={false}
                  submitLabel="Continue"
                  showSuccess={false}
                  onSuccess={onSuccess}
                />
              )}
            </>
          )}

          {step === "buy" && result && <NotesPurchase result={result} intent={intentCtx} onPayingChange={setPayingNow} onClose={() => dismiss(false)} />}
        </div>
      )}
    </dialog>
  );
}
