"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpenText,
  CaretRight,
  ChartBar,
  ChatCircleText,
  FileArchive,
  Files,
  GraduationCap,
  House,
  List,
  MagnifyingGlass,
  Question,
  ShieldCheck,
  Sparkle,
  Wrench,
  X,
} from "@phosphor-icons/react";

const NAVIGATION_SECTIONS = [
  {
    title: "Core Student Portals",
    items: [
      { href: "/dashboard", label: "Student Dashboard", desc: "Personalized course hub & saved notes", icon: GraduationCap, badge: "New UI" },
      { href: "/pyq-notes", label: "Full Archive (8,350+ Files)", desc: "Complete paper & notes catalog", icon: FileArchive, badge: "8.3k+" },
      { href: "/admin/master-syllabus", label: "Official Master Syllabus", desc: "21 degree programs with 0% deviation", icon: BookOpenText, badge: "Official" },
      { href: "/exam-sessions", label: "Session Question Papers", desc: "Browse by exam year & drive links", icon: Files },
    ],
  },
  {
    title: "Tools & Utilities",
    items: [
      { href: "/tools", label: "Study Tools & Quiz Lab", desc: "Flashcards, revision & exam kits", icon: Wrench },
      { href: "/feedback", label: "Feedback & Requests", desc: "Report issues or request papers", icon: ChatCircleText },
      { href: "https://wa.me/919376180015", label: "WhatsApp Support", desc: "Direct DU student helpdesk", icon: Question, external: true },
    ],
  },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();
  const active = pathname === "/pyq-notes" || pathname.startsWith("/pyq-notes/");

  return (
    <nav className="hidden items-center gap-1 text-sm font-medium md:flex" aria-label="Main navigation">
      <Link
        href="/pyq-notes"
        aria-current={active ? "page" : undefined}
        className={`flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 ${
          active ? "bg-brand-soft text-brand" : "text-muted hover:bg-surface-muted hover:text-foreground"
        }`}
      >
        Full archive
      </Link>
      <Link
        href="/admin/master-syllabus"
        className="flex min-h-10 items-center gap-1.5 rounded-xl px-3 py-2 text-muted hover:bg-surface-muted hover:text-foreground"
      >
        Master Syllabus
      </Link>
    </nav>
  );
}

export function MobileNavMenu() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Prevent background scroll when mobile drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open mobile navigation menu"
        className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-foreground transition hover:bg-border active:scale-95 shadow-sm"
      >
        <List size={20} weight="bold" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md transition-all duration-200 animate-in fade-in">
          {/* Mobile Drawer Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-5">
            <Link
              href="/"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 font-display font-bold text-foreground text-lg"
            >
              <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
                <GraduationCap size={18} weight="bold" />
              </span>
              <span>NoteVault</span>
            </Link>

            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-foreground transition hover:bg-border active:scale-95"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          {/* Quick Action Navigation Grid */}
          <div className="flex-1 overflow-y-auto p-5 space-y-6">
            {/* Quick Hero Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/dashboard"
                onClick={() => setOpen(false)}
                className="flex flex-col justify-between rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 text-brand shadow-sm active:scale-98 transition"
              >
                <GraduationCap size={24} weight="bold" />
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand/80">Student</p>
                  <p className="text-sm font-bold text-foreground">Dashboard</p>
                </div>
              </Link>

              <Link
                href="/pyq-notes"
                onClick={() => setOpen(false)}
                className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 text-foreground shadow-sm active:scale-98 transition"
              >
                <FileArchive size={24} weight="bold" className="text-accent" />
                <div className="mt-3">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted">8,350+ Files</p>
                  <p className="text-sm font-bold text-foreground">Full Archive</p>
                </div>
              </Link>
            </div>

            {/* Menu Links by Section */}
            {NAVIGATION_SECTIONS.map((section) => (
              <div key={section.title} className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-wider text-muted">
                  {section.title}
                </p>
                <div className="space-y-1.5">
                  {section.items.map((item) => {
                    const isExternal = "external" in item && item.external;
                    const active = !isExternal && (pathname === item.href || pathname.startsWith(`${item.href}/`));
                    const Icon = item.icon;

                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center justify-between rounded-2xl border p-3.5 transition active:scale-98 ${
                          active
                            ? "border-brand bg-brand-soft/60 text-brand shadow-sm font-bold"
                            : "border-border/60 bg-surface text-foreground hover:border-border"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${
                            active ? "bg-brand text-brand-foreground" : "bg-surface-muted text-muted"
                          }`}>
                            <Icon size={18} weight="bold" />
                          </span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-foreground">{item.label}</span>
                              {"badge" in item && item.badge && (
                                <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                                  {item.badge}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted leading-tight">{item.desc}</p>
                          </div>
                        </div>
                        <CaretRight size={16} weight="bold" className="text-muted shrink-0" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile Footer Quick Action */}
          <div className="border-t border-border bg-surface p-4 text-center">
            <Link
              href="/admin/master-syllabus"
              onClick={() => setOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-bold text-accent-foreground shadow-sm active:scale-98 transition"
            >
              <ShieldCheck size={18} weight="bold" />
              <span>Explore Master Syllabus Portal</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
