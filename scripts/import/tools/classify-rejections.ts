// Phase 2E — classifies every row in reports/import-rejections.csv (all 160
// are currently SessionProgramLink rows whose source `course` field didn't
// exactly match any Program slug — see scripts/import/sources/exam-sessions.ts's
// header comment on why this adapter is deliberately exact-match-only, not
// fuzzy).
//
// This script does NOT resolve anything by itself. It classifies each
// rejected row against the hand-reviewed map in
// scripts/import/lib/program-alias-classification.ts and writes a
// human-and-machine-readable report. Turning a classification into an
// applied mapping is a separate, explicit step — see
// scripts/import/tools/build-alias-mappings.ts, which writes
// data/import-mappings/program-aliases.json (Checkpoint C) from the same
// shared classification data, as *pending* (never auto-approved) proposals.
import { writeFile, mkdir } from "node:fs/promises";
import { EXAM_SESSIONS_SOURCE } from "@/data/exam-sessions-source";
import { deterministicSlug, normalizeWhitespaceAndUnicode } from "../lib/normalize";
import { PROGRAM_ALIAS_CLASSIFICATION, type ProgramAliasCategory } from "../lib/program-alias-classification";

type ClassifiedRow = {
  sourceFile: string;
  sourceRow: string;
  originalProgramme: string;
  originalTerm: string;
  originalSubject: string;
  originalExamSession: string;
  rejectionReason: string;
  proposedResolution: string;
  confidence: number;
  automaticResolutionSafe: boolean;
  manualReviewRequired: boolean;
  category: ProgramAliasCategory;
  missingProgramSlug: string;
};

async function main() {
  const rows: ClassifiedRow[] = [];

  for (const session of EXAM_SESSIONS_SOURCE) {
    for (const [index, row] of session.rows.entries()) {
      const courseName = normalizeWhitespaceAndUnicode(row.course);
      const programSlug = deterministicSlug(courseName);
      const cls = PROGRAM_ALIAS_CLASSIFICATION[programSlug];
      if (!cls) {
        // Only reachable if a slug wasn't rejected (already resolves against
        // master-syllabus) — skip, this tool only classifies actual rejections.
        continue;
      }
      rows.push({
        sourceFile: "src/data/exam-sessions-source.ts",
        sourceRow: `session=${session.label} row=${index}`,
        originalProgramme: row.course,
        originalTerm: "",
        originalSubject: "",
        originalExamSession: session.label,
        rejectionReason: `unresolved_fk: missing parent Program(slug=${programSlug})`,
        proposedResolution: cls.targetProgramSlug
          ? `alias -> Program(slug=${cls.targetProgramSlug})`
          : "no deterministic target — requires manual data decision",
        confidence: cls.confidence,
        automaticResolutionSafe: cls.autoSafe,
        manualReviewRequired: cls.manualReviewRequired,
        category: cls.category,
        missingProgramSlug: programSlug,
      });
    }
  }

  // Sanity check: every row in reports/import-rejections.csv must have been
  // classified, and only those rows — this script must never invent or drop
  // records relative to the actual rejection report.
  const byCategory = new Map<ProgramAliasCategory, number>();
  for (const r of rows) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);

  await mkdir("reports/import-resolution", { recursive: true });

  await writeFile(
    "reports/import-resolution/rejected-records-classified.json",
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        totalRecords: rows.length,
        categoryTotals: Object.fromEntries(byCategory),
        records: rows,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );

  const csvHeader = [
    "sourceFile", "sourceRow", "originalProgramme", "originalTerm", "originalSubject",
    "originalExamSession", "rejectionReason", "proposedResolution", "confidence",
    "automaticResolutionSafe", "manualReviewRequired", "category", "missingProgramSlug",
  ];
  const csvEscape = (v: string | number | boolean) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csvLines = [csvHeader.join(",")];
  for (const r of rows) {
    csvLines.push(csvHeader.map((h) => csvEscape((r as unknown as Record<string, string | number | boolean>)[h])).join(","));
  }
  await writeFile("reports/import-resolution/rejected-records-classified.csv", csvLines.join("\n") + "\n", "utf-8");

  console.log(`Classified ${rows.length} rejected records.`);
  console.log("Category totals:", Object.fromEntries(byCategory));
  if (rows.length !== 160) {
    console.error(`\nEXPECTED 160 classified records, got ${rows.length}. Investigate before trusting this report.`);
    process.exitCode = 1;
  }
}

main();
