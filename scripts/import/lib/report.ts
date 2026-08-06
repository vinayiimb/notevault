// Report writers for docs/PHASE_2C_DATA_IMPORT_PLAN.md item 8. Every writer
// here only ever receives already-computed, non-sensitive summary data —
// none of these functions touch a database connection string or any
// personal data (Phase 2C explicitly keeps auth/student/feedback tables
// untouched and empty this phase, so there is nothing sensitive to leak).
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RowOutcome, WarningEntry } from "./types";

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function toCsv(header: string[], rows: string[][]): string {
  return [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n") + "\n";
}

export async function ensureReportsDir(dir: string): Promise<void> {
  await mkdir(dir, { recursive: true });
}

export async function writeRejectionsCsv(dir: string, outcomes: RowOutcome[]): Promise<number> {
  const rejected = outcomes.filter((o) => o.status === "rejected" || o.status === "unresolved_fk");
  const rows = rejected.map((o) => [
    o.record.model,
    o.record.naturalKey,
    o.record.provenance.sourceFile,
    o.record.provenance.sourceRowRef,
    o.status,
    o.status === "rejected" ? o.issues.join("; ") : `missing parent: ${o.missingParent}`,
  ]);
  const csv = toCsv(["model", "naturalKey", "sourceFile", "sourceRowRef", "status", "reason"], rows);
  await writeFile(path.join(dir, "import-rejections.csv"), csv, "utf-8");
  return rejected.length;
}

export async function writeWarningsCsv(dir: string, warnings: WarningEntry[]): Promise<number> {
  const rows = warnings.map((w) => [w.model, w.sourceFile, w.sourceRowRef, w.field, w.message]);
  const csv = toCsv(["model", "sourceFile", "sourceRowRef", "field", "message"], rows);
  await writeFile(path.join(dir, "import-warnings.csv"), csv, "utf-8");
  return warnings.length;
}

export async function writeProposedAliasesCsv(
  dir: string,
  aliases: { canonicalKey: string; variants: string[] }[],
): Promise<number> {
  const rows = aliases.map((a) => [a.canonicalKey, a.variants.join(" | "), String(a.variants.length)]);
  const csv = toCsv(["canonicalKey", "variants", "variantCount"], rows);
  await writeFile(path.join(dir, "proposed-subject-aliases.csv"), csv, "utf-8");
  return aliases.length;
}

export type PreviewSummary = {
  generatedAt: string;
  target: { hostname: string };
  mode: "preview" | "validate";
  sources: { name: string; file: string; recordCount: number; warningCount: number }[];
  perModel: Record<
    string,
    { toCreate: number; alreadyExists: number; rejected: number; unresolvedForeignKey: number }
  >;
  exactDuplicateGroups: number;
  probableDuplicateGroups: number;
  proposedAliasGroups: number;
  modelsRemainingEmpty: string[];
  estimatedDatabaseWrites: number;
};

export async function writePreviewSummaryJson(dir: string, summary: PreviewSummary): Promise<void> {
  await writeFile(path.join(dir, "import-preview-summary.json"), JSON.stringify(summary, null, 2) + "\n", "utf-8");
}
