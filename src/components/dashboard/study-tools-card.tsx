"use client";

import Link from "next/link";
import {
  ArrowRight,
  Cards,
  CheckSquare,
  NotePencil,
  Scales,
  ShareNetwork,
  TextT,
} from "@phosphor-icons/react";

export function StudyToolsCard() {
  const TOOLS = [
    { label: "Flashcards", detail: "Recall fast", icon: Cards, href: "/tools/exam-kit" },
    { label: "Quiz", detail: "Check retention", icon: CheckSquare, href: "/tools/exam-kit" },
    { label: "Fill Blanks", detail: "Train memory", icon: TextT, href: "/tools/exam-kit" },
    { label: "Concept Map", detail: "See connections", icon: ShareNetwork, href: "/tools/exam-kit" },
    { label: "Essay Skeleton", detail: "Structure replies", icon: NotePencil, href: "/tools/exam-kit" },
    { label: "Devil's Advocate", detail: "Stress-test ideas", icon: Scales, href: "/tools/exam-kit" },
  ];

  return (
    <section className="space-y-4" aria-labelledby="study-tools-title">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="study-tools-title" className="text-lg font-bold font-display text-foreground">
            AI Study Kit & Practice Tools
          </h2>
          <p className="text-xs text-muted">Same syllabus. Six active interactive ways to learn it.</p>
        </div>
        <Link
          href="/tools/exam-kit"
          className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
        >
          <span>Open Exam Kit</span>
          <ArrowRight size={12} weight="bold" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          return (
            <Link
              key={tool.label}
              href={tool.href}
              className="group flex flex-col items-center justify-center rounded-2xl border border-border bg-surface p-4 text-center transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-md space-y-2"
            >
              <span className="flex size-11 items-center justify-center rounded-xl bg-brand-soft text-brand group-hover:bg-brand group-hover:text-brand-foreground transition-colors">
                <Icon size={22} weight="bold" />
              </span>
              <div>
                <h3 className="text-xs font-bold text-foreground group-hover:text-brand transition-colors">
                  {tool.label}
                </h3>
                <p className="text-[10px] text-muted">{tool.detail}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
