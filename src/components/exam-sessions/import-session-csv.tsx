"use client";

import { useRef, useState } from "react";
import { FileCsv, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import {
  importSessionLinksFromCsvAction,
  linkProgramToSessionAction,
  type SessionCsvRowResult,
} from "@/lib/actions";

type Program = { id: string; name: string };

export function ImportSessionCsv({
  sessionId,
  programs,
}: {
  sessionId: string;
  programs: Program[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SessionCsvRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(file: File) {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const formData = new FormData();
      formData.set("sessionId", sessionId);
      formData.set("file", file);
      const { results } = await importSessionLinksFromCsvAction(formData);
      setResults(results);
      if (results.some((r) => r.status === "linked")) {
        setTimeout(() => window.location.reload(), 1200);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that CSV.");
    } finally {
      setRunning(false);
    }
  }

  async function resolveRow(index: number, programId: string) {
    if (!results) return;
    const row = results[index];
    const formData = new FormData();
    formData.set("sessionId", sessionId);
    formData.set("programId", programId);
    formData.set("driveUrl", row.driveUrl);
    await linkProgramToSessionAction(formData);
    setTimeout(() => window.location.reload(), 400);
  }

  const linkedCount = results?.filter((r) => r.status === "linked").length ?? 0;
  const needsReview = results?.filter((r) => r.status === "needs-review") ?? [];
  const invalid = results?.filter((r) => r.status === "invalid") ?? [];

  return (
    <div>
      <div
        className="flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm transition hover:border-accent/60"
        onClick={() => inputRef.current?.click()}
      >
        <UploadSimple size={18} className="shrink-0 text-muted" />
        <span className="text-foreground">{fileName ?? "Click to choose a .csv file"}</span>
        <FileCsv size={16} className="ml-auto shrink-0 text-muted" />
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

      {running && <p className="mt-3 text-sm text-muted">Matching courses…</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {linkedCount} of {results.length} row{results.length === 1 ? "" : "s"} linked automatically
          </p>

          {needsReview.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-muted">Needs review — pick the right course</p>
              <ul className="mt-2 flex flex-col gap-2">
                {needsReview.map((row) => {
                  const index = results.indexOf(row);
                  return (
                    <ReviewRow
                      key={index}
                      row={row}
                      programs={programs}
                      onLink={(programId) => resolveRow(index, programId)}
                    />
                  );
                })}
              </ul>
            </div>
          )}

          {invalid.length > 0 && (
            <ul className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto rounded-lg border border-border bg-background p-3 text-xs">
              {invalid.map((row, i) => (
                <li key={i} className="text-muted">
                  <span className="font-medium text-foreground">{row.courseLabel || "(blank)"}</span> —{" "}
                  {row.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewRow({
  row,
  programs,
  onLink,
}: {
  row: SessionCsvRowResult;
  programs: Program[];
  onLink: (programId: string) => void;
}) {
  const [selected, setSelected] = useState(row.matchedProgramId ?? "");

  return (
    <li className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background p-3 text-xs">
      <span className="font-medium text-foreground">{row.courseLabel}</span>
      <span className="text-muted">{row.message}</span>
      <div className="ml-auto flex items-center gap-2">
        <select
          value={selected}
          onChange={(e) => setSelected(e.target.value)}
          className="rounded-lg border border-border bg-surface px-2 py-1 text-xs focus:border-accent focus:outline-none"
        >
          <option value="">Choose a course…</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!selected}
          onClick={() => onLink(selected)}
          className="rounded-lg bg-accent px-2 py-1 text-xs font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          Link
        </button>
      </div>
    </li>
  );
}
