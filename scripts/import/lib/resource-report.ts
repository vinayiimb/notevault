// Report writers for the Phase 3 resource wave — mirrors report.ts's shape
// but writes the three resource-specific files the task calls for.
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ResourceImportPlan } from "./resource-plan";

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

export async function writeResourceRejectionsCsv(dir: string, plan: ResourceImportPlan): Promise<number> {
  const rows: string[][] = [];
  for (const o of plan.outcomes) {
    if (o.status === "rejected") {
      rows.push([o.record.naturalKey, "rejected", o.issues.join("; "), o.record.original.exportSubjectName, o.record.data.fileUrl]);
    } else if (o.status === "unresolved_subject") {
      rows.push([o.record.naturalKey, "unresolved_subject", o.reason, o.record.original.exportSubjectName, o.record.data.fileUrl]);
    } else if (o.status === "missing_storage_reference") {
      rows.push([o.record.naturalKey, "missing_storage_reference", o.reason, o.record.original.exportSubjectName, o.record.data.fileUrl]);
    }
  }
  const csv = toCsv(["naturalKey", "status", "reason", "originalSubjectName", "fileUrl"], rows);
  await writeFile(path.join(dir, "resource-import-rejections.csv"), csv, "utf-8");
  return rows.length;
}

export async function writeResourceWarningsCsv(dir: string, plan: ResourceImportPlan): Promise<number> {
  const rows: string[][] = plan.sourceWarnings.map((w) => [w.model, w.sourceFile, w.sourceRowRef, w.field, w.message]);
  const csv = toCsv(["model", "sourceFile", "sourceRowRef", "field", "message"], rows);
  await writeFile(path.join(dir, "resource-import-warnings.csv"), csv, "utf-8");
  return rows.length;
}

export async function writeResourcePreviewJson(
  dir: string,
  data: {
    generatedAt: string;
    target: { hostname: string };
    mode: "preview" | "validate";
    sourceRecordCount: number;
    perStatus: Record<string, number>;
    exactDuplicateGroups: number;
    probableDuplicateGroups: number;
    exactDuplicateDetail: { key: string; naturalKeys: string[] }[];
    probableDuplicateDetail: { reason: string; naturalKeys: string[] }[];
  },
): Promise<void> {
  await writeFile(path.join(dir, "resource-import-preview.json"), JSON.stringify(data, null, 2) + "\n", "utf-8");
}
