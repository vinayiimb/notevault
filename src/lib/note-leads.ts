import { normalizePhone } from "@/lib/paid-notes-pricing";

// Shared by the public lead form (client) and the lead actions/admin page
// (server), so it must stay free of server-only imports.

export const LEAD_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const LEAD_SOURCES = ["notes-hub", "notes-list", "note-page", "paper-pdf", "pyq-page"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "DROPPED"] as const;
export type LeadStatusName = (typeof LEAD_STATUSES)[number];

/** Set once a browser has left a number (hides the inline card on note pages). */
export const LEAD_STORAGE_KEY = "nv_lead";
/** The number they typed, so asking for another subject is one tap. Stays on their device. */
export const LEAD_PHONE_KEY = "nv_lead_phone";

/** A course-level ask ("I need notes for this course", subject not chosen yet). */
export const ANY_SUBJECT = "Any subject";
export const ANY_SUBJECT_SLUG = "any";

/** Leads that start on a PYQ page, where course/subject names are the ones printed on the papers. */
export function isPaperSource(source: LeadSource) {
  return source === "paper-pdf" || source === "pyq-page";
}

export type LeadCourse = { slug: string; name: string };
export type LeadSubject = { slug: string; name: string; hasNotes: boolean; semester: number | null };

export function parseLeadSemester(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

/** The one semester a page is about ("1", 3, ["2"]), or null when it has none or several. */
export function singleSemester(list: readonly (string | number | null | undefined)[] | null | undefined): number | null {
  const found = new Set<number>();
  for (const v of list ?? []) {
    const n = parseLeadSemester(v);
    if (n !== null) found.add(n);
  }
  return found.size === 1 ? [...found][0] : null;
}

export function parseLeadSource(raw: unknown): LeadSource {
  return LEAD_SOURCES.find((s) => s === raw) ?? "notes-hub";
}

/** 10-digit Indian mobile typed or pasted in any format -> 91XXXXXXXXXX, or null. */
export const parseLeadPhone = normalizePhone;

/** 919876543210 -> "+91 98765 43210" */
export function formatLeadPhone(phone: string) {
  const m = /^91(\d{5})(\d{5})$/.exec(phone);
  return m ? `+91 ${m[1]} ${m[2]}` : `+${phone}`;
}

/** First WhatsApp message the admin sends, pre-filled from what the student asked for. */
export function leadWhatsAppText(l: { subject: string; programme: string; semester: number | null; hasNotes: boolean }) {
  const sem = l.semester ? `, Sem ${l.semester}` : "";
  if (l.subject === ANY_SUBJECT) {
    return `Hi! You asked for notes for ${l.programme}${sem} on DU PYQ Online. Which subject do you need them for? Send me the name and I'll share the notes here.`;
  }
  const what = `${l.subject} (${l.programme}${sem})`;
  return l.hasNotes
    ? `Hi! Thanks for asking for ${what} notes on DU PYQ Online. Sending them to you now. Which exam are you preparing for?`
    : `Hi! You asked for ${what} notes on DU PYQ Online. I'm preparing these now and will send them to you here as soon as they're ready.`;
}
