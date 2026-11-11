import { CHAT_ORIGIN } from "@/lib/chat-link";

// Funnel tracking for the notes pop-up: who clicked "Yes", who opened the live chat, who chose WhatsApp, even if
// they never leave a number. Client-safe (no server imports); the route and the admin page reuse parseIntent/score.

/** Fired on window when someone said No (or closed the pop-up): the chat opens by itself with a ⭐ greeting. */
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

/**
 * First line the team sees in the chat inbox. 💎 = said Yes (WhatsApp opened), ⭐ = said No / closed the pop-up and
 * the chat opened instead. The visitor's own panel hides these (see `isSeedMessage`).
 */
export function seedText(tone: "yes" | "no", i: { programme: string; subject: string; semester: number | null }) {
  const what = [i.subject, i.programme].filter(Boolean).join(", ") || "notes";
  const sem = i.semester ? `, Semester ${i.semester}` : "";
  return tone === "yes"
    ? `💎 Hi! I need notes for ${what}${sem}. (clicked Yes on the website)`
    : `⭐ Hi! I need notes for ${what}${sem}. (opened the chat from the website)`;
}

/** True for the two messages above, so the visitor's chat panel doesn't show them back to the visitor. */
export const isSeedMessage = (body: string) => /\((clicked Yes on the website|opened the chat from the website)\)\s*$/i.test(body);

const WA_KEY = "nv_wa_opened_at";
const WA_AWAY_MIN_MS = 4000; // a page that comes back sooner than this was never really left
const WA_WINDOW_MS = 30 * 60 * 1000;

/** They tapped Yes and WhatsApp opened: remember it, so the chat can open when they come back to this page. */
export function markWhatsAppOpened() {
  try {
    sessionStorage.setItem(WA_KEY, String(Date.now()));
  } catch {}
}

/** True once, when this visitor returns to the page after WhatsApp was opened (within half an hour). */
export function takeWhatsAppReturn(): boolean {
  try {
    const t = Number(sessionStorage.getItem(WA_KEY));
    if (!t) return false;
    const age = Date.now() - t;
    if (age < WA_AWAY_MIN_MS) return false;
    sessionStorage.removeItem(WA_KEY);
    return age < WA_WINDOW_MS;
  } catch {
    return false;
  }
}

/** Priority for the admin: opened the chat / chose WhatsApp beats a bare "Yes". */
export function intentScore(i: { chatAt?: Date | string | null; waAt?: Date | string | null }) {
  return (i.chatAt ? 2 : 0) + (i.waAt ? 1 : 0);
}

const VID_KEY = "nv_visitor_id";
const CHAT_KEY = "nv_chat_link";
const CHAT_LINK = new RegExp(`^${CHAT_ORIGIN.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/g/[0-9a-f]{48}$`);

/** The private link to this visitor's own chat (kept in the browser after their first "Yes"), or "". */
export function getChatLink(): string {
  try {
    const l = localStorage.getItem(CHAT_KEY) ?? "";
    return CHAT_LINK.test(l) ? l : "";
  } catch {
    return "";
  }
}

/** Remember the private chat link the server handed back (only if it really is a link to our chat). */
export function saveChatLink(link: unknown) {
  try {
    if (typeof link === "string" && CHAT_LINK.test(link)) localStorage.setItem(CHAT_KEY, link);
  } catch {}
}

/** Open the visitor's own chat when they have one (so the team's "Hi" is waiting there), else the normal link. */
export function openChat(e: { preventDefault: () => void }, fallback: string) {
  const link = getChatLink();
  if (!link || link === fallback) return;
  e.preventDefault();
  window.open(link, "_blank", "noopener,noreferrer");
}
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
    })
      .then((r) => r.json())
      .then((d: { chat?: string | null }) => {
        // The first "Yes" opens this visitor's chat; remember its private link so every Chat now button reuses it.
        if (d?.chat && CHAT_LINK.test(d.chat)) localStorage.setItem(CHAT_KEY, d.chat);
      })
      .catch(() => undefined);
  } catch {}
}
