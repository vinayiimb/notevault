"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import {
  CalendarCheck,
  ChatCircleText,
  ClockCounterClockwise,
  Headset,
  House,
  List,
  ListChecks,
  Notebook,
  SidebarSimple,
  SignOut,
  Stethoscope,
  X,
} from "@phosphor-icons/react";
import { studentLogoutAction } from "@/lib/paid-notes-actions";

// The student dashboard's own frame (AfterBoards-style): a permanent left
// sidebar and a slim top strip, no floating site header, content full width.
// Only /account uses it (see (site)/layout.tsx); every other page keeps the
// normal site header + collapsible sidebar.

const GROUPS = [
  {
    label: null,
    items: [
      { href: "/account", label: "Dashboard", Icon: House, current: true },
      { href: "/account#library", label: "My notes", Icon: Notebook },
      { href: "/account#subjects", label: "My subjects", Icon: ListChecks },
    ],
  },
  {
    label: "Study",
    items: [
      { href: "/papers", label: "PYQ papers", Icon: ClockCounterClockwise },
      { href: "/exam-help/datesheet", label: "Datesheet", Icon: CalendarCheck },
      { href: "/tools/result-doctor", label: "Result doctor", Icon: Stethoscope },
    ],
  },
] as const;

const SUPPORT = [
  { href: "/feedback", label: "Feedback", Icon: ChatCircleText, external: false },
  { href: "https://wa.me/919376180015", label: "Help on WhatsApp", Icon: Headset, external: true },
] as const;

const itemClass = (active: boolean) =>
  `flex min-h-11 items-center gap-3 rounded-[14px] px-3 text-[15px] font-medium transition ${
    active ? "bg-brand/10 font-semibold text-brand" : "text-foreground/80 hover:bg-foreground/[0.06] hover:text-foreground"
  }`;

export function AccountShell({
  name,
  email,
  streak,
  feathers,
  children,
}: {
  name: string;
  email: string;
  streak: number;
  feathers: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false); // phone drawer
  const [collapsed, setCollapsed] = useState(false); // desktop

  const logo = (
    <Link href="/" aria-label="DU PYQ Online home" className="flex shrink-0 items-center gap-1.5">
      <Image src="/mascot.webp" alt="" width={480} height={435} priority className="h-9 w-auto" />
      <span className="flex flex-col text-[15px] font-extrabold leading-[0.95] tracking-[-0.02em]">
        <span>DU</span>
        <span>PYQ</span>
      </span>
    </Link>
  );

  return (
    <div className="flex min-h-screen w-full">
      {open && <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-40 bg-black/40 lg:hidden" />}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] shrink-0 -translate-x-full flex-col border-r border-foreground/[0.08] bg-surface px-3 pb-3 pt-4 transition-transform duration-300 ease-[var(--ease-apple)] lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          open ? "translate-x-0" : ""
        } ${collapsed ? "lg:hidden" : ""}`}
      >
        <div className="flex items-center justify-between px-2">
          {logo}
          <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-foreground/[0.06] lg:hidden">
            <X size={18} weight="bold" />
          </button>
        </div>

        <nav aria-label="Dashboard" className="mt-5 flex-1 overflow-y-auto">
          {GROUPS.map((g, gi) => (
            <div key={gi} className={gi ? "mt-5" : ""}>
              {g.label && <p className="px-3 pb-1.5 text-xs font-semibold uppercase tracking-[0.07em] text-muted">{g.label}</p>}
              <ul className="flex flex-col gap-0.5">
                {g.items.map(({ href, label, Icon, ...rest }) => {
                  const active = "current" in rest;
                  return (
                    <li key={href}>
                      <Link href={href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                        <Icon size={20} weight={active ? "fill" : "regular"} className="shrink-0" />
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="border-t border-foreground/[0.08] pt-3">
          <ul className="flex flex-col gap-0.5">
            {SUPPORT.map(({ href, label, Icon, external }) => (
              <li key={href}>
                <Link href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className={itemClass(false)}>
                  <Icon size={20} className="shrink-0" />
                  {label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3 rounded-[16px] bg-foreground/[0.05] p-2.5">
            <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-[#3fa0ff] to-[#0071e3] text-[15px] font-semibold text-white">
              {name.charAt(0)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold leading-tight">{name}</span>
              <span className="block truncate text-xs text-muted">{email}</span>
            </span>
            <form action={studentLogoutAction}>
              <button type="submit" aria-label="Sign out" className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-foreground/[0.08] hover:text-foreground">
                <SignOut size={18} weight="bold" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Slim top strip: sidebar toggle on the left, your numbers on the right. */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-foreground/[0.08] bg-surface/80 px-3 backdrop-blur-xl sm:px-5">
          <button
            type="button"
            onClick={() => (window.matchMedia("(min-width: 1024px)").matches ? setCollapsed((c) => !c) : setOpen(true))}
            aria-label="Toggle sidebar"
            className="flex size-10 items-center justify-center rounded-full text-muted transition hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <SidebarSimple size={20} className="hidden lg:block" />
            <List size={22} className="lg:hidden" />
          </button>
          <span className="lg:hidden">{logo}</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground/[0.06] px-3 text-sm font-semibold tabular-nums" title="Day streak">
              <span aria-hidden>🔥</span>
              {streak}
            </span>
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 text-sm font-semibold tabular-nums text-emerald-700 dark:text-emerald-300" title="Feathers">
              <span aria-hidden>🪶</span>
              {new Intl.NumberFormat("en-IN").format(feathers)}
            </span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
