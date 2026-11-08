"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { X } from "@phosphor-icons/react";
import type { LeadCourse, LeadSubject } from "@/lib/note-leads";
import { LeadForm } from "./lead-form";

const OpenGate = createContext<((subjectSlug: string) => void) | null>(null);

// Wraps a programme's subject list. Tapping a subject opens one shared sheet
// asking for semester + number (course and subject are already known from the
// row). Nothing is opened for them: the notes are sent on WhatsApp.
export function LeadGateProvider({
  course,
  subjects,
  children,
}: {
  course: LeadCourse;
  subjects: LeadSubject[];
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [target, setTarget] = useState<LeadSubject | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (target && !dialog.open) dialog.showModal();
    if (!target && dialog.open) dialog.close();
  }, [target]);

  const open = (slug: string) => setTarget(subjects.find((s) => s.slug === slug) ?? null);

  return (
    <OpenGate.Provider value={open}>
      {children}
      <dialog
        ref={ref}
        onClose={() => setTarget(null)}
        // Click on the dimmed backdrop (the dialog element itself) closes it.
        onClick={(e) => e.target === ref.current && setTarget(null)}
        aria-labelledby="lead-gate-title"
        className="lead-sheet m-0 mt-auto w-full max-w-none rounded-t-[28px] bg-surface p-0 text-foreground shadow-2xl backdrop:bg-black/35 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-[26rem] sm:rounded-[28px]"
      >
        {target && (
          <div className="relative px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-3 sm:px-7 sm:pb-7 sm:pt-7">
            <span aria-hidden className="mx-auto mb-4 block h-[5px] w-9 rounded-full bg-border sm:hidden" />
            <button
              type="button"
              onClick={() => setTarget(null)}
              aria-label="Close"
              className="absolute right-4 top-4 flex size-8 items-center justify-center rounded-full bg-surface-muted text-muted transition hover:text-foreground sm:top-5"
            >
              <X size={14} weight="bold" />
            </button>
            <h2 id="lead-gate-title" className="pr-10 text-[24px] font-semibold leading-tight tracking-[-0.025em]">
              Get these notes on WhatsApp
            </h2>
            <p className="mb-5 mt-1.5 text-[15px] leading-snug text-muted">
              {target.name} · {course.name}
            </p>
            <LeadForm
              key={target.slug}
              courses={[course]}
              initial={{ course: course.slug, subject: target.slug, semester: target.semester }}
              initialSubjects={subjects}
              source="notes-list"
              submitLabel={target.hasNotes ? "Send me the notes" : "Notify me"}
            />
          </div>
        )}
      </dialog>
    </OpenGate.Provider>
  );
}

// A real <a href> so crawlers still find the note page; for people it always
// opens the sheet instead of the page.
export function LeadGateLink({
  href,
  subjectSlug,
  className,
  children,
}: {
  href: string;
  subjectSlug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = useContext(OpenGate);
  return (
    <Link
      href={href}
      className={className}
      onClick={(e) => {
        if (!open) return;
        e.preventDefault();
        open(subjectSlug);
      }}
    >
      {children}
    </Link>
  );
}

// "Coming soon" subject: always opens the sheet, since there is no note to go to
// and the request itself is the lead.
export function LeadGateButton({
  subjectSlug,
  className,
  children,
}: {
  subjectSlug: string;
  className?: string;
  children: React.ReactNode;
}) {
  const open = useContext(OpenGate);
  return (
    <button type="button" className={className} onClick={() => open?.(subjectSlug)}>
      {children}
    </button>
  );
}
