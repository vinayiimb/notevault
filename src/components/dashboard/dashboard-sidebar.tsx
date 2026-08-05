"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  CaretLeft,
  CaretRight,
  CaretUpDown,
  ChartLine,
  ChatCircleDots,
  ClockCounterClockwise,
  Headphones,
  MagnifyingGlass,
  PlayCircle,
  Smiley,
  SquaresFour,
  User,
  UserFocus,
  Wrench,
} from "@phosphor-icons/react";

interface SidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  studentName?: string | null;
  courseName?: string;
  termName?: string;
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  onOpenSearch?: () => void;
}

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
  hasChevron?: boolean;
}

export function DashboardSidebar({
  collapsed,
  onToggleCollapse,
  studentName,
  courseName,
  activeTab = "dashboard",
  onSelectTab,
  onOpenSearch,
}: SidebarProps) {
  const pathname = usePathname();

  const NAV_ITEMS: NavItem[] = [
    { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: SquaresFour },
    { id: "videos", label: "Videos", href: "/browse/college", icon: PlayCircle },
    { id: "practice", label: "Practice", href: "#subjects", icon: BookOpen, hasChevron: true },
    { id: "past-papers", label: "Past Papers", href: "/pyq-notes", icon: ClockCounterClockwise, hasChevron: true },
    { id: "analyse", label: "Analyse", href: "#recent", icon: ChartLine, hasChevron: true },
    { id: "forum", label: "Forum", href: "/feedback", icon: ChatCircleDots, hasChevron: true },
    { id: "interview", label: "Interview", href: "/browse/college", icon: UserFocus, hasChevron: true },
    { id: "tools", label: "Tools", href: "/tools/exam-kit", icon: Wrench, hasChevron: true },
  ];

  return (
    <aside
      className={`relative hidden flex-col border-r border-[#EBECEF] dark:border-gray-800/80 bg-white dark:bg-[#14171E] transition-all duration-300 ease-in-out lg:flex ${
        collapsed ? "w-20" : "w-[230px]"
      }`}
      aria-label="Dashboard Sidebar"
    >
      {/* Floating Circular Collapse Toggle Button on Border line */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3.5 top-14 z-40 flex size-7 items-center justify-center rounded-full border border-[#DCE0E8] dark:border-gray-700 bg-white dark:bg-[#1C202A] text-gray-500 hover:text-gray-800 dark:hover:text-white shadow-xs transition-all active:scale-95"
      >
        {collapsed ? <CaretRight size={13} weight="bold" /> : <CaretLeft size={13} weight="bold" />}
      </button>

      {/* Program Selector Header Dropdown */}
      <div className="flex h-12 items-center justify-between border-b border-[#EBECEF] dark:border-gray-800/80 px-4.5">
        {!collapsed ? (
          <button
            type="button"
            className="flex w-full items-center justify-between py-1 text-left text-sm font-bold text-[#2E3138] dark:text-gray-100 hover:opacity-80 transition-opacity"
          >
            <span className="truncate tracking-tight font-sans">
              {courseName ? `DU: ${courseName}` : "DU: UG & PG"}
            </span>
            <CaretUpDown size={15} weight="bold" className="shrink-0 text-gray-400 ml-2" />
          </button>
        ) : (
          <div className="mx-auto font-sans text-base font-extrabold text-[#2E3138] dark:text-gray-100">DU</div>
        )}
      </div>

      {/* Search Input Bar */}
      <div className="p-3.5">
        {!collapsed ? (
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex w-full h-9 items-center justify-between rounded-[10px] border border-[#E2E5EC] dark:border-gray-700/80 bg-white dark:bg-[#1A1D24] px-3 text-xs text-gray-400 dark:text-gray-500 hover:border-gray-300 dark:hover:border-gray-600 transition-all shadow-2xs"
          >
            <div className="flex items-center gap-2">
              <MagnifyingGlass size={15} weight="bold" className="text-gray-400 dark:text-gray-500" />
              <span className="text-gray-500 dark:text-gray-400 font-normal">Find...</span>
            </div>
            <kbd className="rounded-md border border-[#E2E5EC] dark:border-gray-700 bg-[#FAFAFC] dark:bg-gray-800 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:text-gray-300">
              ⌘K
            </kbd>
          </button>
        ) : (
          <button
            type="button"
            onClick={onOpenSearch}
            title="Search (⌘K)"
            className="flex size-9 items-center justify-center rounded-[10px] border border-[#E2E5EC] dark:border-gray-700 bg-white dark:bg-[#1A1D24] text-gray-500 hover:text-gray-800 dark:hover:text-white mx-auto shadow-2xs"
          >
            <MagnifyingGlass size={16} weight="bold" />
          </button>
        )}
      </div>

      {/* Main Navigation Items List */}
      <div className="flex-1 overflow-y-auto px-3 space-y-1">
        <nav className="space-y-1">
          {NAV_ITEMS.map((item) => {
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
                className={`group relative flex items-center gap-3.5 rounded-[10px] h-9 px-3 text-sm transition-colors ${
                  isActive
                    ? "bg-[#EBECEF] text-[#2E3138] dark:bg-[#232732] dark:text-white font-bold"
                    : "text-[#515560] dark:text-gray-400 font-medium hover:bg-[#F3F5F9] dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon size={18} weight={isActive ? "bold" : "regular"} className="shrink-0 text-current" />
                {!collapsed && (
                  <span className="truncate flex-1 text-left tracking-[0.01em]">{item.label}</span>
                )}
                {!collapsed && item.hasChevron && (
                  <CaretRight size={13} weight="bold" className="shrink-0 text-gray-400/80 ml-auto" />
                )}

                {/* Tooltip on collapsed state */}
                {collapsed && (
                  <span className="absolute left-full ml-3 hidden rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1 text-xs font-semibold text-white dark:text-gray-900 shadow-md group-hover:block z-50 whitespace-nowrap">
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Links & User Profile Section */}
      <div className="mt-auto px-3 py-3 space-y-1">
        {/* Feedback & Help links */}
        <Link
          href="/feedback"
          className={`flex items-center gap-3.5 rounded-[10px] h-9 px-3 text-sm font-medium text-[#515560] dark:text-gray-400 hover:bg-[#F3F5F9] dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200 transition-colors ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Smiley size={18} className="shrink-0 text-current" />
          {!collapsed && <span>Feedback</span>}
        </Link>
        <Link
          href="/feedback"
          className={`flex items-center gap-3.5 rounded-[10px] h-9 px-3 text-sm font-medium text-[#515560] dark:text-gray-400 hover:bg-[#F3F5F9] dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200 transition-colors ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Headphones size={18} className="shrink-0 text-current" />
          {!collapsed && <span>Help</span>}
        </Link>

        {/* Separator Line */}
        <div className="py-2">
          <div className="h-px bg-[#EBECEF] dark:bg-gray-800/80 w-full" />
        </div>

        {/* Profile Card Widget */}
        <div
          className={`flex items-center gap-3 px-2 py-1 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F2F4F7] dark:bg-[#1F2430] text-gray-500 dark:text-gray-400">
            {studentName ? (
              <span className="font-bold text-xs">{studentName.slice(0, 2).toUpperCase()}</span>
            ) : (
              <User size={18} />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-extrabold text-[#2E3138] dark:text-gray-200">
                {studentName || "Guest"}
              </p>
              <Link href="/dashboard" className="text-[12px] font-semibold text-[#3168FF] hover:underline inline-block mt-0.5">
                {studentName ? "My Account" : "Sign Up"}
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
