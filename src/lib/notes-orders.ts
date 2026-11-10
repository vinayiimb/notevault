import { PACKS, normalizePhone } from "@/lib/paid-notes-pricing";
import { parseLeadSemester } from "@/lib/note-leads";

// Pay-first notes from the pop-up on the PYQ pages. The student pays (Razorpay), and we send the notes
// on WhatsApp after a short buffer. Shared by the pop-up (client), the order routes and the admin page,
// so it must stay free of server-only imports.

export const ORDER_PLANS = ["subject", "semester"] as const;
export type OrderPlan = (typeof ORDER_PLANS)[number];

// Same prices as /paid-notes: one subject, and the whole-semester pack. Always read server-side when
// an order is created; the client only displays them.
const FULL_SEMESTER = PACKS[PACKS.length - 1];
export const ORDER_PRICE: Record<OrderPlan, number> = { subject: PACKS[0].price, semester: FULL_SEMESTER.price };

/** The buffer we promise between payment and the notes arriving on WhatsApp. */
export const NOTES_DELIVERY_HOURS = 24;
export const NOTES_DELIVERY_TEXT = `within ${NOTES_DELIVERY_HOURS} hours`;

/** Marks Razorpay orders that belong to this flow (the older checkout orders carry email + items instead). */
export const NOTES_ORDER_KIND = "notes-preorder";

export function parseOrderPlan(raw: unknown): OrderPlan | null {
  return ORDER_PLANS.find((p) => p === raw) ?? null;
}

export type NotesOrderInput = {
  phone: string; // 91XXXXXXXXXX
  plan: OrderPlan;
  programmeSlug: string;
  programme: string;
  semester: number;
  /** "" for a whole semester. */
  subjectSlug: string;
  subject: string;
  /** Rupees. */
  amount: number;
};

const text = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

/**
 * What the pop-up sends to create an order. Returns null unless everything needed is there; the price is
 * NOT read from the client, only from ORDER_PRICE.
 */
export function parseOrderRequest(body: unknown): Omit<NotesOrderInput, "amount"> | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const plan = parseOrderPlan(b.plan);
  const phone = normalizePhone(String(b.phone ?? ""));
  const semester = parseLeadSemester(b.semester);
  const programme = text(b.programme);
  const programmeSlug = text(b.programmeSlug);
  if (!plan || !phone || !semester || !programme || !programmeSlug) return null;
  const subject = plan === "subject" ? text(b.subject) : "";
  const subjectSlug = plan === "subject" ? text(b.subjectSlug) : "";
  if (plan === "subject" && (!subject || !subjectSlug)) return null;
  return { phone, plan, programmeSlug, programme, semester, subject, subjectSlug };
}

/** Razorpay keeps these with the order, so the verify step and the webhook can rebuild the order later. */
export function toRazorpayNotes(o: NotesOrderInput): Record<string, string> {
  return {
    kind: NOTES_ORDER_KIND,
    phone: o.phone,
    plan: o.plan,
    programmeSlug: o.programmeSlug,
    programme: o.programme,
    semester: String(o.semester),
    subjectSlug: o.subjectSlug,
    subject: o.subject,
    amount: String(o.amount),
  };
}

/** Back from Razorpay's order notes. Null when the order isn't one of ours or looks damaged. */
export function fromRazorpayNotes(notes: Record<string, string> | null | undefined): NotesOrderInput | null {
  if (!notes || notes.kind !== NOTES_ORDER_KIND) return null;
  const amount = Number(notes.amount);
  if (!Number.isInteger(amount) || amount <= 0 || amount > 10_000) return null;
  const parsed = parseOrderRequest(notes);
  return parsed ? { ...parsed, amount } : null;
}

/** "Whole Semester 3" / "Risk Management" for the admin list and the WhatsApp message. */
export function orderPlanLabel(o: { plan: string; subject: string; semester: number }) {
  return o.plan === "semester" ? (o.semester ? `Whole Semester ${o.semester}` : "Whole semester") : o.subject;
}

/** First WhatsApp message to a buyer: tells them what they bought; the admin attaches the notes. */
export function orderWhatsAppText(o: { plan: string; subject: string; semester: number; programme: string }) {
  return `Hi! Thank you for your DU PYQ Online notes purchase: ${orderPlanLabel(o)} (${[o.programme, o.semester ? `Sem ${o.semester}` : ""].filter(Boolean).join(", ")}). Sending your notes below.`;
}
