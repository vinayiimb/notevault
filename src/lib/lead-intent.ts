// Funnel tracking for the notes pop-up: who clicked "Yes", who opened the live chat, who chose WhatsApp, even if
// they never leave a number. Client-safe (no server imports); the route and the admin page reuse parseIntent/score.

/** Fired on window when someone clicked Yes but closed the pop-up without leaving a number or opening the chat. */
export const CHAT_NUDGE_EVENT = "nv:chat-nudge";

export const INTENT_EVENTS = ["yes", "chat", "wa"] as const;
export type IntentEvent = (typeof INTENT_EVENTS)[number];

export type IntentInput = {
  vid: string;
  event: IntentEvent;
  source: string;
  programme: string;
  subject: string;
  semester: number | null;
  key: string;
};

const VID = /^[A-Za-z0-9_-]{16,64}$/;
const clip = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);

export const validVisitorId = (v: unknown): string => (VID.test(String(v ?? "")) ? String(v) : "");

/** Validates what the browser sent. Returns null for anything that isn't a well-formed intent (bots, junk). */
export function parseIntent(body: unknown): IntentInput | null {
  const b = (body ?? {}) as Record<string, unknown>;
  const vid = String(b.vid ?? "");
  const event = INTENT_EVENTS.find((e) => e === b.event);
  if (!VID.test(vid) || !event) return null;
  const source = clip(b.source, 24) || "unknown";
  const programme = clip(b.programme, 120);
  const subject = clip(b.subject, 120);
  const sem = Number(b.semester);
  const semester = Number.isInteger(sem) && sem >= 1 && sem <= 8 ? sem : null;
  return { vid, event, source, programme, subject, semester, key: `${source}|${programme}|${subject}`.toLowerCase().slice(0, 300) };
}

/** Priority for the admin: opened the chat / chose WhatsApp beats a bare "Yes". */
export function intentScore(i: { chatAt?: Date | string | null; waAt?: Date | string | null }) {
  return (i.chatAt ? 2 : 0) + (i.waAt ? 1 : 0);
}

const VID_KEY = "nv_visitor_id";
/** A random id kept in this browser so the "Yes" click and a later phone number can be tied together. */
export function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VID_KEY) ?? "";
    if (!VID.test(id)) {
      id = (crypto.randomUUID?.() ?? `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g, "") + "x".repeat(16);
      id = id.slice(0, 40);
      localStorage.setItem(VID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Fire and forget; never blocks or breaks the pop-up. `keepalive` lets it finish while the page closes. */
export function trackIntent(event: IntentEvent, ctx: { source: string; programme?: string; subject?: string; semester?: number | null }) {
  const vid = getVisitorId();
  if (!vid) return;
  try {
    void fetch("/api/lead-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vid, event, ...ctx }),
      keepalive: true,
    }).catch(() => undefined);
  } catch {}
}
