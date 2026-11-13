import { formatLeadPhone, leadWhatsAppText } from "@/lib/note-leads";
import { NOTES_DELIVERY_HOURS, orderPlanLabel, orderWhatsAppText } from "@/lib/notes-orders";

// The WhatsApp texts the owner receives when a student does something. Plain text with a tap-to-reply link, so
// the owner can answer from the notification. Pure functions, no I/O.

const SITE = "https://www.dupyq.online";
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const reply = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

const SOURCE: Record<string, string> = {
  "notes-hub": "the notes page form",
  "notes-list": "a note on the notes page",
  "note-page": "a note page",
  "paper-pdf": "opening a free paper",
  "pyq-page": "a papers page",
};

export function leadAlert(l: { phone: string; programme: string; semester: number | null; subject: string; hasNotes: boolean; source: string }) {
  const lines = [
    "🔔 New lead",
    formatLeadPhone(l.phone),
    `${l.subject} · ${l.programme}${l.semester ? ` · Sem ${l.semester}` : ""}`,
    `${l.hasNotes ? "Notes ready" : "No notes yet"} · from ${SOURCE[l.source] ?? l.source}`,
    "",
    `Reply: ${reply(l.phone, leadWhatsAppText(l))}`,
  ];
  return lines.join("\n");
}

/** A visitor showed interest but has not left a number. They can only be reached through the live chat. */
export function intentAlert(event: "yes" | "chat", i: { programme: string; subject: string; semester: number | null; source?: string }) {
  const what = [i.subject, i.programme].filter(Boolean).join(" · ") || "notes";
  const fromPopup = event === "chat" && i.source !== "chat-button"; // said No to the pop-up and the chat opened instead
  return [
    event === "yes" ? "💎 Clicked “Yes, I need notes”" : fromPopup ? "⭐ Said no to the pop-up, chat opened" : "💬 Opened the live chat",
    `${what}${i.semester ? ` · Sem ${i.semester}` : ""}`,
    event === "yes" ? "WhatsApp opened for them: if they tap Send, the message arrives on your number." : "They may write any moment: keep the chat open.",
    "",
    `All leads: ${SITE}/admin/leads`,
  ].join("\n");
}

/** Someone who already left their number asked for the same notes again: a stronger signal than a first visit. */
export function returningLeadAlert(l: { phone: string; programme: string; semester: number | null; subject: string; hasNotes: boolean }) {
  return [
    "🔁 Came back again",
    formatLeadPhone(l.phone),
    `${l.subject} · ${l.programme}${l.semester ? ` · Sem ${l.semester}` : ""}`,
    "",
    `Reply: ${reply(l.phone, leadWhatsAppText(l))}`,
  ].join("\n");
}

/** The lead could not be saved (database trouble). The number is here so it is not lost. */
export function leadLostAlert(l: { phone: string; programme: string; subject: string }) {
  return ["⚠️ A lead could NOT be saved — message them now", formatLeadPhone(l.phone), `${l.subject} · ${l.programme}`, "", `Reply: ${reply(l.phone, "Hi! Here are the notes you asked for on DU PYQ Online.")}`].join("\n");
}

export function chatAlert(l: { phone: string; programme: string; semester: number | null; subject: string; hasNotes: boolean }) {
  return [
    "☎️ Wants you to message them first",
    formatLeadPhone(l.phone),
    `${l.subject} · ${l.programme}${l.semester ? ` · Sem ${l.semester}` : ""}`,
    "",
    `Reply: ${reply(l.phone, leadWhatsAppText(l))}`,
  ].join("\n");
}

export function orderAlert(o: { phone: string; plan: string; subject: string; semester: number; programme: string; amount: number }) {
  return [
    `💰 New order: ₹${o.amount} paid`,
    orderPlanLabel(o),
    `${o.programme} · Sem ${o.semester}`,
    formatLeadPhone(o.phone),
    `Send the notes within ${NOTES_DELIVERY_HOURS} hours:`,
    reply(o.phone, orderWhatsAppText(o)),
    "",
    `All orders: ${SITE}/admin/leads`,
  ].join("\n");
}

export function feedbackAlert(message: string, screenshotUrl: string | null) {
  return [
    "💬 New message on DU PYQ Online",
    `"${clip(message.replace(/\s+/g, " "), 400)}"`,
    ...(screenshotUrl ? [`Screenshot: ${screenshotUrl.startsWith("http") ? screenshotUrl : SITE + screenshotUrl}`] : []),
    "",
    `Read all: ${SITE}/admin/feedback`,
  ].join("\n");
}

export function ticketAlert(t: { email: string; kind: string; subject: string; message: string }) {
  const label = t.kind === "ERROR" ? "🐞 Error report" : t.kind === "SUGGESTION" ? "💡 Suggestion" : "🎫 Problem";
  return [
    `${label} from a student`,
    t.email,
    `${clip(t.subject, 120)}`,
    `"${clip(t.message.replace(/\s+/g, " "), 300)}"`,
    "",
    `Reply: ${SITE}/admin/support`,
  ].join("\n");
}

export function paymentAlert(p: { phone: string; email: string; amount: number; utr: string }) {
  return [
    `💳 UPI payment to check: ₹${p.amount}`,
    formatLeadPhone(p.phone),
    p.email,
    `UTR ${p.utr}`,
    "",
    `Approve it: ${SITE}/admin/payments`,
  ].join("\n");
}
