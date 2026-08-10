"use client";

import Link from "next/link";
import { useMemo, useRef, useState, useTransition } from "react";
import { FileXls, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import {
  startBulkUploadBatchAction,
  classifyAndPersistRowsAction,
  finalizeBulkUploadValidationAction,
  commitBulkUploadRowsAction,
  skipBulkUploadRowsAction,
  type BulkUploadRowSummary,
  type BulkUploadValidateResult,
} from "@/lib/actions";
import type { BulkUploadRowStatus } from "@/generated/prisma";

// Rows per commit/validate call — each chunk is one progress-bar tick.
// Validate chunks are bigger than commit chunks because persisting a
// BulkUploadRow is one cheap insert, versus commit's dedupe-check + create
// + status-update per row.
const COMMIT_CHUNK_SIZE = 30;
const VALIDATE_CHUNK_SIZE = 100;

// Mirrors extractFileUrlRaw in @/lib/bulk-upload, duplicated here rather
// than imported — that module also exports bulkRowFileHash, which pulls in
// node:crypto, and importing it (even just for this one pure function)
// would drag node:crypto into the client bundle.
function pickFileUrlRaw(row: Record<string, string>): string | null {
  for (const key of ["fileurl", "file url", "pdfurl", "pdf url", "link", "url"]) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return null;
}

const STATUS_LABEL: Record<BulkUploadRowStatus, string> = {
  VALID: "Valid",
  IMPORTED: "Imported",
  SKIPPED: "Skipped",
  DUPLICATE: "Duplicate",
  INVALID: "Invalid",
};

const STATUS_TONE: Record<BulkUploadRowStatus, string> = {
  VALID: "text-emerald-600",
  IMPORTED: "text-emerald-600",
  SKIPPED: "text-muted",
  DUPLICATE: "text-amber-600",
  INVALID: "text-red-500",
};

const TEMPLATE_CSV =
  "course,subject,yearrange,semestergroup,semester,fileurl,filename,note\n" +
  '"Applied Psychology","Applied Social Psychology",2020-2021,"I,III,V",3,https://example.edu/papers/Applied_Social_Psychology_Sem3.pdf,,\n';

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" && value > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-surface"}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ProgressBar({ label, done, total }: { label: string; done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between text-sm">
        <p className="font-semibold text-foreground">{label}</p>
        <p className="font-mono text-xs text-muted">
          {done} / {total}
        </p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface-muted">
        <div className="h-full rounded-full bg-accent transition-[width] duration-300 ease-out" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function FreshUploadPanel() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkUploadValidateResult | null>(null);
  const [approved, setApproved] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<BulkUploadRowStatus | "ALL">("ALL");
  const [commitResult, setCommitResult] = useState<{ imported: number; duplicate: number; skipped: number } | null>(null);
  const [commitProgress, setCommitProgress] = useState<{ done: number; total: number } | null>(null);
  const [validateProgress, setValidateProgress] = useState<{ done: number; total: number } | null>(null);

  function run(file: File) {
    setError(null);
    setResult(null);
    setCommitResult(null);
    startTransition(async () => {
      try {
        const { parseSpreadsheetRows } = await import("@/lib/spreadsheet");
        const rawRows = await parseSpreadsheetRows(file);
        if (rawRows.length === 0) {
          throw new Error(
            "Could not read any rows from that file — check it has a header row with course, subject, year range, semester group, and a file URL column."
          );
        }

        const startFormData = new FormData();
        startFormData.set("sourceFileName", file.name);
        for (const url of rawRows.map(pickFileUrlRaw).filter((u): u is string => !!u)) {
          startFormData.append("fileUrls", url);
        }
        const { batchId, existingHashes } = await startBulkUploadBatchAction(startFormData);

        const total = rawRows.length;
        setValidateProgress({ done: 0, total });

        const allRows: BulkUploadRowSummary[] = [];
        for (let i = 0; i < rawRows.length; i += VALIDATE_CHUNK_SIZE) {
          const chunk = rawRows.slice(i, i + VALIDATE_CHUNK_SIZE);
          const formData = new FormData();
          formData.set("batchId", batchId);
          formData.set("startRowNumber", String(i + 1));
          formData.set("rows", JSON.stringify(chunk));
          formData.set("existingHashes", JSON.stringify(existingHashes));
          const { rows: chunkRows } = await classifyAndPersistRowsAction(formData);
          allRows.push(...chunkRows);
          setValidateProgress({ done: Math.min(i + VALIDATE_CHUNK_SIZE, total), total });
        }

        await finalizeBulkUploadValidationAction();

        const summary: Partial<Record<BulkUploadRowStatus, number>> = {};
        for (const row of allRows) summary[row.status] = (summary[row.status] ?? 0) + 1;

        const res: BulkUploadValidateResult = { batchId, sourceFileName: file.name, rows: allRows, summary };
        setResult(res);
        setApproved(new Set(allRows.filter((r) => r.status === "VALID").map((r) => r.id)));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not process that file.");
      } finally {
        setValidateProgress(null);
      }
    });
  }

  function downloadTemplate() {
    const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "notevault-bulk-upload-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function commit() {
    if (!result) return;
    const approvedIds = [...approved];
    const total = approvedIds.length;
    setCommitProgress({ done: 0, total });
    startTransition(async () => {
      try {
        let imported = 0;
        let duplicate = 0;
        const statusById = new Map<string, { status: BulkUploadRowStatus; message: string | null }>();

        for (let i = 0; i < approvedIds.length; i += COMMIT_CHUNK_SIZE) {
          const chunk = approvedIds.slice(i, i + COMMIT_CHUNK_SIZE);
          const formData = new FormData();
          formData.set("batchId", result.batchId);
          for (const id of chunk) formData.append("rowIds", id);
          const { results: chunkResults } = await commitBulkUploadRowsAction(formData);

          for (const r of chunkResults) {
            statusById.set(r.id, { status: r.status, message: r.message });
            if (r.status === "IMPORTED") imported += 1;
            if (r.status === "DUPLICATE") duplicate += 1;
          }
          setResult((prev) =>
            prev
              ? { ...prev, rows: prev.rows.map((row) => (statusById.has(row.id) ? { ...row, ...statusById.get(row.id)! } : row)) }
              : prev
          );
          setCommitProgress({ done: Math.min(i + COMMIT_CHUNK_SIZE, total), total });
        }

        const unapprovedIds = result.rows.filter((r) => r.status === "VALID" && !approved.has(r.id)).map((r) => r.id);
        let skipped = 0;
        if (unapprovedIds.length > 0) {
          const skipFormData = new FormData();
          skipFormData.set("batchId", result.batchId);
          for (const id of unapprovedIds) skipFormData.append("rowIds", id);
          const skipRes = await skipBulkUploadRowsAction(skipFormData);
          skipped = skipRes.skipped;
          setResult((prev) =>
            prev
              ? { ...prev, rows: prev.rows.map((row) => (unapprovedIds.includes(row.id) ? { ...row, status: "SKIPPED" as BulkUploadRowStatus } : row)) }
              : prev
          );
        }

        setCommitResult({ imported, duplicate, skipped });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not import the approved rows.");
      } finally {
        setCommitProgress(null);
      }
    });
  }

  const rows = useMemo(() => result?.rows ?? [], [result]);
  const filteredRows = useMemo(
    () => (statusFilter === "ALL" ? rows : rows.filter((r) => r.status === statusFilter)),
    [rows, statusFilter]
  );
  const alreadyCommitted = commitResult !== null;

  return (
    <div className="space-y-6">
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
          One row per catalog entry, added straight to the Full Archive. Columns: <code>course</code>,{" "}
          <code>subject</code>, <code>yearrange</code> (e.g. 2020-2021), <code>semestergroup</code> (e.g.
          &quot;I,III,V&quot;), <code>semester</code> (optional single semester number), a{" "}
          <code>fileurl</code> (or <code>pdfurl</code>/<code>link</code>/<code>url</code>) pointing at the
          paper, and optionally <code>filename</code>/<code>note</code>. Accepts .csv or .xlsx. Nothing is
          imported until you review and approve the rows below.
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

        {validateProgress && (
          <div className="mt-3">
            <ProgressBar label="Validating…" done={validateProgress.done} total={validateProgress.total} />
          </div>
        )}
        {pending && !result && !validateProgress && <p className="mt-3 text-sm text-muted">Reading file…</p>}
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      </div>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <StatCard label="Valid" value={result.summary.VALID ?? 0} />
            <StatCard label="Duplicate" value={result.summary.DUPLICATE ?? 0} tone="warn" />
            <StatCard label="Invalid" value={result.summary.INVALID ?? 0} tone="warn" />
          </div>

          {commitProgress ? (
            <ProgressBar label="Importing…" done={commitProgress.done} total={commitProgress.total} />
          ) : commitResult ? (
            <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/5 p-4 text-sm">
              <p className="font-semibold text-foreground">
                Imported {commitResult.imported} catalog entr{commitResult.imported === 1 ? "y" : "ies"}
                {commitResult.duplicate > 0 ? `, ${commitResult.duplicate} already in the catalog` : ""}
                {commitResult.skipped > 0 ? `, skipped ${commitResult.skipped} unapproved row${commitResult.skipped === 1 ? "" : "s"}` : ""}.
              </p>
              <Link href={`/admin/bulk-upload/${result.batchId}`} className="mt-1 inline-block text-xs font-medium text-accent underline-offset-2 hover:underline">
                View this batch
              </Link>
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
              >
                <option value="ALL">All rows ({rows.length})</option>
                {(Object.keys(STATUS_LABEL) as BulkUploadRowStatus[])
                  .filter((s) => s !== "IMPORTED" && s !== "SKIPPED")
                  .map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]} ({result.summary[s] ?? 0})
                    </option>
                  ))}
              </select>
              <button
                type="button"
                disabled={pending || approved.size === 0}
                onClick={commit}
                className="rounded-xl bg-accent px-4 py-2.5 text-sm font-bold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
              >
                {pending ? "Importing…" : `Import ${approved.size} approved row${approved.size === 1 ? "" : "s"}`}
              </button>
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface-muted text-muted">
                <tr>
                  {!alreadyCommitted && <th className="w-8 px-3 py-2" />}
                  <th className="px-3 py-2">Row</th>
                  <th className="px-3 py-2">Course</th>
                  <th className="px-3 py-2">Subject</th>
                  <th className="px-3 py-2">Year range</th>
                  <th className="px-3 py-2">Sem group</th>
                  <th className="px-3 py-2">File</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRows.map((r) => (
                  <RowLine
                    key={r.id}
                    row={r}
                    checked={approved.has(r.id)}
                    disabled={alreadyCommitted || r.status !== "VALID"}
                    onToggle={(checked) =>
                      setApproved((prev) => {
                        const next = new Set(prev);
                        if (checked) next.add(r.id);
                        else next.delete(r.id);
                        return next;
                      })
                    }
                    showCheckbox={!alreadyCommitted}
                  />
                ))}
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted">
                      No rows match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RowLine({
  row,
  checked,
  disabled,
  onToggle,
  showCheckbox,
}: {
  row: BulkUploadRowSummary;
  checked: boolean;
  disabled: boolean;
  onToggle: (checked: boolean) => void;
  showCheckbox: boolean;
}) {
  return (
    <tr>
      {showCheckbox && (
        <td className="px-3 py-2">
          <input
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(e) => onToggle(e.target.checked)}
          />
        </td>
      )}
      <td className="px-3 py-2 text-muted">{row.rowNumber}</td>
      <td className="px-3 py-2 text-foreground">{row.courseRaw || "—"}</td>
      <td className="px-3 py-2 text-foreground">{row.subjectRaw || "—"}</td>
      <td className="px-3 py-2 text-muted">{row.yearRangeRaw || "—"}</td>
      <td className="px-3 py-2 text-muted">{row.semesterGroupRaw || "—"}</td>
      <td className="max-w-[200px] truncate px-3 py-2 text-muted" title={row.fileNameRaw || row.fileUrlRaw || ""}>
        {row.fileNameRaw || row.fileUrlRaw || "—"}
      </td>
      <td className={`px-3 py-2 font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</td>
      <td className="px-3 py-2 text-muted">{row.message || "—"}</td>
    </tr>
  );
}
