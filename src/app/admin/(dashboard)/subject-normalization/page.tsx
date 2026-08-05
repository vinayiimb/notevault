import { Shuffle, ShieldCheck } from "@phosphor-icons/react/dist/ssr";
import {
  getNormalizationStats,
  getSuggestions,
  getProgramsWithTerms,
  getRecentMergeLogs,
} from "@/lib/subject-normalization-data";
import { SubjectNormalizationPanel } from "@/components/admin/subject-normalization/panel";

export const dynamic = "force-dynamic";

export default async function SubjectNormalizationPage() {
  let stats;
  let suggestions;
  let programs;
  let recentMerges;
  let loadError: string | null = null;

  try {
    [stats, suggestions, programs, recentMerges] = await Promise.all([
      getNormalizationStats(),
      getSuggestions(),
      getProgramsWithTerms(),
      getRecentMergeLogs(),
    ]);
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load Subject Normalization data.";
  }

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2 text-sm font-bold text-accent">
            <ShieldCheck size={20} weight="bold" />
            <span>Subject Normalization Centre</span>
          </div>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
            Find &amp; merge duplicate subjects
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Deterministic matching plus AI review find likely duplicate subject names across the archive. Nothing is
            merged automatically — every group here is a suggestion waiting on your approval.
          </p>
        </div>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
          <p className="font-bold">Couldn&apos;t load Subject Normalization data</p>
          <p className="mt-1 opacity-90">{loadError}</p>
          <p className="mt-1 opacity-90">
            This usually means the database is unreachable right now. Scans and merges need a live database
            connection.
          </p>
        </div>
      ) : (
        <SubjectNormalizationPanel
          initialStats={stats!}
          initialSuggestions={JSON.parse(JSON.stringify(suggestions))}
          programs={JSON.parse(JSON.stringify(programs))}
          recentMerges={JSON.parse(JSON.stringify(recentMerges))}
        />
      )}

      <div className="flex items-start gap-3 rounded-2xl border border-border bg-surface p-5 text-xs text-muted">
        <Shuffle size={18} weight="bold" className="mt-0.5 shrink-0 text-accent" />
        <p>
          Merging never moves or duplicates PDF files — it only repoints which subject a paper belongs to. Every
          merge is logged and reversible from the Recent Merges list below.
        </p>
      </div>
    </div>
  );
}
