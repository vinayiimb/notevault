"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Clock, FilePdf, FileText, ListChecks } from "@phosphor-icons/react";

export interface ResourceItem {
  id: string;
  title: string;
  type: "NOTES" | "PYQ" | "ANSWER_KEY" | "SYLLABUS";
  year?: number | null;
  academicYear?: string | null;
  fileName?: string;
  createdAt: string;
  subject: {
    id: string;
    name: string;
    programName?: string;
  };
}

interface RecentResourcesProps {
  resources: ResourceItem[];
}

export function RecentResources({ resources }: RecentResourcesProps) {
  const [filter, setFilter] = useState<"ALL" | "NOTES" | "PYQ">("ALL");

  const filtered = useMemo(() => {
    if (filter === "ALL") return resources;
    return resources.filter((r) => r.type === filter);
  }, [resources, filter]);

  return (
    <section id="recent" className="space-y-4" aria-labelledby="recent-resources-title">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="recent-resources-title" className="text-lg font-bold font-display text-foreground">
            Recently Added Material
          </h2>
          <p className="text-xs text-muted">Latest uploads from the Delhi University repository</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 rounded-xl border border-border bg-surface p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setFilter("ALL")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "ALL" ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter("NOTES")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "NOTES" ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            Notes
          </button>
          <button
            type="button"
            onClick={() => setFilter("PYQ")}
            className={`rounded-lg px-3 py-1.5 transition-colors ${
              filter === "PYQ" ? "bg-brand text-brand-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            PYQs
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-xs text-muted">No recent resources match this category.</div>
        ) : (
          filtered.slice(0, 5).map((item) => {
            const isNote = item.type === "NOTES";
            const dateStr = new Date(item.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            });

            return (
              <div
                key={item.id}
                className="flex flex-col gap-3 p-4 transition-colors hover:bg-brand-soft/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand">
                    {isNote ? <FileText size={20} weight="bold" /> : <ListChecks size={20} weight="bold" />}
                  </span>

                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-bold text-brand">{item.subject.name}</span>
                      <span className="rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-bold text-brand">
                        {item.type}
                      </span>
                      {item.year && (
                        <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">
                          {item.year}
                        </span>
                      )}
                    </div>

                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>

                    <div className="flex items-center gap-3 text-[11px] text-muted">
                      <span className="flex items-center gap-1">
                        <FilePdf size={12} weight="bold" className="text-red-500" />
                        PDF Document
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} weight="bold" />
                        Added {dateStr}
                      </span>
                    </div>
                  </div>
                </div>

                <Link
                  href={`/subjects/${item.subject.id}`}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-surface-muted px-4 text-xs font-semibold text-foreground hover:bg-brand hover:text-brand-foreground transition-colors"
                >
                  <span>Open</span>
                  <ArrowRight size={14} weight="bold" />
                </Link>
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
