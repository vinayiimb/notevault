"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import {
  Archive,
  CaretLeft,
  CaretRight,
  ChatCircleText,
  ClockCounterClockwise,
  Exam,
  Headset,
  SquaresFour,
} from "@phosphor-icons/react";
import { SearchBar } from "@/components/search-bar";

const COLLAPSED_KEY = "notevault-sidebar-collapsed";

const NAV = [
  { href: "/courses", label: "PYQ", match: "/courses", Icon: ClockCounterClockwise },
  { href: "/pyq-notes", label: "Full archive", match: "/pyq-notes", Icon: Archive },
  { href: "/dashboard", label: "Dashboard", match: "/dashboard", Icon: SquaresFour },
  { href: "/tools/exam-kit", label: "Exam Kit", match: "/tools/exam-kit", Icon: Exam },
] as const;

const SUPPORT = [
  { href: "/feedback", label: "Feedback", match: "/feedback", external: false, Icon: ChatCircleText },
  { href: "https://wa.me/919376180015", label: "Help", match: "__external__", external: true, Icon: Headset },
] as const;

// Collapse state lives entirely outside React (a class toggled on <html>,
// same trick ThemeToggle uses for dark mode) — not useState. A pre-hydration
// script in src/app/layout.tsx applies the saved class before React ever
// renders, so there's no expanded-then-collapsed flash or hydration
// mismatch to fix; everything below reacts to the class via a
// `sidebar-collapsed:` Tailwind variant (defined in globals.css), so
// toggling never needs to re-render this component at all.
function toggleCollapsed() {
  const next = !document.documentElement.classList.contains("sidebar-collapsed");
  document.documentElement.classList.toggle("sidebar-collapsed", next);
  localStorage.setItem(COLLAPSED_KEY, String(next));
}

// Everything except "Full archive" (still in SiteHeader too) lives here — a
// persistent left rail on desktop, matching how the site-navigation LINKS
// used to be laid out horizontally before. Hidden on mobile: MobileNavMenu
// in site-navigation.tsx already covers small screens with the same links.
export function SiteSidebar() {
  const pathname = usePathname();

  function isActive(match: string) {
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  return (
    <>
      {/* Collapsing takes the sidebar to zero width — not an icon rail — so
          the content area gets the full page. The toggle is `fixed` (not a
          child of the shrinking <aside>) so it stays put and clickable at
          the same spot regardless of the sidebar's current width. */}
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label="Toggle sidebar"
        className="fixed top-8 left-[13.25rem] z-30 hidden size-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-[left] duration-200 hover:text-foreground sidebar-collapsed:left-3 md:flex"
      >
        <CaretLeft aria-hidden="true" size={12} weight="bold" className="sidebar-collapsed:hidden" />
        <CaretRight aria-hidden="true" size={12} weight="bold" className="hidden sidebar-collapsed:block" />
      </button>

      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col overflow-hidden border-r border-border bg-surface p-4 transition-[width,padding,border-width] duration-200 sidebar-collapsed:w-0 sidebar-collapsed:border-r-0 sidebar-collapsed:p-0 md:flex">
        <div className="w-56 shrink-0">
          <Link
            href="/"
            className="mb-4 block px-2 font-display text-lg font-bold tracking-tight text-foreground"
          >
            DU PYQ
          </Link>

          <div className="mb-4">
            <Suspense fallback={<div className="h-11 w-full rounded-xl bg-surface-muted" />}>
              <SearchBar compact />
            </Suspense>
          </div>

          <nav className="flex flex-col gap-1 text-sm font-medium">
            {NAV.map(({ href, label, match, Icon }) => {
              const active = isActive(match);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 transition ${
                    active ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={16} weight={active ? "bold" : "regular"} className="shrink-0" />
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="mt-6 flex flex-col gap-1 border-t border-border pt-3 text-sm font-medium">
            {SUPPORT.map(({ href, label, match, external, Icon }) => {
              const active = !external && isActive(match);
              return (
                <Link
                  key={href}
                  href={href}
                  {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2 transition ${
                    active ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </aside>
    </>
  );
}
