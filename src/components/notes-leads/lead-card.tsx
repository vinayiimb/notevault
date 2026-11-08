"use client";

import { useState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import type { LeadCourse, LeadSubject } from "@/lib/note-leads";
import { LeadForm, useKnownLead } from "./lead-form";

// Slim card above a note for visitors who land straight on it (Google, a
// shared link). Course and subject are already known, so it only asks for
// the number (and semester when the note doesn't carry one). Gone for good
// once this browser has left a number.
export function NoteLeadCard({ course, subject }: { course: LeadCourse; subject: LeadSubject }) {
  const known = useKnownLead();
  const [done, setDone] = useState(false);
  if (known && !done) return null;

  return (
    <aside className="mt-6 rounded-[22px] bg-surface-muted p-5 sm:p-6">
      {!done && (
        <div className="mb-4 flex items-start gap-3.5">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-[#25D366] text-white">
            <WhatsappLogo size={24} weight="fill" />
          </span>
          <div>
            <h2 className="text-[19px] font-semibold leading-snug tracking-[-0.02em]">
              Get the full {subject.name} notes on WhatsApp
            </h2>
            <p className="mt-0.5 text-[15px] leading-snug text-muted">
              Solved answers, exam tips and the most repeated questions, sent to your phone.
            </p>
          </div>
        </div>
      )}
      <LeadForm
        courses={[course]}
        initial={{ course: course.slug, subject: subject.slug, semester: subject.semester }}
        initialSubjects={[subject]}
        source="note-page"
        variant="inline"
        submitLabel="Send me the notes"
        onSuccess={() => setDone(true)}
      />
    </aside>
  );
}
