"use client";

import { useRef, useState } from "react";
import { FileCsv, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { deployFailedUploadsFromCsvAction, type CsvDeployRowResult } from "@/lib/actions";

const STATUS_LABEL: Record<CsvDeployRowResult["status"], string> = {
  deployed: "Deployed",
  duplicate: "Already uploaded elsewhere — skipped",
  "no-failed-upload-match": "No matching failed upload found",
  "no-program-match": "Course not recognized",
  "no-term-match": "Semester not recognized",
  "no-subject": "No subject name given",
  "no-title": "No title column found in this row",
  error: "Error",
};

export function CsvDeploy() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<CsvDeployRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(file: File) {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { results } = await deployFailedUploadsFromCsvAction(formData);
      setResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that CSV.");
    } finally {
      setRunning(false);
    }
  }

  const deployedCount = results?.filter((r) => r.status === "deployed").length ?? 0;
  const issues = results?.filter((r) => r.status !== "deployed" && r.status !== "duplicate") ?? [];

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-4">
      <h2 className="flex items-center gap-2 font-medium">
        <FileCsv size={18} weight="bold" className="text-accent" />
        Deploy from CSV
      </h2>
      <p className="mt-1 text-xs text-muted">
        Columns: <code>title</code>, <code>program</code> (or <code>course</code>),{" "}
        <code>term</code> (or <code>semester</code>), <code>subject</code>, and optionally{" "}
        <code>type</code> (PYQ/NOTES) and <code>year</code>. Each title is matched against the
        failed uploads below and deployed straight to the subject named — creating it first if
        it doesn&apos;t exist yet.
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

      {running && <p className="mt-3 text-sm text-muted">Matching and deploying…</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {deployedCount} of {results.length} row{results.length === 1 ? "" : "s"} deployed
          </p>
          {issues.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-background p-3 text-xs">
              {issues.map((r, i) => (
                <li key={i} className="text-muted">
                  <span className="font-medium text-foreground">{r.title}</span> —{" "}
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
