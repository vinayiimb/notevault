import { normalizePhone } from "@/lib/paid-notes-pricing";

// Shared by the public lead form (client) and the lead actions/admin page
// (server), so it must stay free of server-only imports.

export const LEAD_SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;
export const LEAD_SOURCES = ["notes-hub", "notes-list", "note-page", "paper-pdf"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];
export const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "DROPPED"] as const;
export type LeadStatusName = (typeof LEAD_STATUSES)[number];

/** Set once a browser has left a number (hides the inline card on note pages). */
export const LEAD_STORAGE_KEY = "nv_lead";
/** The number they typed, so asking for another subject is one tap. Stays on their device. */
export const LEAD_PHONE_KEY = "nv_lead_phone";

export type LeadCourse = { slug: string; name: string };
export type LeadSubject = { slug: string; name: string; hasNotes: boolean; semester: number | null };

export function parseLeadSemester(raw: unknown): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
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
  const what = `${l.subject} (${l.programme}${l.semester ? `, Sem ${l.semester}` : ""})`;
  return l.hasNotes
    ? `Hi! Thanks for asking for ${what} notes on DU PYQ Online. Sending them to you now. Which exam are you preparing for?`
    : `Hi! You asked for ${what} notes on DU PYQ Online. I'm preparing these now and will send them to you here as soon as they're ready.`;
}
