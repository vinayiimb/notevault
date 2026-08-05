"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  BookOpen,
  Brain,
  CaretLeft,
  CaretRight,
  CheckSquare,
  Clock,
  Compass,
  FileText,
  Gear,
  ListChecks,
  SignOut,
  SquaresFour,
  Stack,
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

interface NavGroup {
  group: string;
  items: NavItem[];
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

  const NAV_GROUPS: NavGroup[] = [
    {
      group: "Dashboard",
      items: [{ id: "dashboard", label: "Dashboard", href: "/dashboard", icon: SquaresFour }],
    },
    {
      group: "Study",
      items: [
        { id: "subjects", label: "My Subjects", href: "#subjects", icon: BookOpen },
        { id: "notes", label: "Notes", href: "/courses", icon: FileText },
        { id: "pyqs", label: "PYQs", href: "/pyq-notes", icon: ListChecks },
        { id: "syllabus", label: "Syllabus", href: "/programs", icon: Compass },
        { id: "answer-keys", label: "Answer Keys", href: "/courses", icon: CheckSquare },
      ],
    },
    {
      group: "Library",
      items: [
        { id: "saved", label: "Saved", href: "#saved", icon: BookmarkSimple },
        { id: "recent", label: "Recent", href: "#recent", icon: Clock },
      ],
    },
    {
      group: "Practice",
      items: [
        { id: "quiz", label: "Quiz & Flashcards", href: "/tools/exam-kit", icon: Brain, badge: "AI" },
      ],
    },
    {
      group: "Account",
      items: [{ id: "settings", label: "Settings", href: "#settings", icon: Gear }],
    },
  ];

  return (
    <aside
      className={`relative hidden flex-col border-r border-border bg-surface transition-all duration-300 ease-in-out lg:flex ${
        collapsed ? "w-20" : "w-64"
      }`}
      aria-label="Dashboard Sidebar"
    >
      {/* Sidebar Header / Brand */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        <Link href="/" className="flex items-center gap-3 font-display font-bold text-foreground">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
            <Stack size={20} weight="bold" />
          </span>
          {!collapsed && <span className="truncate text-lg tracking-tight">NoteVault</span>}
        </Link>
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="flex size-8 items-center justify-center rounded-lg text-muted hover:bg-surface-muted hover:text-foreground"
        >
          {collapsed ? <CaretRight size={18} weight="bold" /> : <CaretLeft size={18} weight="bold" />}
        </button>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.group}>
            {!collapsed && (
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-wider text-muted/70">
                {group.group}
              </p>
            )}
            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isAnchor = item.href.startsWith("#");
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
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors ${
                      isActive
                        ? "bg-brand-soft text-brand"
                        : "text-muted hover:bg-surface-muted hover:text-foreground"
                    } ${collapsed ? "justify-center" : ""}`}
                  >
                    <Icon size={20} weight={isActive ? "fill" : "bold"} className="shrink-0" />
                    {!collapsed && (
                      <span className="truncate flex-1 text-left">{item.label}</span>
                    )}
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
              })}
            </nav>
          </div>
        ))}
      </div>

      {/* Footer Student Card & Logout */}
      <div className="border-t border-border p-3">
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
