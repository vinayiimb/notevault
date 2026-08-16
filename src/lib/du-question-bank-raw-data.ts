import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

export interface DuQuestionBankRow {
  officialProgramme: string;
  semester: string | null;
  paperType: string | null;
  subjectPaperName: string;
  courseNumber: string | null;
  upc: string | null;
  credits: string | null;
  officialPaperLink: string | null;
  questionPaperLink: string | null;
  questionPaperSession: string | null;
  questionPaperYear: string | null;
  questionPaperSet: string | null;
  questionPaperMarks: string | null;
  isShivaji?: boolean;
  isKalindi?: boolean;
  isANDC?: boolean;
  isRamanujan?: boolean;
  college?: string;
}

let cached: DuQuestionBankRow[] | null = null;

// Read src/data/du-question-bank-full-mapped.json (18MB, 15,165 rows) via
// fs at runtime rather than a static `import` — this file is consumed by
// pyq-catalog.ts and du-pyp-data.ts, both imported extremely widely (nearly
// every content page). A JS import of an 18MB JSON gets inlined into every
// function that transitively imports either module; on Netlify specifically
// the whole app collapses into one function, so that alone pushed it past
// the 250MB deploy limit. Centralized here (rather than each caller reading
// the file itself) so the module-level cache is actually shared instead of
// re-parsing the same 18MB three times per cold start. See the matching
// outputFileTracingIncludes entry in next.config.ts, which is what makes
// the file actually present on disk for readFileSync to find at runtime.
export function getDuQuestionBankRows(): DuQuestionBankRow[] {
  if (cached) return cached;
  const filePath = path.join(process.cwd(), "src/data/du-question-bank-full-mapped.json");
  cached = JSON.parse(readFileSync(filePath, "utf-8")) as DuQuestionBankRow[];
  return cached;
}
