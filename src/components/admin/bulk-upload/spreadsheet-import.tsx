"use client";

import { useRef, useState } from "react";
import { FileXls, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { importPapersFromSpreadsheetAction, type SpreadsheetImportRowResult } from "@/lib/actions";

const STATUS_LABEL: Record<SpreadsheetImportRowResult["status"], string> = {
  imported: "Imported",
  "no-new-files": "Nothing new — every file already in the archive",
  "empty-folder": "No PDFs found in that Drive folder",
  "no-program-match": "Course not recognized",
  "no-term-match": "Semester not recognized",
  "no-subject": "No subject name given",
  "no-drive-link": "No Drive folder link given",
  "invalid-drive-link": "Could not read a folder id from that link",
  error: "Error",
};

const TEMPLATE_CSV =
  "course,semester,subject,drivelink,year\n" +
  "B.Com (Hons),3,Cost Accounting,https://drive.google.com/drive/folders/REPLACE_WITH_FOLDER_ID,\n";

export function SpreadsheetImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SpreadsheetImportRowResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(file: File) {
    setRunning(true);
    setError(null);
    setResults(null);
    try {
      const formData = new FormData();
      formData.set("file", file);
      const { results } = await importPapersFromSpreadsheetAction(formData);
      setResults(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process that file.");
    } finally {
      setRunning(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notevault-bulk-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const importedCount = results?.filter((r) => r.status === "imported").length ?? 0;
  const totalFiles = results?.reduce((sum, r) => sum + (r.filesImported ?? 0), 0) ?? 0;
  const issues = results?.filter((r) => r.status !== "imported" && r.status !== "no-new-files") ?? [];

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-4">
        <h2 className="flex items-center gap-2 font-medium">
          <FileXls size={18} weight="bold" className="text-accent" />
          Import from spreadsheet
        </h2>
        <button
          type="button"
          onClick={downloadTemplate}
          className="shrink-0 text-xs font-medium text-accent underline-offset-2 hover:underline"
        >
          Download template
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Columns: <code>course</code>, <code>semester</code>, <code>subject</code>,{" "}
        <code>drivelink</code> (or <code>link</code>/<code>url</code>), and optionally{" "}
        <code>year</code>. One row per subject — the Drive link should be a{" "}
        <span className="font-medium text-foreground">folder</span> containing that subject&apos;s
        papers; every PDF inside is imported as a paper (duplicates are skipped automatically).
        Accepts .csv or .xlsx.
      </p>

      <div
        className="mt-3 flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border bg-background px-4 py-3 text-sm transition hover:border-accent/60"
        onClick={() => inputRef.current?.click()}
      >
        <UploadSimple size={18} className="shrink-0 text-muted" />
        <span className="text-foreground">{fileName ?? "Click to choose a .csv or .xlsx file"}</span>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
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

      {running && <p className="mt-3 text-sm text-muted">Matching courses and crawling Drive folders…</p>}
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

      {results && (
        <div className="mt-4">
          <p className="text-sm font-medium">
            {importedCount} of {results.length} row{results.length === 1 ? "" : "s"} imported —{" "}
            {totalFiles} paper{totalFiles === 1 ? "" : "s"} added
          </p>
          {issues.length > 0 && (
            <ul className="mt-2 flex flex-col gap-1 rounded-lg border border-border bg-background p-3 text-xs">
              {issues.map((r, i) => (
                <li key={i} className="text-muted">
                  <span className="font-medium text-foreground">
                    {r.course} / {r.semester} / {r.subject}
                  </span>{" "}
                  — {STATUS_LABEL[r.status]}
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
