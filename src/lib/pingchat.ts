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
