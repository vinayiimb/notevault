"use client";

import { useState, useTransition } from "react";
import { importDuQuestionBankPapersAction } from "@/lib/actions";

export function DuQuestionBankImportPanel({ initialCount, totalInFile }: { initialCount: number; totalInFile: number }) {
  const [count, setCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  function run() {
    setResult(null);
    startTransition(async () => {
      const res = await importDuQuestionBankPapersAction();
      if (res.ok) {
        setCount((c) => c + res.imported);
        setResult({ ok: true, message: `Imported ${res.imported} rows.` });
      } else {
        setResult({ ok: false, message: res.message });
      }
    });
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-foreground">Rows currently in the table</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{count.toLocaleString()}</p>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={run}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
        >
          {pending ? "Importing…" : `Import all ${totalInFile.toLocaleString()} rows`}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        Bulk-inserts every row from the DU Question Paper Bank scrape with no duplicate checking —
        running this more than once will insert the file again as new rows.
      </p>
      {result && (
        <p className={`mt-3 text-sm font-medium ${result.ok ? "text-success" : "text-red-600"}`}>
          {result.ok ? result.message : `Failed: ${result.message}`}
        </p>
      )}
    </div>
  );
}
