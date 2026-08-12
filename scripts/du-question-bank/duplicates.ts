// Phase 12: duplicate detection over the scraped catalogue itself (not the
// NoteVault DB — that's compare.ts). Strongest identifier wins first.
import { PATHS } from "./config";
import { writeGenericCsv } from "./csv-writer";
import type { QuestionPaperRecord } from "./types";

type Classification = "EXACT_DUPLICATE" | "PROBABLE_DUPLICATE" | "UNIQUE" | "REVIEW_REQUIRED";

function normalizeName(name: string | null): string {
  if (!name) return "";
  return name.trim().toLowerCase().replace(/\s+/g, " ").replace(/[-–—]/g, "-");
}

export function detectDuplicates(records: QuestionPaperRecord[]): { row: Record<string, unknown> }[] {
  const rows: { row: Record<string, unknown> }[] = [];

  const byPdfUrl = new Map<string, QuestionPaperRecord[]>();
  const byDetailUrl = new Map<string, QuestionPaperRecord[]>();
  const byUpcSessionSet = new Map<string, QuestionPaperRecord[]>();
  const byNameSessionDept = new Map<string, QuestionPaperRecord[]>();

  for (const r of records) {
    if (r.pdf_url) {
      const key = r.pdf_url;
      byPdfUrl.set(key, [...(byPdfUrl.get(key) ?? []), r]);
    }
    byDetailUrl.set(r.detail_url, [...(byDetailUrl.get(r.detail_url) ?? []), r]);
    if (r.upc && r.examination_session) {
      const key = `${r.upc}|${r.examination_session}|${r.set ?? ""}`;
      byUpcSessionSet.set(key, [...(byUpcSessionSet.get(key) ?? []), r]);
    }
    const nameKey = `${normalizeName(r.paper_name)}|${r.examination_session ?? ""}|${r.department_name ?? ""}`;
    byNameSessionDept.set(nameKey, [...(byNameSessionDept.get(nameKey) ?? []), r]);
  }

  const seen = new Set<string>();
  for (const r of records) {
    if (seen.has(r.detail_url)) continue;

    let classification: Classification = "UNIQUE";
    let method = "none";
    let groupSize = 1;

    const pdfGroup = r.pdf_url ? byPdfUrl.get(r.pdf_url) ?? [] : [];
    const upcGroup = r.upc && r.examination_session ? byUpcSessionSet.get(`${r.upc}|${r.examination_session}|${r.set ?? ""}`) ?? [] : [];
    const nameGroup = byNameSessionDept.get(`${normalizeName(r.paper_name)}|${r.examination_session ?? ""}|${r.department_name ?? ""}`) ?? [];

    if (pdfGroup.length > 1) {
      classification = "EXACT_DUPLICATE";
      method = "pdf_url";
      groupSize = pdfGroup.length;
    } else if (upcGroup.length > 1) {
      classification = "PROBABLE_DUPLICATE";
      method = "upc+session+set";
      groupSize = upcGroup.length;
    } else if (nameGroup.length > 1) {
      classification = "REVIEW_REQUIRED";
      method = "normalized_name+session+department";
      groupSize = nameGroup.length;
    }

    for (const member of classification === "UNIQUE" ? [r] : (pdfGroup.length > 1 ? pdfGroup : upcGroup.length > 1 ? upcGroup : nameGroup)) {
      if (seen.has(member.detail_url)) continue;
      seen.add(member.detail_url);
      rows.push({
        row: {
          classification,
          match_method: method,
          group_size: groupSize,
          paper_name: member.paper_name,
          department: member.department_name,
          upc: member.upc,
          exam_session: member.examination_session,
          set: member.set,
          detail_url: member.detail_url,
          pdf_url: member.pdf_url,
        },
      });
    }
  }
  return rows;
}

export function writeDuplicatesCsv(records: QuestionPaperRecord[]): number {
  const rows = detectDuplicates(records).map((r) => r.row);
  writeGenericCsv(
    rows,
    ["classification", "match_method", "group_size", "paper_name", "department", "upc", "exam_session", "set", "detail_url", "pdf_url"],
    PATHS.duplicatesCsv,
  );
  return rows.filter((r) => r.classification !== "UNIQUE").length;
}
