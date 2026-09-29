// Imports a question-bank CSV/Excel file directly, for Claude (or an admin
// at the terminal) to run on the user's behalf — the user said they'd hand
// files over in conversation rather than use the admin upload page, so this
// exists alongside (not instead of) validateQuestionCsvAction/
// commitQuestionCsvAction, which the admin UI still uses.
//
// Usage:
//   npx tsx scripts/import-questions-csv.ts path/to/questions.csv
//   npx tsx scripts/import-questions-csv.ts path/to/questions.csv --dry-run
//
// Same fixed format as the admin CSV upload:
//   SubjectId (required, exact), Question (required), Answer (required),
//   Marks, Years, RepeatCount (all optional).
import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { parseCsv } from "../src/lib/csv";
// A standalone script can't import src/lib/prisma.ts (it's guarded by
// "server-only", which throws outside a Next.js server context) — use
// @prisma/client directly instead, same package the app itself queries
// through, just without that guard.
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const filePath = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  if (!filePath) {
    console.error("Usage: npx tsx scripts/import-questions-csv.ts <file.csv> [--dry-run]");
    process.exit(1);
  }

  let rows: Record<string, string>[];
  if (filePath.toLowerCase().endsWith(".xlsx") || filePath.toLowerCase().endsWith(".xls")) {
    const XLSX = await import("xlsx");
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const raw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });
    rows = raw.map((row) => {
      const obj: Record<string, string> = {};
      for (const [key, value] of Object.entries(row)) {
        obj[key.trim().toLowerCase()] = String(value ?? "").trim();
      }
      return obj;
    });
  } else {
    rows = parseCsv(readFileSync(filePath, "utf8"));
  }

  console.log(`Read ${rows.length} row(s) from ${basename(filePath)}${dryRun ? " (dry run — nothing will be written)" : ""}\n`);

  if (rows.length === 0) {
    console.error("No data rows found — check the file has a header row plus at least one question.");
    process.exit(1);
  }

  const subjectIds = [...new Set(rows.map((r) => r.subjectid?.trim()).filter(Boolean))] as string[];
  // Raw SQL, not prisma.subject.findMany(): the live database is missing a
  // column (Subject.parentSubjectId) that's in schema.prisma but was never
  // migrated in, which makes any ORM query selecting the full Subject model
  // fail. Selecting only the columns that do exist sidesteps it.
  const subjects =
    subjectIds.length === 0
      ? []
      : await prisma.$queryRaw<{ id: string; name: string; programName: string }[]>`
          SELECT s.id, s.name, p.name as "programName"
          FROM "Subject" s
          JOIN "Term" t ON t.id = s."termId"
          JOIN "Program" p ON p.id = t."programId"
          WHERE s.id = ANY(${subjectIds})
        `;
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const toInsert: Prisma.QuestionCreateManyInput[] = [];
  let errorCount = 0;

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    const subjectId = row.subjectid?.trim() ?? "";
    const questionText = row.question?.trim() ?? "";
    const answerText = row.answer?.trim() ?? "";
    const preview = questionText.slice(0, 60) || "(empty)";

    const fail = (reason: string) => {
      console.log(`  row ${rowNumber}  ERROR  ${reason}  — "${preview}"`);
      errorCount++;
    };

    if (!subjectId) return fail("Missing SubjectId");
    if (!questionText) return fail("Missing Question");
    if (!answerText) return fail("Missing Answer");
    const subject = subjectById.get(subjectId);
    if (!subject) return fail(`SubjectId "${subjectId}" does not match any existing subject`);

    const marksRaw = row.marks?.trim();
    if (marksRaw && Number.isNaN(Number(marksRaw))) return fail(`Marks "${marksRaw}" is not a number`);
    const repeatRaw = row.repeatcount?.trim();
    if (repeatRaw && Number.isNaN(Number(repeatRaw))) return fail(`RepeatCount "${repeatRaw}" is not a number`);

    const marks = marksRaw ? Number(marksRaw) : null;
    const years = row.years?.trim() || null;
    const repeatCount = repeatRaw ? Number(repeatRaw) : 1;

    console.log(`  row ${rowNumber}  ok     ${subject.programName} · ${subject.name}  — "${preview}"`);
    toInsert.push({
      subjectId,
      questionText,
      answerText,
      marks,
      years,
      isRepeated: repeatCount > 1,
      repeatCount,
    });
  });

  console.log(`\n${toInsert.length} valid, ${errorCount} error(s).`);

  if (dryRun) {
    console.log("Dry run — nothing written.");
    return;
  }

  if (toInsert.length === 0) {
    console.log("Nothing to insert.");
    return;
  }

  const result = await prisma.question.createMany({ data: toInsert });
  console.log(`Inserted ${result.count} question(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
