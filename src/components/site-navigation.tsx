"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  ArticleNyTimes,
  BookOpenText,
  Calendar,
  CaretRight,
  ChatCircleText,
  Compass,
  FileArchive,
  Files,
  GraduationCap,
  List,
  NotePencil,
  Question,
  Scroll,
  SealCheck,
  Wrench,
  X,
} from "@phosphor-icons/react";

const NAVIGATION_SECTIONS = [
  {
    title: "Study Portals",
    items: [
      { href: "/pyq-notes", label: "PYQ", desc: "Complete 8,300+ file search catalog", icon: FileArchive, badge: "8.3k+" },
      { href: "/papers", label: "Browse Papers", desc: "Filter by course & subject, preview instantly", icon: BookOpenText, badge: "New" },
      { href: "/pyp", label: "PYP", desc: "DU PYQ Search & Course Archives", icon: SealCheck },
      { href: "/practice", label: "Practice Mode", desc: "Interactive PYQ practice & mock solving", icon: NotePencil, badge: "Live" },
      { href: "/notes", label: "Notes", desc: "Access study notes and summaries", icon: NotePencil },
      { href: "/previous-year-papers", label: "Previous Year Papers", desc: "Download past exams and solution keys", icon: Files },
      { href: "/syllabus", label: "Syllabus", desc: "Browse official DU UGCF syllabus", icon: Scroll },
      { href: "/browse/college", label: "Courses", desc: "Browse Delhi University courses", icon: GraduationCap },
      { href: "/semesters", label: "Semesters", desc: "Find study material from Sem 1 to 6", icon: Calendar },
    ],
  },
  {
    title: "Tools & Utilities",
    items: [
      { href: "/tools", label: "Study Tools & Quiz Lab", desc: "Flashcards, revision & exam kits", icon: Wrench },
      { href: "/blog", label: "Blog", desc: "Exam prep guides & articles", icon: ArticleNyTimes },
      { href: "/resources", label: "Resources", desc: "Every free resource in one place", icon: Compass },
      { href: "/feedback", label: "Feedback & Requests", desc: "Report issues or request papers", icon: ChatCircleText },
      { href: "https://wa.me/919376180015", label: "WhatsApp Support", desc: "Direct DU student helpdesk", icon: Question, external: true },
    ],
  },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  const links = [
    { href: "/pyq-notes", label: "PYQ" },
    { href: "/papers", label: "Papers" },
    { href: "/notes", label: "Notes" },
  ];


  return (
    <nav className="hidden items-center gap-0.5 text-xs lg:text-sm font-medium md:flex" aria-label="Main navigation">
      {links.map((link) => {
        const isActive = pathname === link.href || (link.href !== "/" && pathname.startsWith(link.href));
        const isExternal = (link as any).external || link.href.startsWith("http");

        if (isExternal) {
          return (
            <a
              key={link.href}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex min-h-9 items-center rounded-xl px-2.5 py-1.5 transition-colors text-muted hover:bg-surface-muted hover:text-foreground`}
            >
              {link.label}
            </a>
          );
        }

        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={isActive ? "page" : undefined}
            className={`flex min-h-9 items-center rounded-xl px-2.5 py-1.5 transition-colors ${
              isActive ? "bg-brand-soft text-brand font-semibold" : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
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

      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col bg-background/98 backdrop-blur-lg transition-all duration-200 animate-in fade-in">
            {/* Mobile Drawer Header */}
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-border/70 px-5 bg-surface">
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2 font-display font-bold text-foreground text-lg tracking-tight"
              >
                <Image
                  src="/logo.png"
                  alt="DU PYQ Online Mascot Logo"
                  width={36}
                  height={36}
                  className="size-8.5 rounded-xl object-contain shadow-xs bg-white/90 p-0.5 border border-border/30"
                />
                <span className="font-extrabold font-display">DU PYQ Online</span>
              </Link>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-foreground transition hover:bg-border active:scale-95 shadow-2xs"
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
                  className="flex flex-col justify-between rounded-2xl border border-brand/30 bg-brand-soft/40 p-4 text-brand shadow-2xs active:scale-98 transition"
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
                  className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 text-foreground shadow-2xs active:scale-98 transition"
                >
                  <FileArchive size={24} weight="bold" className="text-accent" />
                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted">8,350+ Files</p>
                    <p className="text-sm font-bold text-foreground">PYQ</p>
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
                href="/pyq-notes"
                onClick={() => setOpen(false)}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-brand-foreground shadow-sm active:scale-98 transition"
              >
                <FileArchive size={18} weight="bold" />
                <span>Explore PYQ</span>
              </Link>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
