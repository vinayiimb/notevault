"use client";

import { useMemo } from "react";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

/**
 * Hook that processes papers to prioritize canonical names and group by category.
 * Handles:
 * - Using canonical programme name instead of raw course
 * - Using canonical subject instead of raw subject
 * - Marking papers with their canonical category
 * - Separating unmatched papers
 */
export function useCanonicalPapers(papers: CatalogPaper[]) {
  return useMemo(() => {
    return papers.map((paper) => {
      const processingApplied = Boolean(paper.canonicalProgramme) || paper.canonicalMappingStatus === "UNMATCHED";

      if (!processingApplied) {
        // Paper has no canonical mapping - mark as unmatched and keep as-is
        return {
          ...paper,
          canonicalMappingStatus: "UNMATCHED",
        };
      }

      return paper;
    });
  }, [papers]);
}

/**
 * Hook that groups papers by canonical programme and category for filtering.
 */
export function useCanonicalProgrammeFilters(papers: CatalogPaper[]) {
  return useMemo(() => {
    const programmes = new Map<string, { label: string; paperCount: number; hasMatched: boolean; hasUnmatched: boolean }>();

    for (const paper of papers) {
      const isMatched = paper.canonicalMappingStatus !== "UNMATCHED" && Boolean(paper.canonicalProgramme);
      const programme = isMatched ? paper.canonicalProgramme : "(Unmatched)";

      if (!programme) continue;

      const existing = programmes.get(programme);
      if (existing) {
        existing.paperCount += 1;
        if (isMatched) existing.hasMatched = true;
        if (!isMatched) existing.hasUnmatched = true;
      } else {
        programmes.set(programme, {
          label: programme,
          paperCount: 1,
          hasMatched: isMatched,
          hasUnmatched: !isMatched,
        });
      }
    }

    return Array.from(programmes.entries())
      .map(([key, data]) => ({ key, ...data }))
      .sort((a, b) => {
        // Sort unmatched to the end
        if (a.key === "(Unmatched)") return 1;
        if (b.key === "(Unmatched)") return -1;
        return a.label.localeCompare(b.label);
      });
  }, [papers]);
}
