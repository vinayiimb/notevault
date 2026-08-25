"use client";

import React from "react";
import Link from "next/link";
import { FilterState } from "@/lib/upsc-data";

interface TopHeaderProps {
  filters: FilterState;
  onFilterChange: (updates: Partial<FilterState>) => void;
  totalFiltered: number;
  totalAll: number;
  bookmarkedCount: number;
  focusMode: boolean;
  onToggleFocusMode: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  filters,
  onFilterChange,
  totalFiltered,
  totalAll,
  bookmarkedCount,
  focusMode,
  onToggleFocusMode,
}) => {
  return (
    <header className="border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Branding & Breadcrumb */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-white font-bold text-xl shadow-sm">
            🏛️
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-lg text-foreground tracking-tight">
                UPSC PYQ Vault
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                CSE Prelims 2013–2025
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Exact authentic transcription with topic-wise solutions & practice mode
            </p>
          </div>
        </div>

        {/* Center: Global Search Bar */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <svg
              className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search by topic, article, keyword or Act..."
              value={filters.searchQuery}
              onChange={(e) => onFilterChange({ searchQuery: e.target.value })}
              className="w-full pl-9 pr-8 py-2 text-sm bg-muted/60 hover:bg-muted focus:bg-background border border-border/80 rounded-lg outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 transition-all text-foreground placeholder:text-muted-foreground"
            />
            {filters.searchQuery && (
              <button
                onClick={() => onFilterChange({ searchQuery: "" })}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground p-1"
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Right: Quick actions & Stats */}
        <div className="flex items-center gap-2">
          {/* Bookmarks quick button */}
          <button
            onClick={() =>
              onFilterChange({
                attemptStatus:
                  filters.attemptStatus === "bookmarked" ? "all" : "bookmarked",
              })
            }
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filters.attemptStatus === "bookmarked"
                ? "bg-amber-500 text-white border-amber-600"
                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
            }`}
            title="View bookmarked questions"
          >
            <span>🔖</span>
            <span>Saved ({bookmarkedCount})</span>
          </button>

          {/* Focus Mode Toggle */}
          <button
            onClick={onToggleFocusMode}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              focusMode
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground border-border"
            }`}
            title="Toggle Focus Mode [F]"
          >
            <span>{focusMode ? "🔍 Normal" : "🎯 Focus"}</span>
          </button>

          {/* Question Count Badge */}
          <div className="text-xs px-2.5 py-1.5 rounded-lg bg-muted text-muted-foreground font-mono hidden sm:block">
            <span className="font-semibold text-foreground">{totalFiltered}</span>
            <span className="text-muted-foreground/60"> / {totalAll} Qs</span>
          </div>
        </div>
      </div>
    </header>
  );
};
