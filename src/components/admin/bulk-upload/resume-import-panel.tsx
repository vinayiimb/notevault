"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowClockwise } from "@phosphor-icons/react/dist/ssr";
import { getBatchValidRowIdsAction, commitBulkUploadRowsAction } from "@/lib/actions";

const CHUNK_SIZE = 30;
const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Same chunk-with-retry shape as fresh-upload-panel.tsx's commit — one bad
// chunk shouldn't stop the rest of a batch that might have thousands of
// rows still sitting at VALID.
async function runChunkWithRetry<T>(fn: () => Promise<T>, onGiveUp: (err: unknown) => void): Promise<T | null> {
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === RETRY_ATTEMPTS) {
        onGiveUp(err);
        return null;
      }
      await sleep(RETRY_DELAY_MS * attempt);
    }
  }
  return null;
}

export function ResumeImportPanel({ batchId, validCount }: { batchId: string; validCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (validCount === 0) return null;

  function resume() {
    setError(null);
    startTransition(async () => {
      const idsFormData = new FormData();
      idsFormData.set("batchId", batchId);
      const { rowIds } = await getBatchValidRowIdsAction(idsFormData);

      const total = rowIds.length;
      setProgress({ done: 0, total });

      let imported = 0;
      let duplicate = 0;
      let chunkFailures = 0;

      for (let i = 0; i < rowIds.length; i += CHUNK_SIZE) {
        const chunk = rowIds.slice(i, i + CHUNK_SIZE);
        const chunkResult = await runChunkWithRetry(
          async () => {
            const formData = new FormData();
            formData.set("batchId", batchId);
            for (const id of chunk) formData.append("rowIds", id);
            return commitBulkUploadRowsAction(formData);
          },
          (err) => {
            chunkFailures += chunk.length;
            console.error(`[bulk-upload] Resume-import chunk at row ${i + 1} failed after ${RETRY_ATTEMPTS} attempts:`, err);
          }
        );
        if (chunkResult) {
          for (const r of chunkResult.results) {
            if (r.status === "IMPORTED") imported += 1;
            if (r.status === "DUPLICATE") duplicate += 1;
          }
        }
        setProgress({ done: Math.min(i + CHUNK_SIZE, total), total });
      }

      setProgress(null);
      if (chunkFailures > 0) {
        setError(
          `Imported ${imported}${duplicate > 0 ? `, ${duplicate} duplicate` : ""} — ${chunkFailures} row${chunkFailures === 1 ? "" : "s"} still couldn't be reached. Click Resume import again to retry.`
        );
      }
      router.refresh();
    });
  }

  return (
    <div className="rounded-xl border border-accent/40 bg-accent/5 p-4">
      {progress ? (
        <div>
          <div className="flex items-baseline justify-between text-sm">
            <p className="font-semibold text-foreground">Importing…</p>
            <p className="font-mono text-xs text-muted">
              {progress.done} / {progress.total}
            </p>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
              style={{ width: `${progress.total === 0 ? 0 : Math.round((progress.done / progress.total) * 100)}%` }}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-foreground">
            {validCount} row{validCount === 1 ? "" : "s"} in this batch never made it into the Full Archive catalog.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={resume}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
          >
            <ArrowClockwise size={16} weight="bold" />
            Resume import
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}
