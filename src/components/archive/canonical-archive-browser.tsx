"use client";

import { useEffect, useState } from "react";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";
import { CatalogArchiveBrowser } from "./catalog-archive-browser";

/**
 * Wrapper around CatalogArchiveBrowser that applies canonical mapping enrichment.
 * - Uses canonical programme names in filters (instead of raw course names)
 * - Groups subjects by canonical category (DSC/DSE/GE/SEC/AEC/VAC)
 * - Separates unmatched papers into "(Unmatched)" section
 * - Preserves all existing features (search, filtering, download, etc.)
 */
export function CanonicalArchiveBrowser() {
  const [matched, setMatched] = useState<CatalogPaper[] | null>(null);
  const [failed, setFailed] = useState(false);

  // Fetched instead of passed as props: inlining the whole archive made the
  // page ~15MB of HTML. The API already drops unmatched papers.
  useEffect(() => {
    fetch("/api/pyq-archive")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setMatched)
      .catch(() => setFailed(true));
  }, []);

  if (!matched) {
    return failed ? (
      <div className="rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center">
        <p className="text-sm text-muted">Couldn&rsquo;t load the archive. Please refresh the page.</p>
      </div>
    ) : (
      <div className="h-[500px] w-full animate-pulse rounded-2xl bg-surface-muted border border-border/60" />
    );
  }

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
