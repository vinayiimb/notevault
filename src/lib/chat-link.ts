/**
 * "Chat now" opens the visitor chat (PingChat) in a new tab. No sign-in: the chat creates a private visitor
 * identity itself, and the topic only pre-fills the first message (never personal data: no name or phone).
 * Override the address with NEXT_PUBLIC_CHAT_URL once the chat has its own domain.
 */
export const CHAT_ORIGIN = (process.env.NEXT_PUBLIC_CHAT_URL || "https://pingchat-production-069c.up.railway.app").replace(/\/+$/, "");

/** The owner's chat inbox (where visitor chats arrive). */
export const CHAT_INBOX = `${CHAT_ORIGIN}/`;

export function chatLink(topic: string): string {
  return `${CHAT_ORIGIN}/chat?topic=${encodeURIComponent(topic.trim().slice(0, 140))}`;
}

const SMALL_WORDS = new Set(["a", "an", "and", "as", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with"]);

/** "14th-to-17th-century-english-poetry" -> "14th to 17th Century English Poetry" */
function niceSlug(slug: string): string {
  let s = slug;
  try { s = decodeURIComponent(slug); } catch { /* keep raw */ }
  return s
    .split("-")
    .filter(Boolean)
    .map((w, i) => (i > 0 && SMALL_WORDS.has(w.toLowerCase()) ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** The pre-filled first message: on a subject page ("/papers/<programme>/<subject>") it names the subject. */
export function chatDraftFor(pathname: string): string {
  const m = /^\/papers\/[^/]+\/([^/]+)/.exec(pathname);
  const subject = m ? niceSlug(m[1]) : "";
  return subject.length > 2 ? `Hi! I need notes for ${subject}` : "Hi! I need notes";
}
