import { writeFileSync } from "node:fs";
import type { QuestionPaperRecord } from "./types";

const COLUMNS: { key: keyof QuestionPaperRecord | "department" | "exam_session"; header: string }[] = [
  { key: "source", header: "source" },
  { key: "department", header: "department" },
  { key: "paper_name", header: "paper_name" },
  { key: "paper_code", header: "paper_code" },
  { key: "upc", header: "upc" },
  { key: "programme", header: "programme" },
  { key: "course", header: "course" },
  { key: "semester", header: "semester" },
  { key: "exam_session", header: "exam_session" },
  { key: "year", header: "year" },
  { key: "marks", header: "marks" },
  { key: "set", header: "set" },
  { key: "question_for", header: "question_for" },
  { key: "remarks", header: "remarks" },
  { key: "detail_url", header: "detail_url" },
  { key: "pdf_url", header: "pdf_url" },
  { key: "pdf_filename", header: "pdf_filename" },
  { key: "scraped_at", header: "scraped_at" },
];

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function writeQuestionPapersCsv(records: QuestionPaperRecord[], path: string): void {
  const lines = [COLUMNS.map((c) => c.header).join(",")];
  for (const r of records) {
    const row = COLUMNS.map((c) => {
      if (c.key === "department") return csvEscape(r.department_name);
      if (c.key === "exam_session") return csvEscape(r.examination_session);
      return csvEscape((r as Record<string, unknown>)[c.key]);
    });
    lines.push(row.join(","));
  }
  writeFileSync(path, lines.join("\n") + "\n");
}

export function writeGenericCsv(rows: Record<string, unknown>[], headers: string[], path: string): void {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  writeFileSync(path, lines.join("\n") + "\n");
}
