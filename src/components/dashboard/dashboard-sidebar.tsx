"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { SearchBar } from "@/components/search-bar";
import {
  BookmarkSimple,
  BookOpen,
  Brain,
  CaretLeft,
  CaretRight,
  CheckSquare,
  ChatCircleText,
  Clock,
  Compass,
  FileText,
  ListChecks,
  Question,
  SignOut,
  SquaresFour,
  User,
} from "@phosphor-icons/react";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  studentName?: string | null;
  courseName?: string;
  termName?: string;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  badge?: string;
}

export function DashboardSidebar({
  collapsed,
  onToggleCollapse,
  studentName,
  courseName,
  termName,
  activeTab = "dashboard",
  onSelectTab,
}: SidebarProps) {
  const pathname = usePathname();

  // Flat list — every item gets identical spacing/weight so the sidebar
  // reads as one consistent nav instead of unevenly-sized groups.
  const NAV_ITEMS: NavItem[] = [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: SquaresFour },
    { id: "subjects", label: "My Subjects", href: "#subjects", icon: BookOpen },
    { id: "pyqs", label: "PYQs", href: "/pyq-notes", icon: ListChecks },
    { id: "notes", label: "Notes", href: "/browse/college", icon: FileText },
    { id: "syllabus", label: "Syllabus", href: "/programs", icon: Compass },
    { id: "answer-keys", label: "Answer Keys", href: "/browse/college", icon: CheckSquare },
    { id: "saved", label: "Saved", href: "#saved", icon: BookmarkSimple },
    { id: "recent", label: "Recent", href: "#recent", icon: Clock },
    { id: "quiz", label: "Quiz & Flashcards", href: "/tools/exam-kit", icon: Brain, badge: "AI" },
  ];

  const UTILITY_ITEMS: NavItem[] = [
    { id: "feedback", label: "Feedback", href: "/feedback", icon: ChatCircleText },
    { id: "help", label: "Help", href: "https://wa.me/919376180015", icon: Question },
  ];

  const renderNavLink = (item: NavItem) => {
    const Icon = item.icon;
    const isAnchor = item.href.startsWith("#");
    const isExternal = item.href.startsWith("http");
    const isActive = isAnchor
      ? activeTab === item.id
      : pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));

    const handleClick = (e: React.MouseEvent) => {
      if (isAnchor && onSelectTab) {
        e.preventDefault();
        onSelectTab(item.id);
        const el = document.getElementById(item.id);
        if (el) el.scrollIntoView({ behavior: "smooth" });
      }
    };

    return (
      <Link
        key={item.id}
        href={item.href}
        onClick={handleClick}
        title={collapsed ? item.label : undefined}
        aria-current={isActive ? "page" : undefined}
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className={`group relative flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors ${
          isActive
            ? "bg-brand-soft text-brand"
            : "text-muted hover:bg-surface-muted hover:text-foreground"
        } ${collapsed ? "justify-center" : ""}`}
      >
        <Icon size={19} weight={isActive ? "fill" : "regular"} className="shrink-0" />
        {!collapsed && <span className="truncate flex-1 text-left">{item.label}</span>}
        {!collapsed && item.badge && (
          <span className="rounded-md bg-brand/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand">
            {item.badge}
          </span>
        )}

        {/* Tooltip on collapsed state */}
        {collapsed && (
          <span className="absolute left-full ml-3 hidden rounded-lg bg-foreground px-2.5 py-1 text-xs font-medium text-background shadow-md group-hover:block z-50 whitespace-nowrap">
            {item.label}
          </span>
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`relative hidden flex-col border-r border-border bg-surface transition-all duration-300 ease-in-out lg:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
      aria-label="Dashboard Sidebar"
    >
      {/* Sidebar Header / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex min-w-0 items-center">
          {collapsed ? (
            <div className="relative size-9 shrink-0 overflow-hidden rounded-lg">
              <Image
                src="/logo.png"
                alt="DU PYQ Online"
                fill
                sizes="36px"
                className="object-cover object-left"
              />
            </div>
          ) : (
            <Image
              src="/logo.png"
              alt="DU PYQ Online"
              width={1024}
              height={577}
              className="h-10 w-auto object-contain"
            />
          )}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        >
          {collapsed ? <CaretRight size={18} weight="bold" /> : <CaretLeft size={18} weight="bold" />}
        </button>
      </div>

      {/* Search */}
      {!collapsed && (
        <div className="border-b border-border px-3 py-3">
          <Suspense fallback={<div className="h-[42px] w-full" />}>
            <SearchBar compact />
          </Suspense>
        </div>
      )}

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-3">
        <nav className="space-y-1">{NAV_ITEMS.map(renderNavLink)}</nav>
      </div>

      {/* Utility Links + Footer Student Card */}
      <div className="border-t border-border p-3">
        <nav className="space-y-1 pb-3">{UTILITY_ITEMS.map(renderNavLink)}</nav>

        <div
          className={`flex items-center gap-3 rounded-xl bg-surface-muted p-2.5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand font-semibold">
            {studentName ? studentName.slice(0, 2).toUpperCase() : <User size={18} weight="bold" />}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">
                {studentName || "DU Student"}
              </p>
              <p className="truncate text-[11px] text-muted">
                {courseName || "B.Com (Hons)"} {termName ? `· ${termName}` : ""}
              </p>
            </div>
          )}
        </div>
        <Link
          href="/"
          title={collapsed ? "Logout / Home" : undefined}
          className={`mt-2 flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-semibold text-muted hover:bg-surface-muted hover:text-red-500 transition-colors ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <SignOut size={18} weight="bold" />
          {!collapsed && <span>Logout / Exit</span>}
        </Link>
      </div>
    </aside>
  );
}
