"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar } from "@phosphor-icons/react";

const LINKS = [
  { href: "/browse/college", label: "PYQ", match: "/browse" },
  { href: "/pyq-notes", label: "Full archive", match: "/pyq-notes" },
  { href: "/exam-sessions", label: "Question Papers", match: "/exam-sessions" },
  { href: "/tools", label: "Tools", match: "/tools" },
  { href: "/dashboard", label: "Dashboard", match: "/dashboard", icon: true },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="Main navigation">
      {LINKS.map((link) => {
        const active = pathname === link.href || pathname.startsWith(`${link.match}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 ${
              active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {"icon" in link && link.icon && <ChartBar size={16} weight="bold" />}
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileDashboardLink() {
  const pathname = usePathname();
  const active = pathname.startsWith("/dashboard");

  return (
    <Link
      href="/dashboard"
      aria-label="Open dashboard"
      aria-current={active ? "page" : undefined}
      className={`flex size-10 shrink-0 items-center justify-center rounded-xl md:hidden ${
        active ? "bg-brand text-brand-foreground" : "bg-brand-soft text-brand hover:bg-brand hover:text-brand-foreground"
      }`}
    >
      <ChartBar size={18} weight="bold" />
    </Link>
  );
}
