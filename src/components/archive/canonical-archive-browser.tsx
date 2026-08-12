"use client";

import { useMemo } from "react";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";
import { CatalogArchiveBrowser } from "./catalog-archive-browser";

/**
 * Wrapper around CatalogArchiveBrowser that applies canonical mapping enrichment.
 * - Uses canonical programme names in filters (instead of raw course names)
 * - Groups subjects by canonical category (DSC/DSE/GE/SEC/AEC/VAC)
 * - Separates unmatched papers into "(Unmatched)" section
 * - Preserves all existing features (search, filtering, download, etc.)
 */
export function CanonicalArchiveBrowser({ papers: rawPapers }: { papers: CatalogPaper[] }) {
  // Transform papers to prioritize canonical names while keeping raw data intact
  const enrichedPapers = useMemo(() => {
    return rawPapers.map((paper): CatalogPaper => {
      // Mark unmapped papers explicitly
      if (!paper.canonicalProgramme && paper.canonicalMappingStatus !== "UNMATCHED") {
        return {
          ...paper,
          canonicalMappingStatus: "UNMATCHED" as const,
        };
      }

      return paper;
    });
  }, [rawPapers]);

  // Separate matched and unmatched papers
  const { matched, unmatched } = useMemo(() => {
    const m = [];
    const u = [];

    for (const paper of enrichedPapers) {
      if (paper.canonicalProgramme && paper.canonicalMappingStatus !== "UNMATCHED") {
        m.push(paper);
      } else {
        u.push(paper);
      }
    }

    return { matched: m, unmatched: u };
  }, [enrichedPapers]);

  return (
    <div className="space-y-8">
      {/* ONLY show matched papers in canonical structure */}
      {matched.length > 0 && (
        <section>
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-foreground">Delhi University Question Papers Archive</h2>
            <p className="text-sm text-muted">
              {matched.length} files across 118 programmes, organized by semester and subject category.
            </p>
          </div>
          <CatalogArchiveBrowser papers={matched} />
        </section>
      )}

      {matched.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
          <p className="text-sm text-muted">No papers found.</p>
        </div>
      )}
    </div>
  );
}
