"use client";

import Link from "next/link";
import { ArrowRight, Brain, FolderSimple, ListChecks } from "@phosphor-icons/react";

export function FeaturedCollections() {
  const COLLECTIONS = [
    {
      title: "DU B.Com (Hons) PYQ Collection",
      description: "Previous-year question papers covering all official LOCF core and elective units.",
      count: "40+ Papers",
      href: "/pyq-notes",
      icon: ListChecks,
      badge: "Curated Pack",
      color: "border-blue-500/20 bg-blue-500/5",
    },
    {
      title: "Official Delhi University Syllabus Folders",
      description: "Complete course structures, recommended readings, and unit weightages.",
      count: "All Semesters",
      href: "/programs",
      icon: FolderSimple,
      badge: "Official",
      color: "border-purple-500/20 bg-purple-500/5",
    },
    {
      title: "Exam Revision AI Practice Suite",
      description: "Generate instant flashcards and retention quizzes directly from your syllabus text.",
      count: "6 Modes",
      href: "/tools/exam-kit",
      icon: Brain,
      badge: "AI Powered",
      color: "border-emerald-500/20 bg-emerald-500/5",
    },
  ];

  return (
    <section className="space-y-4" aria-labelledby="featured-collections-title">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="featured-collections-title" className="text-lg font-bold font-display text-foreground">
            Featured DU Collections
          </h2>
          <p className="text-xs text-muted">Hand-picked revision folders for fast exam prep</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {COLLECTIONS.map((col) => {
          const Icon = col.icon;
          return (
            <div
              key={col.title}
              className={`flex flex-col justify-between rounded-2xl border p-5 transition-all hover:-translate-y-1 hover:shadow-md space-y-4 ${col.color}`}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-surface text-brand shadow-sm font-bold">
                    <Icon size={20} weight="bold" />
                  </span>
                  <span className="rounded-full bg-surface px-2.5 py-0.5 text-[10px] font-bold text-muted border border-border">
                    {col.badge}
                  </span>
                </div>

                <div>
                  <h3 className="text-base font-bold text-foreground">{col.title}</h3>
                  <p className="mt-1 text-xs text-muted leading-relaxed">{col.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <span className="text-xs font-semibold text-muted">{col.count}</span>
                <Link
                  href={col.href}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand-hover transition-colors"
                >
                  <span>Open</span>
                  <ArrowRight size={12} weight="bold" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
