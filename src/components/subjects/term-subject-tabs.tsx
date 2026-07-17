"use client";

import { useState } from "react";
import Link from "next/link";
import { Notebook } from "@phosphor-icons/react/dist/ssr";
import { CATEGORY_LABELS, CATEGORY_ORDER, type SubjectCategory } from "@/lib/subject-category";

type SubjectItem = {
  id: string;
  name: string;
  description: string | null;
  resourceCount: number;
  repeatedCount: number;
  category: SubjectCategory;
};

export function TermSubjectTabs({ subjects }: { subjects: SubjectItem[] }) {
  const grouped = new Map<SubjectCategory, SubjectItem[]>();
  for (const s of subjects) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s);
  }
  const availableCategories = CATEGORY_ORDER.filter((c) => grouped.has(c));
  const [active, setActive] = useState<SubjectCategory>(availableCategories[0]);
  const activeList = grouped.get(active) ?? [];

  return (
    <div>
      <div className="flex flex-wrap gap-6 border-b border-border">
        {availableCategories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActive(cat)}
            className={`-mb-px border-b-2 pb-3 text-sm font-semibold transition ${
              active === cat
                ? "border-brand text-foreground"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {CATEGORY_LABELS[cat]}
            <span className="ml-1.5 text-xs font-normal text-muted">{grouped.get(cat)!.length}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col divide-y divide-border rounded-2xl border border-border bg-surface">
        {activeList.map((s) => (
          <Link
            key={s.id}
            href={`/subjects/${s.id}`}
            className="flex items-center justify-between gap-4 px-5 py-4 transition hover:bg-surface-muted"
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <Notebook size={18} weight="bold" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-medium">{s.name}</p>
                {s.description && <p className="truncate text-xs text-muted">{s.description}</p>}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 text-xs text-muted">
              <span>
                {s.resourceCount} file{s.resourceCount === 1 ? "" : "s"}
              </span>
              {s.repeatedCount > 0 && <span className="text-accent">{s.repeatedCount} repeated Qs</span>}
              <span className="rounded-full bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">
                View →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
