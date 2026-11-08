"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, X } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";
import { itemKey } from "@/lib/paid-notes-pricing";
import { parseLeadSemester, type LeadCourse, type LeadSubject } from "@/lib/note-leads";
import { LeadForm, useKnownLead } from "./lead-form";

// "Said no (or closed it)": leave this visitor alone for the rest of the visit.
const OFF_KEY = "nv_notes_prompt_off";
// /papers: the student just opened a paper. Let it start loading first.
const PAPER_DELAY_MS = 1400;
// PYQ pages reached from Google or a link: let them read before asking.
const LANDING_DELAY_MS = 6000;

function promptOff() {
  try {
    return sessionStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

const SHEET =
  "lead-sheet apple-scope m-0 mt-auto max-h-[calc(100dvh-1rem)] w-full max-w-none overflow-y-auto rounded-t-[28px] bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/35 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-[26rem] sm:rounded-[28px]";
// A compact card that sits over the page without blocking it (not modal, no backdrop): a full-screen
// popup right after arriving from Google risks the mobile "intrusive interstitial" ranking penalty.
const CARD =
  "lead-sheet apple-scope fixed inset-x-3 bottom-3 z-[70] m-0 w-auto max-w-none rounded-[24px] bg-surface p-0 text-foreground shadow-[0_12px_40px_rgb(0_0_0/0.2)] ring-1 ring-black/5 sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-[24rem]";

const TILE = "bg-gradient-to-b from-[#3fa0ff] to-[#0071e3] text-white shadow-[0_8px_20px_rgb(0_113_227/0.35)]";

/**
 * "Need notes for this subject?" — Yes/No first, so people who don't want notes never see a form.
 *
 * - /papers (source "paper-pdf"): a sheet ~1.4 s after a paper opens (`paperId`).
 * - PYQ pages (source "pyq-page"): a small card ~6 s after arriving. Yes opens the form as a sheet.
 *   What the form asks depends on what the page knows: subject (phone only), course (semester, an optional
 *   subject, phone) or nothing (course too).
 *
 * No / the X / Esc: closed and quiet for the rest of the visit. Once a number is left: never again.
 */
export function NotesPrompt({
  source,
  paperId,
  course,
  subject,
  semester,
  subjects,
  courses,
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
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const switching = useRef(false);
  const known = useKnownLead();
  const [step, setStep] = useState<"ask" | "form" | null>(null);
  const [done, setDone] = useState(false);
  const [available, setAvailable] = useState<Set<string> | null>(null);

  const landing = source === "pyq-page";
  const scope = subject && course ? "subject" : course ? "course" : "any";
  const mode = landing && step === "ask" ? "card" : "sheet";
  const courseSlug = course ? (course.slug ?? slugify(course.name)) : "";
  const subjectSlug = subject ? slugify(subject) : "";
  const semNumber = parseLeadSemester(semester);

  useEffect(() => {
    if (!landing && !paperId) return;
    if (known || promptOff()) return;
    const t = setTimeout(() => {
      if (document.visibilityState === "visible") setStep((s) => s ?? "ask");
    }, landing ? LANDING_DELAY_MS : PAPER_DELAY_MS);
    return () => clearTimeout(t);
  }, [landing, paperId, known]);

  // The card is a plain (non-modal) dialog; the form is a modal sheet. Switching means closing and reopening.
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (!step) {
      if (d.open) d.close();
      return;
    }
    if (mode === "sheet") {
      if (d.open && !d.matches(":modal")) {
        switching.current = true;
        d.close();
      }
      if (!d.open) d.showModal();
    } else if (!d.open) {
      // A passive card shouldn't pull focus (show() moves it onto "No, thanks"): give it back.
      const prev = document.activeElement;
      d.show();
      if (prev instanceof HTMLElement && prev !== document.body) prev.focus({ preventScroll: true });
      else if (d.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
    }
  }, [step, mode]);

  // Which of this course's subjects have notes (same cached list /papers uses), to group the subject picker.
  useEffect(() => {
    if (step !== "form" || scope !== "course" || available) return;
    fetch("/api/notes-available")
      .then((r) => r.json())
      .then((d: { items?: string[] }) => setAvailable(new Set(d.items ?? [])))
      .catch(() => setAvailable(new Set()));
  }, [step, scope, available]);

  function dismiss() {
    try {
      sessionStorage.setItem(OFF_KEY, "1");
    } catch {}
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

  const what = subject ?? course?.name ?? "your DU subject";
  const closeBtn = (
    <button
      type="button"
      onClick={dismiss}
      aria-label="Close"
      className={`absolute right-3.5 top-3.5 flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted transition hover:text-foreground ${
        mode === "card" ? "" : "sm:right-4 sm:top-4"
      }`}
    >
      <X size={14} weight="bold" />
    </button>
  );

  return (
    <dialog
      ref={ref}
      onClose={() => {
        if (switching.current) {
          switching.current = false;
          return;
        }
        dismiss();
      }}
      // Click on the dimmed backdrop (the dialog element itself) closes the sheet.
      onClick={(e) => mode === "sheet" && e.target === ref.current && dismiss()}
      aria-labelledby="notes-prompt-title"
      className={mode === "card" ? CARD : SHEET}
    >
      {step === "ask" && mode === "card" && (
        <div className="relative">
          <div className="flex gap-3.5 p-4 pr-12">
            <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-[13px] ${TILE}`}>
              <BookOpenText size={22} weight="fill" />
            </span>
            <div className="min-w-0">
              <h2 id="notes-prompt-title" className="text-[17px] font-semibold leading-snug tracking-[-0.015em]">
                Need notes for {what}?
              </h2>
              <p className="mt-0.5 text-[14px] leading-snug text-muted">Solved answers and exam tips, sent on WhatsApp.</p>
            </div>
          </div>
          <div className="flex gap-2 px-4 pb-4">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-surface-muted px-4 text-[15px] font-medium text-foreground transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.985]"
            >
              No, thanks
            </button>
            <button
              type="button"
              onClick={() => setStep("form")}
              className="inline-flex h-11 flex-1 items-center justify-center rounded-full bg-brand px-4 text-[15px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985]"
            >
              Yes, I need notes
            </button>
          </div>
          {closeBtn}
        </div>
      )}

      {step && mode === "sheet" && (
        <div className="relative px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-7 sm:pt-7">
          <span aria-hidden className="mx-auto mb-4 block h-[5px] w-9 rounded-full bg-border sm:hidden" />
          {closeBtn}

          {step === "ask" ? (
            <div className="text-center">
              <span aria-hidden className={`mx-auto flex size-16 items-center justify-center rounded-[18px] ${TILE}`}>
                <BookOpenText size={32} weight="fill" />
              </span>
              <h2 id="notes-prompt-title" className="mt-5 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
                Need notes for {what}?
              </h2>
              <p className="mx-auto mt-2 max-w-[19rem] text-[15px] leading-snug text-muted">
                Solved answers, the most repeated questions and exam tips, sent to your WhatsApp.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep("form")}
                  className="inline-flex h-[52px] items-center justify-center rounded-full bg-brand px-7 text-[17px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985]"
                >
                  Yes, I need notes
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="inline-flex h-[52px] items-center justify-center rounded-full bg-surface-muted px-7 text-[17px] font-medium text-foreground transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.985]"
                >
                  No, thanks
                </button>
              </div>
            </div>
          ) : (
            <>
              {!done && (
                <>
                  <h2 id="notes-prompt-title" className="text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:pr-8">
                    Where should we send them?
                  </h2>
                  <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">
                    {scope === "subject" ? `${subject} · ${course?.name}` : scope === "course" ? course?.name : "Tell us what you need"}
                  </p>
                </>
              )}
              {scope === "subject" ? (
                <LeadForm
                  courses={[{ slug: courseSlug, name: course!.name }]}
                  initial={{ course: courseSlug, subject: subjectSlug, semester: semNumber }}
                  initialSubjects={[{ slug: subjectSlug, name: subject!, hasNotes: false, semester: semNumber }]}
                  source={source}
                  variant="inline"
                  submitLabel="Send me the notes"
                  stacked
                  onSuccess={() => setDone(true)}
                />
              ) : (
                <LeadForm
                  courses={scope === "course" ? [{ slug: courseSlug, name: course!.name }] : (courses ?? [])}
                  initial={scope === "course" ? { course: courseSlug, semester: semNumber } : undefined}
                  initialSubjects={scope === "course" ? subjectChoices : undefined}
                  source={source}
                  subjectRequired={false}
                  submitLabel="Send me the notes"
                  onSuccess={() => setDone(true)}
                />
              )}
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
