"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, List, X } from "@phosphor-icons/react";

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

// SiteNavigation above is `hidden md:flex` — below that breakpoint "PYQ",
// "Full archive", "Question Papers", and "Tools" had no way to be reached at
// all (only the Dashboard icon showed). This is the phone-sized stand-in:
// a menu button that reveals the same LINKS in a dropdown.
export function MobileNavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        className="flex size-10 shrink-0 items-center justify-center rounded-xl text-muted transition hover:bg-surface-muted hover:text-foreground"
      >
        {open ? <X size={18} weight="bold" /> : <List size={18} weight="bold" />}
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute top-[calc(100%+0.5rem)] right-0 z-50 flex w-56 flex-col gap-0.5 rounded-2xl border border-border bg-surface p-2 shadow-[0_12px_32px_rgba(0,0,0,.12)]">
            {LINKS.map((link) => {
              const active = pathname === link.href || pathname.startsWith(`${link.match}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${
                    active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-muted hover:text-foreground"
                  }`}
                >
                  {"icon" in link && link.icon && <ChartBar size={16} weight="bold" />}
                  {link.label}
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
