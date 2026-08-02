"use client";

import Link from "next/link";
import {
  ArrowRight,
  Brain,
  CheckSquare,
  Compass,
  FileText,
  ListChecks,
} from "@phosphor-icons/react";

export function QuickActions() {
  const ACTIONS = [
    {
      title: "Find a PYQ",
      description: "Browse previous-year papers by subject and year.",
      href: "/pyq-notes",
      icon: ListChecks,
      accent: "text-blue-500 bg-blue-500/10",
    },
    {
      title: "Open my notes",
      description: "Continue with your semester-wise notes.",
      href: "#subjects",
      icon: FileText,
      accent: "text-amber-500 bg-amber-500/10",
    },
    {
      title: "View syllabus",
      description: "Check units, readings and course structure.",
      href: "/programs",
      icon: Compass,
      accent: "text-purple-500 bg-purple-500/10",
    },
    {
      title: "Create a quiz",
      description: "Test yourself from available study material.",
      href: "/tools/exam-kit",
      icon: Brain,
      accent: "text-emerald-500 bg-emerald-500/10",
    },
    {
      title: "Browse answer keys",
      description: "Check verified answers for past DU papers.",
      href: "/browse/college",
      icon: CheckSquare,
      accent: "text-rose-500 bg-rose-500/10",
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="quick-actions-title">
      <div className="flex items-center justify-between">
        <h2 id="quick-actions-title" className="text-lg font-bold font-display text-foreground">
          Quick Actions
        </h2>
        <span className="text-xs text-muted">Direct study shortcuts</span>
      </div>

      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
        {ACTIONS.map((action) => {
          const Icon = action.icon;
          const isAnchor = action.href.startsWith("#");

          const handleClick = (e: React.MouseEvent) => {
            if (isAnchor) {
              e.preventDefault();
              const el = document.getElementById(action.href.replace("#", ""));
              if (el) el.scrollIntoView({ behavior: "smooth" });
            }
          };

          return (
            <Link
              key={action.title}
              href={action.href}
              onClick={handleClick}
              className="group flex flex-col justify-between rounded-2xl border border-border bg-surface p-4 transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-md"
            >
              <div className="space-y-3">
                <span className={`flex size-10 items-center justify-center rounded-xl font-bold ${action.accent}`}>
                  <Icon size={20} weight="bold" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-brand transition-colors">
                    {action.title}
                  </h3>
                  <p className="mt-1 text-xs text-muted leading-snug line-clamp-2">
                    {action.description}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-1 text-xs font-bold text-brand group-hover:translate-x-1 transition-transform">
                <span>Open</span>
                <ArrowRight size={12} weight="bold" />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
