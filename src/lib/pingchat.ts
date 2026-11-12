import "server-only";
import { CHAT_ORIGIN } from "@/lib/chat-link";

// NoteVault -> PingChat, server to server, with a shared secret (PINGCHAT_SEED_SECRET here, SEED_SECRET there).
// Off (returns null) until the secret is set on both, so nothing else depends on it.
const secret = () => process.env.PINGCHAT_SEED_SECRET || "";

/**
 * Opens (or finds) this visitor's chat in the team's inbox with `text` as their first message, so the team can write
 * "Hi" even if the visitor never types or closes the tab. Returns the visitor's private return-link, or null.
 */
export async function seedVisitorChat(ref: string, text: string): Promise<string | null> {
  if (!secret()) return null;
  try {
    const res = await fetch(`${CHAT_ORIGIN}/api/seed`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-seed-secret": secret() },
      body: JSON.stringify({ ref, text }),
      signal: AbortSignal.timeout(4000),
    });
    const d = (await res.json().catch(() => ({}))) as { link?: string };
    return res.ok && typeof d.link === "string" && /^\/g\/[0-9a-f]{48}$/.test(d.link) ? `${CHAT_ORIGIN}${d.link}` : null;
  } catch {
    return null;
  }
}

/** Has the team written to this visitor and not been read yet? `token` is the 48 hex characters of their link. */
export async function visitorChatStatus(token: string): Promise<{ unread: number; last: { body: string; at: number } | null }> {
  const none = { unread: 0, last: null };
  if (!secret() || !/^[0-9a-f]{48}$/.test(token)) return none;
  try {
    const res = await fetch(`${CHAT_ORIGIN}/api/seed/status?link=${token}`, { headers: { "x-seed-secret": secret() }, signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) return none;
    const d = (await res.json()) as { unread?: number; last?: { body?: string; at?: number } | null };
    return { unread: Math.max(0, Number(d.unread) || 0), last: d.last?.body ? { body: String(d.last.body).slice(0, 140), at: Number(d.last.at) || 0 } : null };
  } catch {
    return none;
  }
}

/** What a bot message can carry besides text, cleaned for the browser: sample pages, payment options, or the number + Gmail form. */
export type ThreadCard =
  | { kind: "images"; images: { url: string; w: number; h: number }[] }
  | { kind: "contact"; phone: string }
  | { kind?: undefined; title: string; options: { label: string; note: string; price: number; was?: number; off?: number; href: string; best?: boolean }[]; foot: string };
export type ThreadMessage = { id: number; mine: boolean; auto: boolean; body: string; at: number; card: ThreadCard | null; actions: string[] };

const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const str = (v: unknown, n = 160) => String(v ?? "").slice(0, n);
function cleanCard(c: unknown): ThreadCard | null {
  const x = c as Record<string, unknown> | null;
  if (!x || typeof x !== "object") return null;
  if (x.kind === "images" && Array.isArray(x.images)) {
    const images = (x.images as { url?: unknown; w?: unknown; h?: unknown }[]).filter((i) => /^\/sample\/[\w-]+\.jpg$/.test(String(i.url))).slice(0, 8).map((i) => ({ url: String(i.url), w: num(i.w) || 4, h: num(i.h) || 3 }));
    return images.length ? { kind: "images", images } : null;
  }
  if (x.kind === "contact") return { kind: "contact", phone: /^\d{10}$/.test(String(x.phone ?? "")) ? String(x.phone) : "" };
  if (Array.isArray(x.options)) {
    const options = (x.options as Record<string, unknown>[]).slice(0, 4).flatMap((o) => {
      let href = "";
      try { const u = new URL(String(o.url)); if (u.pathname === "/chat-pay") href = `${u.pathname}${u.search}`; } catch {} // pay links only ever point at our own checkout
      return href ? [{ label: str(o.label, 40), note: str(o.note, 60), price: num(o.price), was: num(o.was) || undefined, off: num(o.off) || undefined, href, best: !!o.best }] : [];
    });
    return options.length ? { title: str(x.title, 60), options, foot: str(x.foot, 120) } : null;
  }
  return null;
}

/**
 * The visitor's whole conversation (theirs, the team's, auto-replies) for the on-site chat panel, plus whether someone
 * on the team is typing right now. Reading it marks the team's replies as seen.
 */
export async function visitorThread(token: string): Promise<{ messages: ThreadMessage[]; typing: boolean }> {
  const none = { messages: [], typing: false };
  if (!secret() || !/^[0-9a-f]{48}$/.test(token)) return none;
  try {
    const res = await fetch(`${CHAT_ORIGIN}/api/seed/thread?link=${token}`, { headers: { "x-seed-secret": secret() }, signal: AbortSignal.timeout(4000), cache: "no-store" });
    if (!res.ok) return none;
    const d = (await res.json()) as { typing?: boolean; messages?: { id?: number; mine?: boolean; auto?: number; body?: string; at?: number; card?: unknown; actions?: unknown }[] };
    return {
      typing: !!d.typing,
      messages: (d.messages ?? []).map((m) => ({ id: Number(m.id) || 0, mine: !!m.mine, auto: !!m.auto, body: String(m.body ?? "").slice(0, 2000), at: Number(m.at) || 0, card: cleanCard(m.card), actions: Array.isArray(m.actions) ? m.actions.slice(0, 4).map((x) => str(x, 40)) : [] })),
    };
  } catch {
    return none;
  }
}
