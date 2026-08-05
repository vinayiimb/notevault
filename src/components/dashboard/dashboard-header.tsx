"use client";

import { Bell, Fire, List, SidebarSimple } from "@phosphor-icons/react";
import Link from "next/link";

interface HeaderProps {
  nickname?: string | null;
  termName?: string;
  streak?: number;
  oranges?: number;
  onOpenMobileSidebar?: () => void;
  onOpenSearch?: () => void;
  onToggleCollapse?: () => void;
}

export function DashboardHeader({
  streak = 0,
  onOpenMobileSidebar,
  onToggleCollapse,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-[#EAEBF0] dark:border-gray-800/80 bg-white dark:bg-[#14171E] px-4 sm:px-6">
      {/* Left Area: Sidebar / Toggle Trigger */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 lg:hidden transition-colors"
          aria-label="Open navigation menu"
        >
          <List size={20} weight="bold" />
        </button>
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden lg:flex size-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          title="Toggle Sidebar"
        >
          <SidebarSimple size={18} />
        </button>
        <Link href="/" className="font-sans font-extrabold text-base text-gray-900 dark:text-white lg:hidden">
          DU
        </Link>
      </div>

      {/* Right Top Header Actions */}
      <div className="flex items-center gap-4 ml-auto">
        {/* Notification Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
        >
          <Bell size={19} />
        </button>

        {/* Streak Flame Counter Badge */}
        <div className="flex items-center gap-1.5 rounded-md border border-[#E2E5EC] dark:border-gray-700/80 bg-white dark:bg-[#1C202A] px-2.5 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-2xs">
          <Fire size={14} weight="fill" className="text-[#FFB524]" />
          <span>{streak}</span>
        </div>
      </div>
    </header>
  );
}
