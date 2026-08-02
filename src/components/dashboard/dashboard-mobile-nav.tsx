"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  BookOpen,
  Brain,
  CheckSquare,
  Compass,
  FileText,
  Gear,
  House,
  ListChecks,
  List,
  MagnifyingGlass,
  User,
  X,
} from "@phosphor-icons/react";

interface MobileNavProps {
  studentName?: string | null;
  onOpenSearch?: () => void;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

export function DashboardMobileNav({
  studentName,
  onOpenSearch,
  activeTab = "dashboard",
  onSelectTab,
}: MobileNavProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  const primaryItems = [
    { id: "dashboard", label: "Home", href: "/dashboard", icon: House },
    { id: "subjects", label: "Subjects", href: "#subjects", icon: BookOpen },
    { id: "search", label: "Search", href: "#search", icon: MagnifyingGlass, featured: true },
    { id: "saved", label: "Saved", href: "#saved", icon: BookmarkSimple },
    { id: "profile", label: "Menu", href: "#menu", icon: List },
  ];

  const secondaryItems = [
    { label: "Notes", href: "/browse/college", icon: FileText },
    { label: "PYQs", href: "/pyq-notes", icon: ListChecks },
    { label: "Syllabus", href: "/programs", icon: Compass },
    { label: "Answer Keys", href: "/browse/college", icon: CheckSquare },
    { label: "Quiz & Flashcards", href: "/tools/exam-kit", icon: Brain },
    { label: "Settings", href: "#settings", icon: Gear },
  ];

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-border bg-surface px-2 shadow-lg lg:hidden"
        aria-label="Mobile Navigation"
      >
        {primaryItems.map((item) => {
          const Icon = item.icon;
          const isAnchor = item.href.startsWith("#");
          const isActive = isAnchor
            ? activeTab === item.id
            : pathname === item.href;

          const handleClick = (e: React.MouseEvent) => {
            if (item.id === "search" && onOpenSearch) {
              e.preventDefault();
              onOpenSearch();
              return;
            }
            if (item.id === "profile") {
              e.preventDefault();
              setMenuOpen(!menuOpen);
              return;
            }
            if (isAnchor && onSelectTab) {
              e.preventDefault();
              onSelectTab(item.id);
              const el = document.getElementById(item.id);
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }
          };

          if (item.featured) {
            return (
              <button
                key={item.id}
                type="button"
                onClick={handleClick}
                aria-label="Search"
                className="-mt-5 flex size-13 items-center justify-center rounded-full bg-brand text-brand-foreground shadow-md ring-4 ring-background transition-transform active:scale-95"
              >
                <Icon size={24} weight="bold" />
              </button>
            );
          }

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={handleClick}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 text-[11px] font-semibold transition-colors ${
                isActive
                  ? "text-brand"
                  : "text-muted hover:text-foreground"
              }`}
            >
              <Icon size={20} weight={isActive ? "fill" : "bold"} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Drawer Menu for Secondary Links */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md lg:hidden">
          <div className="flex h-16 items-center justify-between border-b border-border px-6">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-brand/10 text-brand font-bold text-sm">
                {studentName ? studentName.slice(0, 2).toUpperCase() : <User size={18} weight="bold" />}
              </div>
              <div>
                <p className="text-sm font-bold">{studentName || "DU Student"}</p>
                <p className="text-xs text-muted">Delhi University Student</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex size-10 items-center justify-center rounded-xl bg-surface-muted text-muted hover:text-foreground"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted">Study Resources</p>
            <div className="grid grid-cols-2 gap-3">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className="flex flex-col gap-2 rounded-xl border border-border bg-surface p-4 hover:border-brand"
                  >
                    <span className="flex size-9 items-center justify-center rounded-lg bg-brand-soft text-brand">
                      <Icon size={20} weight="bold" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
