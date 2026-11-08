"use client";

import { useEffect, useRef, useState } from "react";
import { BookOpenText, X } from "@phosphor-icons/react";
import { slugify } from "@/lib/utils";
import { LeadForm, useKnownLead } from "./lead-form";

// "Said no (or closed it)": leave this visitor alone for the rest of the visit.
const OFF_KEY = "nv_notes_prompt_off";
// Let the paper start loading first; a sheet over a blank frame feels like an ad.
const DELAY_MS = 1400;

function promptOff() {
  try {
    return sessionStorage.getItem(OFF_KEY) === "1";
  } catch {
    return false;
  }
}

// Shown when a student opens a free previous-year paper on /papers:
// "Need notes for this subject?" No -> closes, nothing else is asked.
// Yes -> the lead form (course, subject and semester are already known from
// what they picked, so it only asks for a WhatsApp number).
export function PaperNotesPrompt({
  paperId,
  course,
  subject,
  semester,
}: {
  paperId: string | null;
  course: string;
  subject: string;
  semester: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const known = useKnownLead();
  const [step, setStep] = useState<"ask" | "form" | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!paperId || known || promptOff()) return;
    const t = setTimeout(() => setStep((s) => s ?? "ask"), DELAY_MS);
    return () => clearTimeout(t);
  }, [paperId, known]);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (step && !dialog.open) dialog.showModal();
    if (!step && dialog.open) dialog.close();
  }, [step]);

  function dismiss() {
    try {
      sessionStorage.setItem(OFF_KEY, "1");
    } catch {}
    setStep(null);
  }

  const courseSlug = slugify(course);
  const subjectSlug = slugify(subject);
  const sem = Number(semester);
  const semNumber = Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null;

  return (
    <dialog
      ref={ref}
      onClose={dismiss}
      // Click on the dimmed backdrop (the dialog element itself) closes it.
      onClick={(e) => e.target === ref.current && dismiss()}
      aria-labelledby="paper-notes-title"
      className="lead-sheet apple-scope m-0 mt-auto w-full max-w-none rounded-t-[28px] bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/35 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-[26rem] sm:rounded-[28px]"
    >
      {step && (
        <div className="relative px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-7 sm:pt-7">
          <span aria-hidden className="mx-auto mb-4 block h-[5px] w-9 rounded-full bg-border sm:hidden" />
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted transition hover:text-foreground"
          >
            <X size={14} weight="bold" />
          </button>

          {step === "ask" ? (
            <div className="text-center">
              <span
                aria-hidden
                className="mx-auto flex size-16 items-center justify-center rounded-[18px] bg-gradient-to-b from-[#3fa0ff] to-[#0071e3] text-white shadow-[0_8px_20px_rgb(0_113_227/0.35)]"
              >
                <BookOpenText size={32} weight="fill" />
              </span>
              <h2 id="paper-notes-title" className="mt-5 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
                Need notes for {subject}?
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
                  <h2 id="paper-notes-title" className="text-[24px] font-semibold leading-tight tracking-[-0.025em] sm:pr-8">
                    Where should we send them?
                  </h2>
                  <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">
                    {subject} · {course}
                  </p>
                </>
              )}
              <LeadForm
                courses={[{ slug: courseSlug, name: course }]}
                initial={{ course: courseSlug, subject: subjectSlug, semester: semNumber }}
                initialSubjects={[{ slug: subjectSlug, name: subject, hasNotes: false, semester: semNumber }]}
                source="paper-pdf"
                variant="inline"
                submitLabel="Send me the notes"
                stacked
                onSuccess={() => setDone(true)}
              />
            </>
          )}
        </div>
      )}
    </dialog>
  );
}
