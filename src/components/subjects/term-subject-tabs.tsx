"use client";

import { useState } from "react";
import Link from "next/link";
import { Notebook, CaretDown, CaretUp, Info } from "@phosphor-icons/react/dist/ssr";
import { CATEGORY_LABELS, CATEGORY_DESCRIPTIONS, CATEGORY_ORDER, type SubjectCategory } from "@/lib/subject-category";

type SubjectItem = {
  id: string;
  name: string;
  description: string | null;
  resourceCount: number;
  repeatedCount: number;
  category: SubjectCategory;
};

function SubjectCard({ subject }: { subject: SubjectItem }) {
  return (
    <Link
      href={`/subjects/${subject.id}`}
      className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-surface p-4 transition hover:border-brand hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <Notebook size={16} weight="bold" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm font-medium leading-snug">{subject.name}</p>
          {subject.description && <p className="mt-1 line-clamp-1 text-xs text-muted">{subject.description}</p>}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted">
        <span className="rounded-md bg-surface-muted px-2 py-1">
          {subject.resourceCount} file{subject.resourceCount === 1 ? "" : "s"}
        </span>
        {subject.repeatedCount > 0 && (
          <span className="rounded-md bg-accent/10 px-2 py-1 text-accent">
            {subject.repeatedCount} repeated Qs
          </span>
        )}
      </div>
    </Link>
  );
}

function CategorySection({
  category,
  subjects,
  defaultExpanded = false,
}: {
  category: SubjectCategory;
  subjects: SubjectItem[];
  defaultExpanded?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border bg-surface-muted/30 p-1">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between rounded-xl px-4 py-3 transition hover:bg-surface-muted"
      >
        <div className="flex flex-col items-start gap-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{CATEGORY_LABELS[category]}</h3>
            <span className="rounded-full bg-border px-2 py-0.5 text-[10px] font-medium text-muted">
              {subjects.length}
            </span>
          </div>
          <p className="text-xs text-muted">{CATEGORY_DESCRIPTIONS[category]}</p>
        </div>
        <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-sm border border-border">
          {isExpanded ? <CaretUp size={16} /> : <CaretDown size={16} />}
        </div>
      </button>

      {isExpanded && (
        <div className="grid grid-cols-1 gap-3 px-2 pb-2 sm:grid-cols-2 lg:grid-cols-3">
          {subjects.map((subject) => (
            <SubjectCard key={subject.id} subject={subject} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TermSubjectTabs({ subjects }: { subjects: SubjectItem[] }) {
  const grouped = new Map<SubjectCategory, SubjectItem[]>();
  for (const s of subjects) {
    if (!grouped.has(s.category)) grouped.set(s.category, []);
    grouped.get(s.category)!.push(s);
  }

  const availableCategories = CATEGORY_ORDER.filter((c) => grouped.has(c));

  return (
    <div className="flex flex-col gap-6">
      {availableCategories.map((cat) => {
        const isCore = cat === "CORE" || cat === "DSC" || cat === "DSE";
        return (
          <CategorySection
            key={cat}
            category={cat}
            subjects={grouped.get(cat)!}
            defaultExpanded={isCore}
          />
        );
      })}
    </div>
  );
}
