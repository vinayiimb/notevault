/**
 * "Chat now" opens the visitor chat (PingChat) in a new tab. No sign-in: the chat creates a private visitor
 * identity itself, and the topic only pre-fills the first message (never personal data: no name or phone).
 * Override the address with NEXT_PUBLIC_CHAT_URL once the chat has its own domain.
 */
const CHAT_ORIGIN = (process.env.NEXT_PUBLIC_CHAT_URL || "https://pingchat-production-069c.up.railway.app").replace(/\/+$/, "");

export function chatLink(topic: string): string {
  return `${CHAT_ORIGIN}/chat?topic=${encodeURIComponent(topic.trim().slice(0, 140))}`;
}
