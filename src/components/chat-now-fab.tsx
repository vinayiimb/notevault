"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { ChatCircleDots, X } from "@phosphor-icons/react";
import { chatDraftFor, chatLink } from "@/lib/chat-link";
import { CHAT_NUDGE_EVENT, trackIntent } from "@/lib/lead-intent";

type Nudge = { href: string; what: string; source: string; programme?: string; subject?: string; semester?: number | null };
const NUDGE_MS = 30_000;

/**
 * Floating "Chat now" button, bottom-right on every public page (replaces the old WhatsApp-group icon).
 * Opens the live visitor chat with a pre-filled first message, so the student only has to tap send.
 * Position lives in `.wa-fab` (globals.css) so it steps above the notes Ask-AI launcher and the dashboard's
 * mobile bottom nav without either component knowing.
 *
 * When someone said "Yes, I need notes" in the pop-up but closed it without a number or the chat, a small greeting
 * opens next to the button (they are the leads that would otherwise be lost): one tap starts the chat.
 */
export function ChatNowFab() {
  const pathname = usePathname();
  const href = useMemo(() => chatLink(chatDraftFor(pathname)), [pathname]);
  const [nudge, setNudge] = useState<Nudge | null>(null);

  useEffect(() => {
    const on = (e: Event) => setNudge((e as CustomEvent<Nudge>).detail);
    window.addEventListener(CHAT_NUDGE_EVENT, on);
    return () => window.removeEventListener(CHAT_NUDGE_EVENT, on);
  }, []);
  useEffect(() => {
    if (!nudge) return;
    const t = setTimeout(() => setNudge(null), NUDGE_MS);
    return () => clearTimeout(t);
  }, [nudge]);

  if (pathname.startsWith("/chat-pay")) return null; // the student is already paying; don't point them elsewhere
  return (
    <div className="wa-fab fixed right-4 z-40 flex flex-col items-end gap-2.5 print:hidden sm:right-5">
      {nudge && (
        <div role="status" className="relative max-w-[16rem] rounded-2xl bg-surface p-3.5 pr-9 text-left shadow-[0_12px_32px_-8px_rgba(0,0,0,0.35)] ring-1 ring-border">
          <button type="button" onClick={() => setNudge(null)} aria-label="Dismiss" className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full text-muted hover:text-foreground">
            <X size={12} weight="bold" />
          </button>
          <p className="text-[14px] font-semibold leading-snug text-foreground">Still need notes for {nudge.what}?</p>
          <p className="mt-0.5 text-[13px] leading-snug text-muted">Chat with us live. No number needed.</p>
          <a
            href={nudge.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              trackIntent("chat", nudge);
              setNudge(null);
            }}
            className="mt-2.5 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-brand-foreground"
          >
            <ChatCircleDots size={16} weight="fill" />
            Chat now
          </a>
        </div>
      )}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Chat with us now"
        onClick={() => {
          const w = window as typeof window & { gtag?: (...a: unknown[]) => void };
          w.gtag?.("event", "chat_now_click", { page_path: location.pathname, placement: "floating" });
          trackIntent("chat", { source: "chat-button", subject: chatDraftFor(pathname).replace(/^Hi! I need notes( for )?/, "") });
        }}
        className="group flex items-center"
      >
        <span className="relative flex h-12 items-center gap-2 rounded-full bg-brand pl-4 pr-5 text-[15px] font-semibold text-brand-foreground shadow-[0_8px_24px_-6px_rgba(0,113,227,0.55)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-brand/40 sm:h-13">
          <span aria-hidden className="absolute inset-0 rounded-full bg-brand opacity-50 motion-safe:animate-[chat-ping_2.4s_ease-out_3]" />
          <ChatCircleDots size={24} weight="fill" className="relative" />
          <span className="relative">Chat now</span>
        </span>
      </a>
    </div>
  );
}
