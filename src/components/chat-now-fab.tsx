"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatCircleDots, X } from "@phosphor-icons/react";
import { chatDraftFor, chatLink } from "@/lib/chat-link";
import { CHAT_NUDGE_EVENT, getChatLink, trackIntent } from "@/lib/lead-intent";
import { ChatPanel } from "@/components/chat-panel";

type Nudge = { href: string; what: string; source: string; programme?: string; subject?: string; semester?: number | null };
const REPLY_POLL_MS = 45_000;

/**
 * Floating "Chat now" button, bottom-right on every public page (replaces the old WhatsApp-group icon).
 * Opens the live visitor chat with a pre-filled first message, so the student only has to tap send.
 * Position lives in `.wa-fab` (globals.css) so it steps above the notes Ask-AI launcher and the dashboard's
 * mobile bottom nav without either component knowing.
 *
 * The chat opens in the page (`ChatPanel`), never in another tab. When someone said "Yes, I need notes" in the pop-up
 * but closed it without a number, it opens by itself (they are the leads that would otherwise be lost).
 */
export function ChatNowFab() {
  const pathname = usePathname();
  const href = useMemo(() => chatLink(chatDraftFor(pathname)), [pathname]);
  const [open, setOpen] = useState(false);
  const [what, setWhat] = useState("");
  // The team wrote to this visitor (they said Yes, left, and came back): tell them, with the message, on any page.
  const [reply, setReply] = useState<{ n: number; body: string } | null>(null);
  const [replyHidden, setReplyHidden] = useState(false);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<Nudge>).detail;
      setWhat(n.what);
      setOpen(true);
      trackIntent("chat", n);
    };
    window.addEventListener(CHAT_NUDGE_EVENT, on);
    return () => window.removeEventListener(CHAT_NUDGE_EVENT, on);
  }, []);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const link = getChatLink();
      if (!link || document.visibilityState !== "visible" || openRef.current) return;
      try {
        const d = (await (await fetch(`/api/lead-chat?t=${link.slice(-48)}`, { cache: "no-store" })).json()) as { unread?: number; last?: { body?: string } | null };
        if (alive) setReply(d.unread && d.unread > 0 ? { n: d.unread, body: d.last?.body ?? "" } : null);
      } catch {}
    };
    void check();
    const t = setInterval(check, REPLY_POLL_MS);
    document.addEventListener("visibilitychange", check);
    return () => {
      alive = false;
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  if (pathname.startsWith("/chat-pay")) return null; // the student is already paying; don't point them elsewhere
  const subjectOf = chatDraftFor(pathname).replace(/^Hi! I need notes( for )?/, "");
  const openPanel = (label: string) => {
    setWhat(label);
    setOpen(true);
    setReplyHidden(true);
  };
  if (open) return <ChatPanel what={what || subjectOf || "your DU subject"} fallbackHref={href} onMinimise={() => {
    setOpen(false);
    setReply(null); // the panel marked the team's replies as seen
  }} />;
  return (
    <div className="wa-fab fixed right-4 z-40 flex flex-col items-end gap-2.5 print:hidden sm:right-5">
      {reply && !replyHidden && (
        <div role="status" className="relative max-w-[16rem] rounded-2xl bg-surface p-3.5 pr-9 text-left shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] ring-1 ring-brand/40">
          <button type="button" onClick={() => setReplyHidden(true)} aria-label="Dismiss" className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-muted hover:text-foreground">
            <X size={12} weight="bold" />
          </button>
          <p className="text-[14px] font-semibold leading-snug text-foreground">We replied to you 💬</p>
          {reply.body && <p className="mt-0.5 line-clamp-3 text-[13px] leading-snug text-muted">“{reply.body}”</p>}
          <button
            type="button"
            onClick={() => openPanel(subjectOf)}
            className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-brand-foreground"
          >
            <ChatCircleDots size={16} weight="fill" />
            Open chat
          </button>
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us now"
        onClick={(e) => {
          e.preventDefault(); // opens the chat in the page; the href stays for crawlers and "open in new tab"
          openPanel(subjectOf);
          const w = window as typeof window & { gtag?: (...a: unknown[]) => void };
          w.gtag?.("event", "chat_now_click", { page_path: location.pathname, placement: "floating" });
          trackIntent("chat", { source: "chat-button", subject: subjectOf });
        }}
        className="group flex items-center"
      >
        <span className="relative flex h-12 items-center gap-2 rounded-full bg-brand pl-4 pr-5 text-[15px] font-semibold text-brand-foreground shadow-[0_8px_24px_-6px_rgba(0,113,227,0.55)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-brand/40 sm:h-13">
          <span aria-hidden className="absolute inset-0 rounded-full bg-brand opacity-50 motion-safe:animate-[chat-ping_2.4s_ease-out_3]" />
          <ChatCircleDots size={24} weight="fill" className="relative" />
          <span className="relative">Chat now</span>
          {reply && (
            <span aria-label={`${reply.n} new message`} className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[11px] font-bold text-white ring-2 ring-background">
              {reply.n > 9 ? "9+" : reply.n}
            </span>
          )}
        </span>
      </a>
    </div>
  );
}
