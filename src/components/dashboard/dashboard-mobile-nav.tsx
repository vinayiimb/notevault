"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookmarkSimple,
  BookOpen,
  Brain,
  CalendarCheck,
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
  List,
  MagnifyingGlass,
  Sparkle,
  UploadSimple,
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

  // 5 Primary bottom navigation items as required by Expert Product Plan
  const primaryItems = [
    { id: "dashboard", label: "My Desk", href: "/dashboard", icon: House },
    { id: "subjects", label: "Subjects", href: "#subjects", icon: BookOpen },
    { id: "search", label: "Search", href: "#search", icon: MagnifyingGlass, featured: true },
    { id: "saved", label: "Saved", href: "#saved", icon: BookmarkSimple },
    { id: "menu", label: "Menu", href: "#menu", icon: List },
  ];

  const DRAWER_GROUPS = [
    {
      title: "Study Resources",
      items: [
        { label: "PYQ Papers", href: "/pyq-notes", icon: ListChecks },
        { label: "Notes & Units", href: "/browse/college", icon: FileText },
        { label: "Question Bank", href: "/tools/exam-kit", icon: Database },
        { label: "Official Syllabus", href: "/programs", icon: ClipboardText },
      ],
    },
    {
      title: "Preparation & AI",
      items: [
        { label: "Practice Centre", href: "/tools/exam-kit", icon: Brain },
        { label: "PYQ Intelligence", href: "/tools/exam-kit", icon: Sparkle },
        { label: "Study Planner", href: "#planner", icon: CalendarCheck },
        { label: "Progress Map", href: "#progress", icon: ChartLine },
      ],
    },
    {
      title: "Personal & Account",
      items: [
        { label: "Attempt History", href: "#history", icon: ClockCounterClockwise },
        { label: "Contributions", href: "/feedback", icon: UploadSimple },
        { label: "Explore Courses", href: "/browse/college", icon: Compass },
        { label: "Settings", href: "#settings", icon: Gear },
      ],
    },
  ];

  return (
    <>
      {/* Fixed Bottom Navigation Bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex h-16 items-center justify-around border-t border-[#EAEBF0] dark:border-gray-800 bg-white/95 dark:bg-[#14171E]/95 backdrop-blur-md px-2 shadow-[0_-4px_16px_rgba(0,0,0,0.04)] lg:hidden"
        aria-label="Mobile Navigation"
      >
        {primaryItems.map((item) => {
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
            if (item.id === "menu") {
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
                className="-mt-5 flex size-13 items-center justify-center rounded-full bg-[#3168FF] text-white shadow-lg ring-4 ring-white dark:ring-[#14171E] transition-transform active:scale-95"
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
              className={`flex flex-col items-center gap-1 px-3 py-1 text-[11px] font-bold transition-colors ${
                isActive
                  ? "text-[#3168FF] dark:text-blue-400"
                  : "text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              }`}
            >
              <Icon size={21} weight={isActive ? "fill" : "bold"} />
              <span className="tracking-tight">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Spacious Structured Mobile Drawer Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-[#0E1116] lg:hidden animate-in fade-in duration-200">
          <div className="flex h-16 items-center justify-between border-b border-[#EAEBF0] dark:border-gray-800 px-6 shrink-0 bg-white dark:bg-[#14171E]">
            <div className="flex items-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950 text-[#3168FF] font-black text-sm border border-blue-100 dark:border-blue-900">
                {studentName ? studentName.slice(0, 2).toUpperCase() : <User size={18} weight="bold" />}
              </div>
              <div>
                <p className="text-sm font-extrabold text-gray-900 dark:text-white">{studentName || "Vinay"}</p>
                <p className="text-[11px] font-medium text-gray-500">B.Com (Hons.) &bull; Semester 5</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              className="flex size-10 items-center justify-center rounded-xl bg-[#F4F6F9] dark:bg-[#20232C] text-gray-600 dark:text-gray-300 hover:text-gray-900"
            >
              <X size={20} weight="bold" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-7 pb-24">
            {DRAWER_GROUPS.map((group) => (
              <div key={group.title} className="space-y-3">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-gray-400">
                  {group.title}
                </p>
                <div className="grid grid-cols-2 gap-3.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.label}
                        href={item.href}
                        onClick={() => {
                          setMenuOpen(false);
                          if (item.href.startsWith("#") && onSelectTab) {
                            onSelectTab(item.href.replace("#", ""));
                          }
                        }}
                        className="group flex flex-col gap-3 rounded-[16px] border border-[#EAECEF] dark:border-gray-800 bg-white dark:bg-[#181A20] p-4 shadow-2xs hover:border-[#3168FF] transition-all duration-150"
                      >
                        <span className="flex size-9 items-center justify-center rounded-xl bg-[#F2F4F8] dark:bg-[#20232C] text-gray-600 dark:text-gray-300 group-hover:bg-[#3168FF] group-hover:text-white transition-colors">
                          <Icon size={20} weight="bold" />
                        </span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-[#3168FF] transition-colors">
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
