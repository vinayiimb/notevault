"use client";

import { useState } from "react";
import { ArrowsClockwise } from "@phosphor-icons/react/dist/ssr";
import { syncDriveFilesForLinkAction, type DriveSyncRowResult } from "@/lib/actions";

export function SyncDriveFiles({ linkId }: { linkId: string }) {
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<DriveSyncRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const formData = new FormData();
      formData.set("linkId", linkId);
      const { results } = await syncDriveFilesForLinkAction(formData);
      setResults(results);
      setTimeout(() => window.location.reload(), 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sync files from Drive.");
    } finally {
      setRunning(false);
    }
  }

  const newSubjects = new Set(results?.filter((r) => r.isNewSubject).map((r) => r.subjectName)).size;

  return (
    <div>
      <button
        type="button"
        disabled={running}
        onClick={run}
        className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
      >
        <ArrowsClockwise size={16} weight="bold" className={running ? "animate-spin" : ""} />
        {running ? "Syncing…" : "Sync files from Drive"}
      </button>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {results && (
        <p className="mt-3 text-sm text-muted">
          Found {results.length} PDF{results.length === 1 ? "" : "s"} — {newSubjects} new subject
          {newSubjects === 1 ? "" : "s"} created from filenames. Reloading…
        </p>
      )}
    </div>
  );
}
