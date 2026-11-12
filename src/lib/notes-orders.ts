import { PACKS, normalizePhone } from "@/lib/paid-notes-pricing";
import { parseLeadSemester } from "@/lib/note-leads";

// Pay-first notes from the pop-up on the PYQ pages. The student pays (Razorpay), and we send the notes
// on WhatsApp after a short buffer. Shared by the pop-up (client), the order routes and the admin page,
// so it must stay free of server-only imports.

export const ORDER_PLANS = ["subject", "three", "semester"] as const; // "three" (3 subjects) is only sold pay-first from the chat
export type OrderPlan = (typeof ORDER_PLANS)[number];

// Same prices as /paid-notes: one subject, and the whole-semester pack. Always read server-side when
// an order is created; the client only displays them.
const FULL_SEMESTER = PACKS[PACKS.length - 1];
export const ORDER_PRICE: Record<OrderPlan, number> = { subject: PACKS[0].price, three: PACKS[1].price, semester: FULL_SEMESTER.price };
/** What the whole semester would cost one subject at a time: shown struck through next to the pack price. */
export const SEMESTER_SUBJECTS = 7; // how the whole semester is advertised ("all 7 subjects"); the pack in PACKS stays as is

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

/** A pay-first order from the live chat: the student has not named a course or semester yet, the team asks on WhatsApp after payment. */
export const CHAT_ORDER = { programmeSlug: "chat", programme: "Chat order", subjectSlug: "chat", subject: "Single subject (named in chat)" } as const;
export const isChatOrder = (programmeSlug: string | null | undefined) => programmeSlug === CHAT_ORDER.programmeSlug;

const text = (v: unknown, max = 120) => String(v ?? "").trim().slice(0, max);

/**
 * What the pop-up sends to create an order. Returns null unless everything needed is there; the price is
 * NOT read from the client, only from ORDER_PRICE.
 */
export function parseOrderRequest(body: unknown): Omit<NotesOrderInput, "amount"> | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const plan = parseOrderPlan(b.plan);
  const phone = normalizePhone(String(b.phone ?? ""));
  const programmeSlug = text(b.programmeSlug);
  const chat = isChatOrder(programmeSlug);
  const semester = chat ? 0 : parseLeadSemester(b.semester);
  const programme = chat ? CHAT_ORDER.programme : text(b.programme);
  if (plan === "three" && !chat) return null; // the 3-subject pack has no course to attach to outside the chat
  if (!plan || !phone || semester === null || !programme || !programmeSlug) return null;
  if (chat) return { phone, plan, programmeSlug, programme, semester, subject: plan === "subject" ? CHAT_ORDER.subject : plan === "three" ? "3 subjects (named in chat)" : "", subjectSlug: plan === "semester" ? "" : CHAT_ORDER.subjectSlug };
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
  if (o.plan === "three") return "3 subjects";
  return o.plan === "semester" ? (o.semester ? `Whole Semester ${o.semester}` : "Whole semester") : o.subject;
}

/** First WhatsApp message to a buyer: tells them what they bought; the admin attaches the notes. */
export function orderWhatsAppText(o: { plan: string; subject: string; semester: number; programme: string }) {
  return `Hi! Thank you for your DU PYQ Online notes purchase: ${orderPlanLabel(o)} (${[o.programme, o.semester ? `Sem ${o.semester}` : ""].filter(Boolean).join(", ")}). Sending your notes below.`;
}
