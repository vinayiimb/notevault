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
  CalendarCheck,
  CaretDown,
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
      { href: "/papers", label: "Papers", desc: "Interactive PDF viewer and PYQ archive", icon: BookOpenText },
      { href: "/notes", label: "Notes", desc: "Access study notes and summaries", icon: NotePencil },
    ],
  },
  {
    title: "Student Utilities",
    items: [
      { href: "/tools/action-engine", label: "Action Engine", desc: "Prioritized DU alerts", icon: CalendarCheck },
      { href: "/tools/result-doctor", label: "Result Doctor", desc: "Diagnose marksheet issues", icon: FileArchive },
      { href: "/tools/migration-radar", label: "Migration Radar", desc: "Track college vacancies", icon: Compass },
      { href: "/tools/money-finder", label: "Money Finder", desc: "Master Scholarship Database", icon: Files },
      { href: "/tools/degree-planner", label: "Degree & 4th-Year Planner", desc: "Plan your course credits", icon: GraduationCap },
      { href: "/tools/er-decoder", label: "ER & Improvement Decoder", desc: "Decode ER status", icon: Scroll },
      { href: "/tools/revaluation", label: "Revaluation Hub", desc: "Track Reval dates", icon: SealCheck },
    ],
  },
  {
    title: "Finders & Blogs",
    items: [
      { href: "/tools/du-paper-code-finder", label: "Paper Code Finder", desc: "Find exact UPCs", icon: ArticleNyTimes },
      { href: "/tools/elective-finder", label: "Elective Finder", desc: "Discover SEC/VAC options", icon: List },
      { href: "/blog", label: "Blog", desc: "Latest DU updates", icon: NotePencil },
    ],
  },
  {
    title: "Tools & Support",
    items: [
      { href: "/tools/exam-kit", label: "Exam Kit", desc: "Generate practice questions", icon: Wrench },
      { href: "/feedback", label: "Feedback", desc: "Report issues or request papers", icon: ChatCircleText },
      { href: "https://wa.me/919376180015", label: "Help", desc: "Direct DU student helpdesk", icon: Question, external: true },
    ],
  },
] as const;

export function SiteNavigation() {
  const pathname = usePathname();

  const links = [
    { href: "/papers", label: "Papers" },
    { href: "/notes", label: "Notes" },
  ];

  const others = [
    { href: "/tools/action-engine", label: "Action Engine" },
    { href: "/tools/migration-radar", label: "Migration Radar" },
    { href: "/tools/result-doctor", label: "Result Doctor" },
    { href: "/tools/money-finder", label: "Money Finder" },
    { href: "/tools/du-paper-code-finder", label: "Paper Code Finder" },
    { href: "/tools/elective-finder", label: "Elective Finder" },
    { href: "/tools/degree-planner", label: "Degree & 4th-Year Planner" },
    { href: "/tools/er-decoder", label: "ER & Improvement Decoder" },
    { href: "/tools/revaluation", label: "Revaluation Hub" },
    { href: "/blog", label: "Blog" },
  ];

  const isOthersActive = others.some(item => pathname.startsWith(item.href));

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

      <div className="relative group">
        <button className={`flex min-h-9 items-center gap-1 rounded-xl px-2.5 py-1.5 transition-colors ${
          isOthersActive ? "bg-brand-soft text-brand font-semibold" : "text-muted hover:bg-surface-muted hover:text-foreground"
        }`}>
          Others
          <CaretDown size={14} weight="bold" className="transition-transform group-hover:rotate-180" />
        </button>
        {/* Dropdown Menu */}
        <div className="absolute top-full right-0 mt-1 hidden w-48 flex-col rounded-xl border border-border bg-surface p-1.5 shadow-md group-hover:flex">
          {others.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center rounded-lg px-3 py-2 text-sm transition-colors ${
                  isActive ? "bg-brand-soft text-brand font-semibold" : "text-muted hover:bg-surface-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
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

            </div>,
          document.body
        )}
    </div>
  );
}
