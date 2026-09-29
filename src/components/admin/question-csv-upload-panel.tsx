"use client";

import { useRef, useState } from "react";
import { CheckCircle, WarningCircle, UploadSimple } from "@phosphor-icons/react";
import { validateQuestionCsvAction, commitQuestionCsvAction, type QuestionCsvRowResult } from "@/lib/actions";

type Stage = "idle" | "validating" | "preview" | "committing" | "done";

export function QuestionCsvUploadPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [results, setResults] = useState<QuestionCsvRowResult[]>([]);
  const [summary, setSummary] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validCount = results.filter((r) => r.status === "valid").length;
  const errorCount = results.filter((r) => r.status === "error").length;

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setSummary(null);
    setStage("validating");
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { results } = await validateQuestionCsvAction(formData);
      setResults(results);
      setStage("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read this file.");
      setStage("idle");
    }
  }

  async function handleCommit() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;
    setStage("committing");
    setError(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { inserted, skipped, results } = await commitQuestionCsvAction(formData);
      setResults(results);
      setSummary({ inserted, skipped });
      setStage("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
      setStage("preview");
    }
  }

  function reset() {
    setFileName(null);
    setResults([]);
    setSummary(null);
    setError(null);
    setStage("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {stage === "idle" && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border py-10 text-center transition hover:border-accent/40">
          <UploadSimple size={28} className="text-muted" weight="bold" />
          <span className="text-sm font-medium text-foreground">Choose a CSV or Excel file</span>
          <span className="text-xs text-muted">SubjectId, Question, Answer, Marks, Years, RepeatCount</span>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>
      )}

      {stage === "validating" && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-sm text-muted">
          <p>Checking {fileName}…</p>
        </div>
      )}

      {(stage === "preview" || stage === "committing") && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">{fileName}</p>
              <p className="mt-1 text-xs text-muted">
                {validCount} row{validCount === 1 ? "" : "s"} ready to import
                {errorCount > 0 ? `, ${errorCount} with errors (will be skipped)` : ""}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                disabled={stage === "committing"}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted transition hover:text-foreground disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCommit}
                disabled={validCount === 0 || stage === "committing"}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
              >
                {stage === "committing" ? "Importing…" : `Import ${validCount} question${validCount === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>

          <RowResultsTable results={results} />
        </div>
      )}

      {stage === "done" && summary && (
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <CheckCircle size={18} weight="bold" className="text-green" />
            Imported {summary.inserted} question{summary.inserted === 1 ? "" : "s"}
            {summary.skipped > 0 ? ` — ${summary.skipped} skipped (see below)` : ""}
          </div>
          <RowResultsTable results={results} />
          <button
            type="button"
            onClick={reset}
            className="mt-4 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:border-accent/40"
          >
            Upload another file
          </button>
        </div>
      )}

      {error && (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600 dark:text-red-400">
          <WarningCircle size={16} weight="bold" /> {error}
        </p>
      )}
    </div>
  );
}

function RowResultsTable({ results }: { results: QuestionCsvRowResult[] }) {
  if (results.length === 0) return null;
  return (
    <div className="mt-4 max-h-96 overflow-y-auto rounded-lg border border-border">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-surface-muted text-muted">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Row</th>
            <th className="px-3 py-2 text-left font-medium">Question</th>
            <th className="px-3 py-2 text-left font-medium">Subject</th>
            <th className="px-3 py-2 text-left font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {results.map((r) => (
            <tr key={r.rowNumber} className={r.status === "error" ? "bg-red-50 dark:bg-red-950/20" : ""}>
              <td className="px-3 py-2 text-muted">{r.rowNumber}</td>
              <td className="max-w-[280px] truncate px-3 py-2 text-foreground">{r.questionPreview}</td>
              <td className="max-w-[200px] truncate px-3 py-2 text-muted">
                {r.subjectLabel ?? r.subjectId}
              </td>
              <td className="px-3 py-2">
                {r.status === "valid" ? (
                  <span className="text-green">Valid</span>
                ) : (
                  <span className="text-red-600 dark:text-red-400" title={r.error}>
                    {r.error}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
