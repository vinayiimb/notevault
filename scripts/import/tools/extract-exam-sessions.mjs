// Regenerates src/data/exam-sessions-source.ts from the SESSIONS literal in
// prisma/seed-historical-exam-sessions.ts, without ever importing/executing
// that script (it runs its own PrismaClient main() on import with no target
// guard). Pure text extraction — reads the file, does not execute it.
import { readFileSync, writeFileSync } from "node:fs";

const SOURCE = "prisma/seed-historical-exam-sessions.ts";
const OUTPUT = "src/data/exam-sessions-source.ts";
const MARKER = "const SESSIONS: SessionDef[] = ";

const src = readFileSync(SOURCE, "utf-8");
const markerIndex = src.indexOf(MARKER);
if (markerIndex === -1) {
  throw new Error(`Could not find "${MARKER}" in ${SOURCE} — has the script been renamed/restructured?`);
}
const arrStart = markerIndex + MARKER.length;
let depth = 0;
let end = -1;
for (let i = arrStart; i < src.length; i++) {
  if (src[i] === "[") depth++;
  else if (src[i] === "]") {
    depth--;
    if (depth === 0) {
      end = i;
      break;
    }
  }
}
if (end === -1) throw new Error("Could not find the end of the SESSIONS array literal.");

const arrText = src.slice(arrStart, end + 1);
// Sanity check: must parse as a plain array literal (no imports/functions).
const rows = eval(arrText);
if (!Array.isArray(rows) || rows.length === 0) {
  throw new Error("Extracted SESSIONS literal did not evaluate to a non-empty array.");
}

const header = `// Extracted, read-only copy of the SESSIONS literal from
// prisma/seed-historical-exam-sessions.ts. That script executes its own
// main() (with its own PrismaClient + .env.local/.env loading) immediately
// on import, with no target guard — unsafe to import directly into the
// staging-only importer (see docs/PHASE_2C_DATA_IMPORT_PLAN.md item 3).
// This file has zero side effects: importing it only gives you the data.
//
// Regenerate with: node scripts/import/tools/extract-exam-sessions.mjs

export type ExamSessionSourceRow = { course: string; url: string };
export type ExamSessionSourceDef = { label: string; order: number; rows: ExamSessionSourceRow[] };

export const EXAM_SESSIONS_SOURCE: ExamSessionSourceDef[] = ${arrText};
`;

writeFileSync(OUTPUT, header);
console.log(`Wrote ${OUTPUT}: ${rows.length} sessions, ${rows.reduce((s, x) => s + x.rows.length, 0)} course rows.`);
