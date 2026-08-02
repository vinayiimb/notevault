"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Fire, MagnifyingGlass, User, X } from "@phosphor-icons/react";
import { CurrencyIcon } from "@/components/dashboard/currency-icon";

interface HeaderProps {
  nickname?: string | null;
  termName?: string;
  streak?: number;
  oranges?: number;
  onSearchClick?: () => void;
}

interface Suggestion {
  id: string;
  name: string;
  context: string;
}

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function DashboardHeader({
  nickname,
  termName = "Semester 5",
  streak = 1,
  oranges = 0,
}: HeaderProps) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const greeting = getGreeting();
  const todayDate = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

  // Fetch search suggestions
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search-suggestions?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.results || []);
          setShowDropdown(true);
        }
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside click to close search dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
      setShowDropdown(false);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex flex-col gap-4 border-b border-border bg-surface/90 px-4 py-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        {/* Greeting & Date */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">
              {todayDate}
            </span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl font-display">
            {greeting}, {nickname || "Student"}
          </h1>
          <p className="hidden text-xs text-muted sm:block">
            Ready to continue your {termName} preparation?
          </p>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Daily Streak & Oranges Badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-muted px-3 py-1.5 text-xs font-semibold">
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Fire size={16} weight="fill" />
              <span>{streak}d</span>
            </span>
            <span className="text-border">|</span>
            <span className="flex items-center gap-1 text-brand">
              <CurrencyIcon className="size-4" />
              <span>{oranges}</span>
            </span>
          </div>

          {/* Notifications */}
          <button
            type="button"
            aria-label="Notifications"
            className="flex size-9 items-center justify-center rounded-xl border border-border bg-surface text-muted hover:border-brand hover:text-brand transition-colors"
          >
            <Bell size={18} weight="bold" />
          </button>

          {/* Profile Avatar */}
          <div className="flex size-9 items-center justify-center rounded-full bg-brand text-brand-foreground font-bold text-xs shadow-sm">
            {nickname ? nickname.slice(0, 2).toUpperCase() : <User size={16} weight="bold" />}
          </div>
        </div>
      </div>

      {/* Header Search Field */}
      <div className="relative w-full" ref={dropdownRef}>
        <form onSubmit={handleSearchSubmit} className="relative flex items-center">
          <MagnifyingGlass
            size={18}
            weight="bold"
            className="absolute left-3.5 text-muted pointer-events-none"
          />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              const val = e.target.value;
              setQuery(val);
              if (!val.trim()) {
                setSuggestions([]);
                setShowDropdown(false);
              }
            }}
            onFocus={() => query.trim() && setShowDropdown(true)}
            placeholder="Search subjects, notes, PYQs or topics..."
            className="h-11 w-full rounded-xl border border-border bg-surface-muted pl-10 pr-10 text-sm placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none transition-colors"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSuggestions([]);
                setShowDropdown(false);
              }}
              className="absolute right-3 text-muted hover:text-foreground"
            >
              <X size={16} weight="bold" />
            </button>
          )}
        </form>

        {/* Live Search Suggestions Dropdown */}
        {showDropdown && (suggestions.length > 0 || loading) && (
          <div className="absolute left-0 right-0 top-full mt-2 z-50 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
            {loading ? (
              <div className="p-4 text-center text-xs text-muted">Searching Vault...</div>
            ) : (
              <ul className="divide-y divide-border">
                {suggestions.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={`/subjects/${item.id}`}
                      onClick={() => setShowDropdown(false)}
                      className="flex flex-col gap-0.5 px-4 py-3 hover:bg-brand-soft transition-colors"
                    >
                      <span className="text-sm font-semibold text-foreground">{item.name}</span>
                      <span className="text-xs text-muted">{item.context}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
