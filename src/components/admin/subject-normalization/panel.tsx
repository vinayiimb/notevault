"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MagicWand, Warning } from "@phosphor-icons/react";
import { scanArchiveAction, type ScanScopeInput } from "@/app/admin/(dashboard)/subject-normalization/actions";
import { SuggestionCard } from "./suggestion-card";
import { MergeLogList } from "./merge-log-list";
import type { MergeLogRow, NormalizationStats, ProgramWithTerms, SuggestionRow } from "./types";

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" && value > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-surface"}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export function SubjectNormalizationPanel({
  initialStats,
  initialSuggestions,
  programs,
  recentMerges,
}: {
  initialStats: NormalizationStats;
  initialSuggestions: SuggestionRow[];
  programs: ProgramWithTerms[];
  recentMerges: MergeLogRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [scanScope, setScanScope] = useState<"ALL" | "PROGRAM" | "TERM" | "UNMAPPED">("PROGRAM");
  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const [termId, setTermId] = useState(programs[0]?.terms[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState<"PENDING" | "APPROVED" | "REJECTED" | "IGNORED" | "MERGED" | "ALL">("PENDING");
  const [programFilter, setProgramFilter] = useState<string>("ALL");
  const [confidenceFilter, setConfidenceFilter] = useState<"ALL" | "HIGH" | "MEDIUM" | "LOW">("ALL");
  const [scanResult, setScanResult] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const selectedProgram = programs.find((p) => p.id === programId);

  const filteredSuggestions = useMemo(() => {
    return initialSuggestions.filter((s) => {
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      if (programFilter !== "ALL" && s.term.program.id !== programFilter) return false;
      if (confidenceFilter === "HIGH" && s.confidenceScore < 85) return false;
      if (confidenceFilter === "MEDIUM" && (s.confidenceScore < 60 || s.confidenceScore >= 85)) return false;
      if (confidenceFilter === "LOW" && s.confidenceScore >= 60) return false;
      return true;
    });
  }, [initialSuggestions, statusFilter, programFilter, confidenceFilter]);

  function refresh() {
    router.refresh();
  }

  function runScan() {
    setScanError(null);
    setScanResult(null);
    let input: ScanScopeInput;
    if (scanScope === "ALL") input = { scope: "ALL" };
    else if (scanScope === "PROGRAM") input = { scope: "PROGRAM", programId };
    else if (scanScope === "TERM") input = { scope: "TERM", termId };
    else input = { scope: "UNMAPPED" };

    startTransition(async () => {
      try {
        const result = await scanArchiveAction(input);
        setScanResult(
          `Scanned ${result.processedSubjects} subjects, found ${result.groupsFound} candidate groups (${result.suggestionsCreated} new suggestions)${
            result.failedCount > 0 ? `, ${result.failedCount} AI calls failed` : ""
          }.`
        );
        router.refresh();
      } catch (err) {
        setScanError(err instanceof Error ? err.message : "Scan failed.");
      }
    });
  }

  return (
    <div className="space-y-8">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Raw subjects" value={initialStats.totalRawSubjects} />
        <StatCard label="Suggested groups" value={initialStats.suggestedGroups} />
        <StatCard label="Normalized" value={initialStats.alreadyNormalized} />
        <StatCard label="Unreviewed" value={initialStats.unreviewedSuggestions} tone="warn" />
        <StatCard label="Low confidence" value={initialStats.lowConfidenceSuggestions} tone="warn" />
        <StatCard label="Merged (30d)" value={initialStats.recentlyMerged} />
      </div>

      {/* Scan controls */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-bold text-foreground">Scan Archive with AI</h2>
        <p className="mt-1 text-xs text-muted">
          Deterministic matching runs first and costs nothing; only uncertain clusters are sent to AI. Large scopes can
          take a while — start with one programme if you&apos;re unsure.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <select
            value={scanScope}
            onChange={(e) => setScanScope(e.target.value as typeof scanScope)}
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="PROGRAM">One programme</option>
            <option value="TERM">One semester</option>
            <option value="UNMAPPED">Unmapped subjects only</option>
            <option value="ALL">Entire archive</option>
          </select>

          {scanScope === "PROGRAM" && (
            <select
              value={programId}
              onChange={(e) => {
                setProgramId(e.target.value);
                setTermId(programs.find((p) => p.id === e.target.value)?.terms[0]?.id ?? "");
              }}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          {scanScope === "TERM" && (
            <>
              <select
                value={programId}
                onChange={(e) => {
                  setProgramId(e.target.value);
                  setTermId(programs.find((p) => p.id === e.target.value)?.terms[0]?.id ?? "");
                }}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <select
                value={termId}
                onChange={(e) => setTermId(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                {selectedProgram?.terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <button
            type="button"
            disabled={pending}
            onClick={runScan}
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
          >
            <MagicWand size={16} weight="bold" />
            {pending ? "Scanning…" : "Scan Archive with AI"}
          </button>
        </div>
        {scanResult && <p className="mt-3 text-xs font-semibold text-emerald-600">{scanResult}</p>}
        {scanError && (
          <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-red-500">
            <Warning size={13} weight="bold" /> {scanError}
          </p>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
        >
          <option value="PENDING">Unreviewed</option>
          <option value="APPROVED">Approved</option>
          <option value="MERGED">Merged</option>
          <option value="REJECTED">Marked separate</option>
          <option value="IGNORED">Ignored</option>
          <option value="ALL">All statuses</option>
        </select>
        <select
          value={programFilter}
          onChange={(e) => setProgramFilter(e.target.value)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
        >
          <option value="ALL">All programmes</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          value={confidenceFilter}
          onChange={(e) => setConfidenceFilter(e.target.value as typeof confidenceFilter)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
        >
          <option value="ALL">Any confidence</option>
          <option value="HIGH">High (85%+)</option>
          <option value="MEDIUM">Medium (60-84%)</option>
          <option value="LOW">Low (&lt;60%)</option>
        </select>
      </div>

      {/* Suggestions */}
      <div className="space-y-3">
        {filteredSuggestions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
            No suggestions match these filters. Try scanning a programme above.
          </div>
        ) : (
          filteredSuggestions.map((s) => <SuggestionCard key={s.id} suggestion={s} onChanged={refresh} />)
        )}
      </div>

      {/* Recent merges / undo */}
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-bold text-foreground">Recent merges</h2>
        <div className="mt-3">
          <MergeLogList logs={recentMerges} onChanged={refresh} />
        </div>
      </div>
    </div>
  );
}
