"use client";

import { useActionState, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { CaretUpDown, Check, WhatsappLogo } from "@phosphor-icons/react";
import { submitNoteLeadAction, type LeadResult } from "@/lib/note-lead-actions";
import {
  ANY_SUBJECT,
  LEAD_PHONE_KEY,
  LEAD_SEMESTERS,
  LEAD_STORAGE_KEY,
  type LeadCourse,
  type LeadSource,
  type LeadSubject,
} from "@/lib/note-leads";

const HELP_WHATSAPP = "919376180015";

// ---- "has this browser already left a number?" ----------------------------
// localStorage + an event so the modal, the inline card and the list links on
// one page all agree the moment a form is submitted.

function subscribe(cb: () => void) {
  window.addEventListener("nv-lead", cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener("nv-lead", cb);
    window.removeEventListener("storage", cb);
  };
}
function readKnown() {
  try {
    return localStorage.getItem(LEAD_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}
export function useKnownLead() {
  return useSyncExternalStore(subscribe, readKnown, () => false);
}
function rememberLead(phone: string) {
  try {
    localStorage.setItem(LEAD_STORAGE_KEY, "1");
    if (phone) localStorage.setItem(LEAD_PHONE_KEY, phone);
  } catch {}
  window.dispatchEvent(new Event("nv-lead"));
}
function savedPhone() {
  try {
    return localStorage.getItem(LEAD_PHONE_KEY) ?? "";
  } catch {
    return "";
  }
}

// ---- form -----------------------------------------------------------------

const subjectsCache = new Map<string, LeadSubject[]>();

// Apple-style: one grouped list of fields (like iOS Settings) on a soft grey
// surface, hairline dividers, a blue focus ring inside the row, pill button.
const group = "overflow-hidden rounded-[18px] bg-surface-muted divide-y divide-border/70";
const row =
  "relative px-4 py-2.5 transition-colors duration-200 focus-within:bg-surface focus-within:ring-2 focus-within:ring-inset focus-within:ring-brand";
const rowLabel = "block text-[12px] font-medium text-muted";
const control =
  "mt-0.5 block h-7 w-full appearance-none bg-transparent text-[17px] leading-7 outline-none disabled:text-muted";
const pill =
  "inline-flex h-[52px] items-center justify-center rounded-full bg-brand px-7 text-[17px] font-semibold text-brand-foreground transition duration-300 ease-[var(--ease-apple)] hover:bg-brand-hover active:scale-[0.985] disabled:opacity-60";

function Select({
  id,
  label,
  children,
  ...rest
}: { id: string; label: string; children: React.ReactNode } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={row}>
      <label htmlFor={id} className={rowLabel}>{label}</label>
      <select id={id} {...rest} className={`${control} pr-7 ${rest.value ? "text-foreground" : "text-muted"}`}>
        {children}
      </select>
      <CaretUpDown size={16} className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-muted" />
    </div>
  );
}

export function LeadForm({
  courses,
  initial,
  initialSubjects,
  source,
  variant = "full",
  submitLabel = "Get notes on WhatsApp",
  stacked = false,
  subjectRequired = true,
  showSuccess = true,
  onSuccess,
}: {
  courses: LeadCourse[];
  initial?: { course?: string; subject?: string; semester?: number | null };
  /** Subjects of `initial.course`, when the page already has them (skips a fetch). */
  initialSubjects?: LeadSubject[];
  source: LeadSource;
  /** "inline" = course and subject are fixed by the page; only semester (if unknown) and phone show. */
  variant?: "full" | "inline";
  submitLabel?: string;
  /** Inline variant: keep the button under the fields even on wide screens (narrow sheets). */
  stacked?: boolean;
  /** Full variant: false lets a student ask for a whole course without naming the subject. */
  subjectRequired?: boolean;
  /** false: render nothing once saved, because the parent shows its own next step (via onSuccess). */
  showSuccess?: boolean;
  onSuccess?: (r: LeadResult) => void;
}) {
  const uid = useId();
  const phoneRef = useRef<HTMLInputElement>(null);
  const lastPhone = useRef("");
  const [course, setCourse] = useState(initial?.course ?? "");
  const [subject, setSubject] = useState(initial?.subject ?? "");
  const [semester, setSemester] = useState(initial?.semester ? String(initial.semester) : "");
  const [fetched, setFetched] = useState<Record<string, LeadSubject[]>>({});
  const [state, formAction, pending] = useActionState<LeadResult, FormData>(submitNoteLeadAction, {});

  const list =
    initialSubjects && course === initial?.course ? initialSubjects : (subjectsCache.get(course) ?? fetched[course]);

  useEffect(() => {
    if (!course || list) return;
    fetch(`/api/notes-subjects?p=${encodeURIComponent(course)}`)
      .then((r) => r.json())
      .then((d: { subjects?: LeadSubject[] }) => {
        const subjects = d.subjects ?? [];
        subjectsCache.set(course, subjects);
        setFetched((f) => ({ ...f, [course]: subjects }));
      })
      .catch(() => setFetched((f) => ({ ...f, [course]: [] })));
  }, [course, list]);

  // Prefill the number this browser used before (set on the DOM node, not state, so SSR output stays identical).
  useEffect(() => {
    const el = phoneRef.current;
    if (el && !el.value) el.value = savedPhone();
  }, []);

  useEffect(() => {
    if (!state.ok) return;
    rememberLead(lastPhone.current);
    onSuccess?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const onSubmit = () => {
    lastPhone.current = phoneRef.current?.value ?? "";
  };

  if (state.ok) {
    if (!showSuccess) return null;
    const anySubject = state.subject === ANY_SUBJECT;
    const ready = state.hasNotes;
    const text = encodeURIComponent(`Hi! I need ${anySubject ? "" : (state.subject ?? "")} notes from DU PYQ Online.`.replace("  ", " "));
    return (
      <div role="status" className="py-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success text-white">
          <Check size={28} weight="bold" />
        </span>
        <h3 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">
          {ready ? "Thanks! We'll send your notes on WhatsApp." : anySubject ? "Thanks! We'll message you on WhatsApp." : "Got it. We'll message you."}
        </h3>
        <p className="mx-auto mt-2 max-w-sm text-[15px] leading-relaxed text-muted">
          {anySubject
            ? "We'll ask which subject you need, then send the notes, solved answers and exam tips."
            : ready
            ? `We'll message you shortly with the ${state.subject ?? ""} notes, solved answers and exam tips.`.replace("  ", " ")
            : `${state.subject ?? "These"} notes aren't published yet. We'll WhatsApp you the moment they're ready.`}
        </p>
        <a
          href={`https://wa.me/${HELP_WHATSAPP}?text=${text}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-5 text-[15px] font-semibold text-white transition duration-300 ease-[var(--ease-apple)] hover:brightness-95 active:scale-[0.98]"
        >
          <WhatsappLogo size={18} weight="fill" />
          Chat with us now
        </a>
      </div>
    );
  }

  const fixed = variant === "inline";
  const ready = list?.filter((s) => s.hasNotes) ?? [];
  const soon = list?.filter((s) => !s.hasNotes) ?? [];

  const hidden = (
    <>
      <input type="hidden" name="source" value={source} />
      {/* Honeypot: invisible to people, bots fill it. */}
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] size-px opacity-0" />
    </>
  );
  const errorLine = state.error && (
    <p role="alert" className="px-1 text-[14px] text-red-600 dark:text-red-400">{state.error}</p>
  );

  const phoneInput = (
    <div className="flex items-center gap-2">
      <span className="text-[17px] leading-7 text-muted">+91</span>
      <input
        ref={phoneRef}
        id={`${uid}-phone`}
        name="phone"
        type="tel"
        inputMode="numeric"
        autoComplete="tel-national"
        required
        maxLength={16}
        placeholder="98765 43210"
        className="h-7 min-w-0 flex-1 bg-transparent text-[17px] leading-7 text-foreground outline-none placeholder:text-muted/60"
      />
    </div>
  );

  // Course and subject come from the page: just (semester if unknown) + number.
  if (fixed) {
    return (
      <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
        {hidden}
        <input type="hidden" name="programme" value={course} />
        <input type="hidden" name="subject" value={subject} />
        {/* Printed names, for /papers subjects that aren't a notes subject. */}
        <input type="hidden" name="programmeName" value={courses.find((c) => c.slug === course)?.name ?? ""} />
        <input type="hidden" name="subjectName" value={list?.find((s) => s.slug === subject)?.name ?? ""} />
        <div className={`flex flex-col gap-3 ${stacked ? "" : "sm:flex-row sm:items-stretch"}`}>
          <div className={`${group.replace("bg-surface-muted", "bg-surface")} flex-1`}>
            {!initial?.semester ? (
              <Select id={`${uid}-sem`} label="Semester" name="semester" required value={semester} onChange={(e) => setSemester(e.target.value)}>
                <option value="" disabled>Select semester</option>
                {LEAD_SEMESTERS.map((n) => (
                  <option key={n} value={n}>Semester {n}</option>
                ))}
              </Select>
            ) : (
              <input type="hidden" name="semester" value={semester} />
            )}
            <div className={row}>
              <label htmlFor={`${uid}-phone`} className={rowLabel}>WhatsApp number</label>
              {phoneInput}
            </div>
          </div>
          <button type="submit" disabled={pending} className={`${pill} ${stacked ? "" : "sm:self-stretch"}`}>
            {pending ? "Please wait…" : submitLabel}
          </button>
        </div>
        {errorLine}
        <p className="text-[13px] text-muted">We&apos;ll only WhatsApp you about these notes.</p>
      </form>
    );
  }

  return (
    <form action={formAction} onSubmit={onSubmit} className="flex flex-col gap-3">
      {hidden}
      {/* Printed names, for PYQ-page courses/subjects that aren't a notes subject. */}
      <input type="hidden" name="programmeName" value={courses.find((c) => c.slug === course)?.name ?? ""} />
      <input type="hidden" name="subjectName" value={list?.find((s) => s.slug === subject)?.name ?? ""} />
      <div className={group}>
        <Select
          id={`${uid}-course`}
          label="Course"
          name="programme"
          required
          value={course}
          onChange={(e) => {
            setCourse(e.target.value);
            setSubject("");
          }}
        >
          <option value="" disabled>Select your course</option>
          {courses.map((c) => (
            <option key={c.slug} value={c.slug}>{c.name}</option>
          ))}
        </Select>
        <Select id={`${uid}-sem`} label="Semester" name="semester" required value={semester} onChange={(e) => setSemester(e.target.value)}>
          <option value="" disabled>Select semester</option>
          {LEAD_SEMESTERS.map((n) => (
            <option key={n} value={n}>Semester {n}</option>
          ))}
        </Select>
        <Select
          id={`${uid}-subject`}
          label="Subject"
          name="subject"
          required={subjectRequired}
          disabled={!course || (subjectRequired && !list)}
          value={subject}
          onChange={(e) => {
            setSubject(e.target.value);
            const known = list?.find((s) => s.slug === e.target.value)?.semester;
            if (known) setSemester(String(known));
          }}
        >
          <option value="" disabled={subjectRequired}>
            {!course
              ? "Select a course first"
              : !subjectRequired
              ? list
                ? "Not sure yet (optional)"
                : "Loading subjects…"
              : !list
              ? "Loading subjects…"
              : "Select your subject"}
          </option>
          {ready.length > 0 && (
            <optgroup label="Notes ready">
              {ready.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </optgroup>
          )}
          {soon.length > 0 && (
            <optgroup label="Coming soon (we'll WhatsApp you)">
              {soon.map((s) => (
                <option key={s.slug} value={s.slug}>{s.name}</option>
              ))}
            </optgroup>
          )}
        </Select>
        <div className={row}>
          <label htmlFor={`${uid}-phone`} className={rowLabel}>WhatsApp number</label>
          {phoneInput}
        </div>
      </div>

      {errorLine}
      <button type="submit" disabled={pending} className={`${pill} w-full`}>
        {pending ? "Please wait…" : submitLabel}
      </button>
      <p className="text-center text-[13px] text-muted">We&apos;ll only WhatsApp you about these notes.</p>
    </form>
  );
}
