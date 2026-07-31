"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  ChatCircleText,
  FileText,
  Headset,
  SquaresFour,
  Wrench,
} from "@phosphor-icons/react";

const COLLAPSED_KEY = "notevault-sidebar-collapsed";

const NAV = [
  { href: "/browse/college", label: "PYQ", match: "/browse", Icon: FileText },
  { href: "/exam-sessions", label: "Question Papers", match: "/exam-sessions", Icon: CalendarBlank },
  { href: "/tools", label: "Tools", match: "/tools", Icon: Wrench },
  { href: "/dashboard", label: "Dashboard", match: "/dashboard", Icon: SquaresFour },
] as const;

const SUPPORT = [
  { href: "/feedback", label: "Feedback", match: "/feedback", external: false, Icon: ChatCircleText },
  { href: "https://wa.me/919376180015", label: "Help", match: "__external__", external: true, Icon: Headset },
] as const;

// Everything except "Full archive" (still in SiteHeader) lives here — a
// persistent left rail on desktop, matching how the site-navigation LINKS
// used to be laid out horizontally before. Hidden on mobile: MobileNavMenu
// in site-navigation.tsx already covers small screens with the same links.
function readStoredCollapsed() {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COLLAPSED_KEY) === "true";
}

export function SiteSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(readStoredCollapsed);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current;
      localStorage.setItem(COLLAPSED_KEY, String(next));
      return next;
    });
  }

  function isActive(match: string) {
    return pathname === match || pathname.startsWith(`${match}/`);
  }

  return (
    <aside
      className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-border bg-surface p-4 transition-[width] duration-200 md:flex ${
        collapsed ? "w-[4.5rem]" : "w-56"
      }`}
    >
      <button
        type="button"
        onClick={toggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="absolute top-8 -right-3 z-10 flex size-6 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition hover:text-foreground"
      >
        {collapsed ? (
          <CaretRight aria-hidden="true" size={12} weight="bold" />
        ) : (
          <CaretLeft aria-hidden="true" size={12} weight="bold" />
        )}
      </button>

      <nav className="flex flex-1 flex-col gap-1 text-sm font-medium">
        {NAV.map(({ href, label, match, Icon }) => {
          const active = isActive(match);
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition ${collapsed ? "justify-center" : ""} ${
                active ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} weight={active ? "bold" : "regular"} />
              {!collapsed && label}
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
              title={collapsed ? label : undefined}
              {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-2 rounded-lg px-2 py-2 transition ${collapsed ? "justify-center" : ""} ${
                active ? "bg-brand-soft text-brand" : "text-foreground/80 hover:bg-surface-muted hover:text-foreground"
              }`}
            >
              <Icon size={16} />
              {!collapsed && label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
