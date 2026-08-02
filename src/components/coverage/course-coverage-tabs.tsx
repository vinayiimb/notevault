"use client";

import { useState } from "react";
import type { CoverageTermSection } from "@/lib/coverage-data";
import { CourseCoverageCell } from "@/components/coverage/course-coverage-cell";

type Tab = "dsc_dse" | "sec";

const TABS: { id: Tab; label: string; categories: Array<CoverageTermSection["subjects"][number]["category"]> }[] = [
  { id: "dsc_dse", label: "DSC + DSE", categories: ["DSC", "DSE"] },
  { id: "sec", label: "SEC", categories: ["SEC"] },
];

export function CourseCoverageTabs({ terms, years }: { terms: CoverageTermSection[]; years: number[] }) {
  const [tab, setTab] = useState<Tab>("dsc_dse");
  const activeCategories = TABS.find((t) => t.id === tab)!.categories;

  return (
    <div>
      <div className="flex gap-1 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id
                ? "border-b-2 border-accent text-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex flex-col gap-10">
        {terms.map((term) => {
          const subjects = term.subjects.filter((s) => activeCategories.includes(s.category));
          if (subjects.length === 0) return null;

          return (
            <section key={term.id}>
              <h2 className="text-lg font-bold tracking-tight">{term.name}</h2>
              <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border bg-surface-muted">
                      <th className="sticky left-0 z-10 min-w-64 bg-surface-muted px-4 py-2 text-left text-xs font-bold tracking-wider text-muted uppercase">
                        Subject
                      </th>
                      {years.map((y) => (
                        <th key={y} className="px-3 py-2 text-center text-xs font-bold tracking-wider text-muted uppercase">
                          {y}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {subjects.map((subject) => (
                      <tr key={subject.id} className="border-b border-[#F1F5F9] last:border-0 dark:border-border">
                        <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">{subject.name}</td>
                        {years.map((y) => (
                          <td key={y} className="px-3 py-2">
                            <CourseCoverageCell
                              subjectId={subject.id}
                              year={y}
                              files={subject.filesByYear[y] ?? []}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
