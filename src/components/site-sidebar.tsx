"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  CaretLeft,
  CaretRight,
  ChatCircleText,
  ClockCounterClockwise,
  Exam,
  Headset,
  SquaresFour,
  Wrench,
} from "@phosphor-icons/react";
import { SearchBar } from "@/components/search-bar";

const COLLAPSED_KEY = "notevault-sidebar-collapsed";

const NAV = [
  { href: "/browse/college", label: "PYQ", match: "/browse", Icon: ClockCounterClockwise },
  { href: "/exam-sessions", label: "Question Papers", match: "/exam-sessions", Icon: Exam },
  { href: "/tools", label: "Tools", match: "/tools", Icon: Wrench },
  { href: "/dashboard", label: "Dashboard", match: "/dashboard", Icon: SquaresFour },
] as const;

const SUPPORT = [
  { href: "/feedback", label: "Feedback", match: "/feedback", external: false, Icon: ChatCircleText },
  { href: "https://wa.me/919376180015", label: "Help", match: "__external__", external: true, Icon: Headset },
] as const;

// Collapse state lives entirely outside React (a class toggled on <html>,
// same trick ThemeToggle uses for dark mode) — not useState. A pre-hydration
// script in src/app/layout.tsx applies the saved class before React ever
// renders, so there's no expanded-then-collapsed flash or hydration
// mismatch to fix; the width/label visibility below is pure CSS
// (`sidebar-collapsed:` variant, defined in globals.css) reacting to that
// class, so toggling never needs to re-render this component at all.
function toggleCollapsed() {
  const next = !document.documentElement.classList.contains("sidebar-collapsed");
  document.documentElement.classList.toggle("sidebar-collapsed", next);
  localStorage.setItem(COLLAPSED_KEY, String(next));
}

// Everything except "Full archive" (still in SiteHeader) lives here — a
// persistent left rail on desktop, matching how the site-navigation LINKS
// used to be laid out horizontally before. Hidden on mobile: MobileNavMenu
// in site-navigation.tsx already covers small screens with the same links.
export function SiteSidebar() {
  const pathname = usePathname();

  function isActive(match: string) {
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  return (
    <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-border bg-surface p-4 transition-[width] duration-200 sidebar-collapsed:w-[4.5rem] md:flex">
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Toggle sidebar"
        className="absolute top-8 -right-3 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition hover:text-foreground"
      >
        <CaretLeft aria-hidden="true" size={12} weight="bold" className="sidebar-collapsed:hidden" />
        <CaretRight aria-hidden="true" size={12} weight="bold" className="hidden sidebar-collapsed:block" />
      </button>

      <Link
        href="/"
        className="mb-4 block px-2 font-display text-lg font-bold tracking-tight text-foreground sidebar-collapsed:text-center"
      >
        <span className="sidebar-collapsed:hidden">DU PYQ</span>
        <span className="hidden sidebar-collapsed:inline">DU</span>
      </Link>

      <div className="mb-4 sidebar-collapsed:hidden">
        <Suspense fallback={<div className="h-11 w-full rounded-xl bg-surface-muted" />}>
          <SearchBar compact />
        </Suspense>
      </div>

      <nav className="flex flex-1 flex-col gap-1 text-sm font-medium">
        {NAV.map(({ href, label, match, Icon }) => {
          const active = isActive(match);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition sidebar-collapsed:justify-center ${
                active ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} weight={active ? "bold" : "regular"} className="shrink-0" />
              <span className="sidebar-collapsed:hidden">{label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-border pt-3 text-sm font-medium">
        {SUPPORT.map(({ href, label, match, external, Icon }) => {
          const active = !external && isActive(match);
          return (
            <Link
              key={href}
              href={href}
              title={label}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition sidebar-collapsed:justify-center ${
                active ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} className="shrink-0" />
              <span className="sidebar-collapsed:hidden">{label}</span>
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
