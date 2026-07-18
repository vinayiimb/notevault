"use client";

import { useRef, useState } from "react";
import { FileCsv, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { matchUnsortedFromCsvAction, type UnsortedCsvRowResult } from "@/lib/actions";

const STATUS_LABEL: Record<UnsortedCsvRowResult["status"], string> = {
  matched: "Moved",
  "no-subject-match": "No matching Unsorted subject found (already moved, or name doesn't match)",
  "no-program-match": "Course not recognized",
  "no-term-match": "Semester not recognized",
  "no-name": "No name column found in this row",
};

export function MatchUnsortedCsv() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<UnsortedCsvRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(file: File) {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { results } = await matchUnsortedFromCsvAction(formData);
      setResults(results);
      // The list below reads its initial data from the server on page load
      // and isn't wired to re-fetch on its own — a full reload is the
      // simplest way to reflect the subjects this just moved out.
      if (results.some((r) => r.status === "matched")) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that CSV.");
    } finally {
      setRunning(false);
    }
  }

  const matchedCount = results?.filter((r) => r.status === "matched").length ?? 0;
  const issues = results?.filter((r) => r.status !== "matched") ?? [];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <FileCsv size={18} weight="bold" className="text-accent" />
        Match from CSV
      </h2>
      <p className="mt-1 text-xs text-muted">
        For subjects <strong>already in this Unsorted list</strong>. Columns: <code>name</code> (or{" "}
        <code>subject</code>), <code>program</code> (or <code>course</code>), <code>term</code> (or{" "}
        <code>semester</code>). Each name is matched against the list below and moved straight to
        that course + semester.
      </p>

      <div
        className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm transition hover:border-accent/60"
        onClick={() => inputRef.current?.click()}
      >
        <UploadSimple size={18} className="shrink-0 text-muted" />
        <span className="text-foreground">{fileName ?? "Click to choose a .csv file"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              setFileName(file.name);
              run(file);
            }
            e.target.value = "";
          }}
        />
      </div>

      {running && <p className="mt-3 text-sm text-muted">Matching and moving…</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {matchedCount} of {results.length} row{results.length === 1 ? "" : "s"} moved
          </p>
          {issues.length > 0 && (
            <ul className="mt-2 flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs">
              {issues.map((r, i) => (
                <li key={i} className="text-muted">
                  <span className="font-medium text-foreground">{r.name}</span> —{" "}
                  {STATUS_LABEL[r.status]}
                  {r.message ? ` (${r.message})` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
