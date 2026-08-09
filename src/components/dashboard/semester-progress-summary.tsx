"use client";

import Link from "next/link";
import { ArrowRight, Fire, Trophy } from "@phosphor-icons/react";
import { CurrencyIconDisplay } from "@/components/dashboard/currency-icon-display";
const DAILY_TARGET_ORANGES = 50;

interface ProgressSummaryProps {
  todayOranges?: number;
  streak?: number;
  totalOranges?: number;
  communityTotal?: number;
  subjectCount?: number;
  currencyIconUrl?: string | null;
}

export function SemesterProgressSummary({
  todayOranges = 0,
  streak = 1,
  totalOranges = 0,
  communityTotal = 0,
  subjectCount = 6,
  currencyIconUrl = null,
}: ProgressSummaryProps) {
  const progressPct = Math.min(100, Math.round((todayOranges / DAILY_TARGET_ORANGES) * 100));

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm" aria-labelledby="semester-progress-title">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        {/* Left Side: Daily Target Circular Ring */}
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
          <div
            className="grid size-32 shrink-0 place-items-center rounded-full p-2.5 shadow-inner"
            style={{
              background: `conic-gradient(var(--brand) ${progressPct}%, var(--surface-muted) ${progressPct}% 100%)`,
            }}
          >
            <div className="grid size-full place-items-center rounded-full bg-surface text-center shadow-sm">
              <div>
                <span className="block font-mono text-2xl font-bold tabular-nums text-foreground">{progressPct}%</span>
                <span className="block text-[10px] text-muted uppercase font-bold tracking-wider">Goal</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 max-w-md">
            <span className="text-xs font-bold uppercase tracking-wider text-brand">Daily Study Goal</span>
            <h3 id="semester-progress-title" className="text-xl font-bold font-display text-foreground leading-tight">
              {progressPct >= 100 ? "Daily target cleared! Keep going." : "Your next paper reading moves the ring."}
            </h3>
            <p className="text-xs text-muted leading-relaxed">
              Earned <strong className="text-foreground">{todayOranges}</strong> of {DAILY_TARGET_ORANGES} oranges today across {subjectCount} subjects.
            </p>
          </div>
        </div>

        {/* Right Side: Small Stat Cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="flex flex-col justify-between rounded-xl bg-surface-muted p-4 border border-border/40">
            <span className="text-amber-500 font-bold">
              <Fire size={20} weight="fill" />
            </span>
            <div className="mt-2">
              <span className="block font-mono text-xl font-bold text-foreground">{streak}</span>
              <span className="text-[10px] font-bold text-muted uppercase">Day Streak</span>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-xl bg-surface-muted p-4 border border-border/40">
            <span className="text-brand font-bold">
              <CurrencyIconDisplay url={currencyIconUrl} className="size-5" />
            </span>
            <div className="mt-2">
              <span className="block font-mono text-xl font-bold text-foreground">{totalOranges}</span>
              <span className="text-[10px] font-bold text-muted uppercase">Your Oranges</span>
            </div>
          </div>

          <Link
            href="/leaderboard"
            className="flex flex-col justify-between rounded-xl bg-brand-soft p-4 border border-brand/20 hover:border-brand transition-colors"
          >
            <span className="text-brand font-bold">
              <Trophy size={20} weight="fill" />
            </span>
            <div className="mt-2 flex items-center justify-between">
              <div>
                <span className="block font-mono text-sm font-bold text-brand">{communityTotal.toLocaleString()}</span>
                <span className="text-[10px] text-muted">Community Total</span>
              </div>
              <ArrowRight size={14} weight="bold" className="text-brand" />
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
