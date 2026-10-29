"use client";

import { WhatsappLogo } from "@phosphor-icons/react/dist/ssr";

export const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/GwT0moUvMqQDDKZjCajpPU";

/**
 * Floating WhatsApp button, bottom-right on every public page. Position lives
 * in `.wa-fab` (globals.css) so it can step above the notes Ask-AI launcher
 * and the dashboard's mobile bottom nav without either component knowing.
 */
export function WhatsAppJoin() {
  return (
    <a
      href={WHATSAPP_GROUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Join our WhatsApp group for new papers and updates"
      onClick={() => {
        const w = window as typeof window & { gtag?: (...a: unknown[]) => void };
        w.gtag?.("event", "whatsapp_group_click", { page_path: location.pathname });
      }}
      className="wa-fab group fixed right-4 z-40 flex items-center print:hidden sm:right-5"
    >
      {/* Desktop hover label */}
      <span className="pointer-events-none mr-3 hidden translate-x-2 whitespace-nowrap rounded-full bg-foreground px-3 py-1.5 text-xs font-semibold text-background opacity-0 shadow-md transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:block">
        Join our WhatsApp group
      </span>
      <span className="relative flex h-13 w-13 items-center justify-center rounded-full bg-[#25D366] text-white shadow-[0_8px_24px_-6px_rgba(37,211,102,0.65)] transition-transform duration-200 group-hover:scale-105 group-active:scale-95 group-focus-visible:ring-4 group-focus-visible:ring-[#25D366]/40 sm:h-14 sm:w-14">
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-60 motion-safe:animate-[wa-ping_2.4s_ease-out_3]" />
        <WhatsappLogo size={30} weight="fill" className="relative" />
      </span>
    </a>
  );
}
