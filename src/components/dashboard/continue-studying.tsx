"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Clock, FileText, ListChecks } from "@phosphor-icons/react";

export interface StudyActivityItem {
  id: string;
  title: string;
  type: "NOTES" | "PYQ" | "ANSWER_KEY" | "SYLLABUS";
  subjectId: string;
  subjectName: string;
  lastOpenedAgo: string;
}

interface ContinueStudyingProps {
  items?: StudyActivityItem[];
}

export function ContinueStudying({ items = [] }: ContinueStudyingProps) {
  if (!items || items.length === 0) {
    return (
      <section className="space-y-4" aria-labelledby="continue-studying-title">
        <div className="flex items-center justify-between">
          <h2 id="continue-studying-title" className="text-lg font-bold font-display text-foreground">
            Continue Studying
          </h2>
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-surface p-8 text-center space-y-3">
          <div className="flex size-12 items-center justify-center rounded-full bg-brand-soft text-brand">
            <BookOpen size={24} weight="bold" />
          </div>
          <div className="max-w-md">
            <h3 className="text-base font-bold text-foreground">You have not opened any study material yet</h3>
            <p className="mt-1 text-xs text-muted">
              Explore your semester subjects below to start reading notes, papers and answer keys.
            </p>
          </div>
          <a
            href="#subjects"
            className="mt-2 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-xs font-semibold text-brand-foreground hover:bg-brand-hover"
          >
            <span>Explore Subjects</span>
            <ArrowRight size={14} weight="bold" />
          </a>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="continue-studying-title">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="continue-studying-title" className="text-lg font-bold font-display text-foreground">
            Continue Studying
          </h2>
          <p className="text-xs text-muted">Pick up right where you left off</p>
        </div>
        <Link
          href="/browse/college"
          className="text-xs font-semibold text-brand hover:underline flex items-center gap-1"
        >
          <span>View all library</span>
          <ArrowRight size={12} weight="bold" />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.slice(0, 3).map((item) => {
          const isNote = item.type === "NOTES";
          return (
            <div
              key={item.id}
              className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-5 transition-all hover:border-brand/40 hover:shadow-md space-y-4"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isNote
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                    }`}
                  >
                    {isNote ? <FileText size={12} weight="bold" /> : <ListChecks size={12} weight="bold" />}
                    {item.type}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-muted">
                    <Clock size={12} weight="bold" />
                    {item.lastOpenedAgo}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-bold text-brand">{item.subjectName}</p>
                  <h3 className="line-clamp-2 text-sm font-semibold text-foreground mt-0.5">
                    {item.title}
                  </h3>
                </div>
              </div>

              <Link
                href={`/subjects/${item.subjectId}`}
                className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-surface-muted px-3 text-xs font-semibold text-foreground hover:bg-brand hover:text-brand-foreground transition-colors"
              >
                <span>Continue Reading</span>
                <ArrowRight size={14} weight="bold" />
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
