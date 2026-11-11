"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatCircleDots } from "@phosphor-icons/react";
import { chatDraftFor, chatLink } from "@/lib/chat-link";
import { CHAT_NUDGE_EVENT, getChatLink, takeWhatsAppReturn, trackIntent } from "@/lib/lead-intent";
import { ChatPanel } from "@/components/chat-panel";

type Nudge = { href: string; what: string; star?: boolean; source: string; programme?: string; subject?: string; semester?: number | null };
const REPLY_POLL_MS = 15_000; // a team reply opens the chat within this long

/**
 * Floating "Chat now" button, bottom-right on every public page (replaces the old WhatsApp-group icon).
 * Opens the live visitor chat with a pre-filled first message, so the student only has to tap send.
 * Position lives in `.wa-fab` (globals.css) so it steps above the notes Ask-AI launcher and the dashboard's
 * mobile bottom nav without either component knowing.
 *
 * The chat opens in the page (`ChatPanel`), never in another tab. It opens by itself (a) when someone says No to the
 * notes pop-up (⭐ greeting) and (b) when the team writes to a visitor who minimised it, so the reply is not missed.
 */
export function ChatNowFab() {
  const pathname = usePathname();
  const href = useMemo(() => chatLink(chatDraftFor(pathname)), [pathname]);
  const [open, setOpen] = useState(false);
  const [greeting, setGreeting] = useState<"star" | "back" | undefined>();
  // The team wrote to this visitor and the chat could not open yet (a pop-up is in the way): shown as a badge.
  const [reply, setReply] = useState<{ n: number } | null>(null);
  const openRef = useRef(false);
  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const on = (e: Event) => {
      const n = (e as CustomEvent<Nudge>).detail;
      setGreeting(n.star ? "star" : undefined);
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
        const d = (await (await fetch(`/api/lead-chat?t=${link.slice(-48)}`, { cache: "no-store" })).json()) as { unread?: number };
        if (!alive) return;
        const n = d.unread ?? 0;
        // The team replied while the chat was minimised: open it in full (not behind an open pop-up or payment window).
        if (n > 0 && !document.querySelector("dialog[open]")) {
          setGreeting(undefined);
          setOpen(true);
          setReply(null);
        } else setReply(n > 0 ? { n } : null);
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

  // They tapped Yes, WhatsApp opened, and they are back on this page: the chat opens so they can carry on here too.
  useEffect(() => {
    const back = () => {
      if (document.visibilityState === "visible" && takeWhatsAppReturn()) {
        setGreeting("back");
        setOpen(true);
      }
    };
    document.addEventListener("visibilitychange", back);
    window.addEventListener("pageshow", back);
    back(); // a phone may have dropped the page while WhatsApp was in front
    return () => {
      document.removeEventListener("visibilitychange", back);
      window.removeEventListener("pageshow", back);
    };
  }, []);

  if (pathname.startsWith("/chat-pay")) return null; // the student is already paying; don't point them elsewhere
  const subjectOf = chatDraftFor(pathname).replace(/^Hi! I need notes( for )?/, "");
  const openPanel = () => {
    setGreeting(undefined);
    setOpen(true);
  };
  if (open) return <ChatPanel greeting={greeting} fallbackHref={href} onMinimise={() => {
    setOpen(false);
    setReply(null); // the panel marked the team's replies as seen
  }} />;
  return (
    <div className="wa-fab fixed right-4 z-40 flex flex-col items-end gap-2.5 print:hidden sm:right-5">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us now"
        onClick={(e) => {
          e.preventDefault(); // opens the chat in the page; the href stays for crawlers and "open in new tab"
          openPanel();
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
