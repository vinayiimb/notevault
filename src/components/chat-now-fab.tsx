"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { ChatCircleDots } from "@phosphor-icons/react/dist/ssr";
import { chatDraftFor, chatLink } from "@/lib/chat-link";

/**
 * Floating "Chat now" button, bottom-right on every public page (replaces the old WhatsApp-group icon).
 * Opens the live visitor chat with a pre-filled first message, so the student only has to tap send.
 * Position lives in `.wa-fab` (globals.css) so it steps above the notes Ask-AI launcher and the dashboard's
 * mobile bottom nav without either component knowing.
 */
export function ChatNowFab() {
  const pathname = usePathname();
  const href = useMemo(() => chatLink(chatDraftFor(pathname)), [pathname]);
  if (pathname.startsWith("/chat-pay")) return null; // the student is already paying; don't point them elsewhere
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us now"
      onClick={() => {
        const w = window as typeof window & { gtag?: (...a: unknown[]) => void };
        w.gtag?.("event", "chat_now_click", { page_path: location.pathname, placement: "floating" });
      }}
      className="wa-fab group fixed right-4 z-40 flex items-center print:hidden sm:right-5"
    >
      <span className="relative flex h-12 items-center gap-2 rounded-full bg-brand pl-4 pr-5 text-[15px] font-semibold text-brand-foreground shadow-[0_8px_24px_-6px_rgba(0,113,227,0.55)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-brand/40 sm:h-13">
        <span aria-hidden className="absolute inset-0 rounded-full bg-brand opacity-50 motion-safe:animate-[chat-ping_2.4s_ease-out_3]" />
        <ChatCircleDots size={24} weight="fill" className="relative" />
        <span className="relative">Chat now</span>
      </span>
    </a>
  );
}
