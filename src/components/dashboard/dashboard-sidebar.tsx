"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  BookOpen,
  Brain,
  CalendarCheck,
  CaretLeft,
  CaretRight,
  CaretUpDown,
  ChartLine,
  ClipboardText,
  ClockCountdown,
  ClockCounterClockwise,
  Compass,
  Database,
  FileText,
  Gear,
  House,
  Lightbulb,
  ListChecks,
  MagnifyingGlass,
  Sparkle,
  SquaresFour,
  UploadSimple,
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
  onOpenSearch?: () => void;
}

interface NavGroup {
  title?: string;
  items: Array<{
    id: string;
    label: string;
    href: string;
    icon: React.ElementType;
    badge?: string;
  }>;
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

  const NAV_GROUPS: NavGroup[] = [
    {
      title: "MAIN",
      items: [
        { id: "dashboard", label: "My DU Desk", href: "/dashboard", icon: SquaresFour },
        { id: "explore", label: "Explore", href: "/browse/college", icon: Compass },
        { id: "subjects", label: "My Subjects", href: "#subjects", icon: BookOpen },
        { id: "search", label: "Search", href: "#search", icon: MagnifyingGlass },
      ],
    },
    {
      title: "STUDY RESOURCES",
      items: [
        { id: "pyqs", label: "Previous-Year Papers", href: "/pyq-notes", icon: ListChecks },
        { id: "notes", label: "Notes", href: "/browse/college", icon: FileText },
        { id: "question-bank", label: "Question Bank", href: "/tools/exam-kit", icon: Database },
        { id: "syllabus", label: "Syllabus", href: "/programs", icon: ClipboardText },
      ],
    },
    {
      title: "PREPARATION",
      items: [
        { id: "practice", label: "Practice Centre", href: "/tools/exam-kit", icon: Brain },
        { id: "intelligence", label: "PYQ Intelligence", href: "/tools/exam-kit", icon: Sparkle, badge: "AI" },
        { id: "planner", label: "Study Planner", href: "#planner", icon: CalendarCheck },
        { id: "progress", label: "Progress", href: "#progress", icon: ChartLine },
        { id: "calendar", label: "Exam Calendar", href: "#calendar", icon: ClockCountdown },
      ],
    },
    {
      title: "PERSONAL",
      items: [
        { id: "saved", label: "Saved", href: "#saved", icon: BookmarkSimple },
        { id: "history", label: "History", href: "#history", icon: ClockCounterClockwise },
        { id: "contributions", label: "Contributions", href: "/feedback", icon: UploadSimple },
        { id: "settings", label: "Settings", href: "#settings", icon: Gear },
      ],
    },
  ];

  return (
    <aside
      className={`relative hidden flex-col border-r border-[#EBECEF] dark:border-gray-800/80 bg-white dark:bg-[#14171E] transition-all duration-300 ease-in-out lg:flex shrink-0 z-40 ${
        collapsed ? "w-20" : "w-[260px]"
      }`}
      aria-label="Dashboard Sidebar"
    >
      {/* Floating Circular Collapse Toggle Button on Border Line */}
      <button
        type="button"
        onClick={onToggleCollapse}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute -right-3.5 top-14 z-50 flex size-7 items-center justify-center rounded-full border border-[#DCE0E8] dark:border-gray-700 bg-white dark:bg-[#1C202A] text-gray-500 hover:text-gray-900 dark:hover:text-white shadow-xs transition-all active:scale-95"
      >
        {collapsed ? <CaretRight size={13} weight="bold" /> : <CaretLeft size={13} weight="bold" />}
      </button>

      {/* Header Dropdown / Title */}
      <div className="flex h-16 items-center justify-between border-b border-[#EBECEF] dark:border-gray-800/80 px-4">
        {!collapsed ? (
          <button
            type="button"
            className="flex w-full items-center justify-between py-1 text-left text-sm font-extrabold text-[#2E3138] dark:text-gray-100 hover:opacity-80 transition-opacity"
          >
            <span className="truncate tracking-tight text-base font-sans">
              {courseName ? `DU: ${courseName}` : "DU: B.Com (Hons.)"}
            </span>
            <CaretUpDown size={15} weight="bold" className="shrink-0 text-gray-400 ml-2" />
          </button>
        ) : (
          <div className="mx-auto font-sans text-base font-black tracking-tighter text-[#3168FF]">DU</div>
        )}
      </div>

      {/* Categorized Navigation List */}
      <div className="flex-1 overflow-y-auto px-3.5 py-4 space-y-6 scrollbar-none">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="space-y-1.5">
            {/* Group Label (Visible only when expanded) */}
            {!collapsed && group.title && (
              <div className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-[#9CA3B0] dark:text-gray-500">
                {group.title}
              </div>
            )}

            <nav className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isAnchor = item.href.startsWith("#");
                const isActive = isAnchor
                  ? activeTab === item.id || (item.id === "dashboard" && activeTab === "dashboard")
                  : pathname === item.href;

                const handleClick = (e: React.MouseEvent) => {
                  if (item.id === "search" && onOpenSearch) {
                    e.preventDefault();
                    onOpenSearch();
                    return;
                  }
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
                    className={`group relative flex items-center gap-3.5 rounded-[12px] h-9 px-3 text-[13.5px] transition-all duration-150 ${
                      isActive
                        ? "bg-[#ECEFF4] text-[#1D2028] dark:bg-[#232732] dark:text-white font-extrabold shadow-2xs"
                        : "text-[#5A606D] dark:text-gray-400 font-semibold hover:bg-[#F4F6F9] dark:hover:bg-gray-800/50 hover:text-gray-900 dark:hover:text-gray-200"
                    } ${collapsed ? "justify-center px-0" : ""}`}
                  >
                    <Icon
                      size={19}
                      weight={isActive ? "bold" : "regular"}
                      className={`shrink-0 transition-colors ${
                        isActive ? "text-[#3168FF] dark:text-blue-400" : "text-[#7B828F] dark:text-gray-400 group-hover:text-[#3168FF]"
                      }`}
                    />
                    {!collapsed && (
                      <span className="truncate flex-1 text-left tracking-tight">{item.label}</span>
                    )}
                    {!collapsed && item.badge && (
                      <span className="ml-auto rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 px-1.5 py-0.5 text-[10px] font-black">
                        {item.badge}
                      </span>
                    )}

                    {/* Tooltip in collapsed mode */}
                    {collapsed && (
                      <span className="absolute left-full ml-4 hidden rounded-lg bg-gray-900 dark:bg-white px-2.5 py-1 text-xs font-bold text-white dark:text-gray-900 shadow-md group-hover:block z-50 whitespace-nowrap pointer-events-none">
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

      {/* Footer Profile Block */}
      <div className="mt-auto border-t border-[#EBECEF] dark:border-gray-800/80 px-3 py-3.5">
        <div className={`flex items-center gap-3 px-2 py-1 ${collapsed ? "justify-center px-0" : ""}`}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[#F2F4F7] dark:bg-[#1F2430] text-gray-500 dark:text-gray-400 border border-gray-200/50 dark:border-gray-700">
            {studentName ? (
              <span className="font-extrabold text-xs text-gray-800 dark:text-gray-200">
                {studentName.slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <User size={18} weight="bold" />
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-black text-[#2E3138] dark:text-gray-200">
                {studentName || "Vinay"}
              </p>
              <Link href="/dashboard" className="text-xs font-bold text-[#3168FF] hover:underline inline-block mt-0.5">
                B.Com (Hons.) Desk
              </Link>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
