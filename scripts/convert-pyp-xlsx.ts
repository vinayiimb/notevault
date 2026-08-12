#!/usr/bin/env npx tsx
/**
 * Converts full_annotated_papers_crosschecked.xlsx → src/data/du-pyp-annotated.json
 * Normalizes semester strings to Roman numerals I–VIII
 */
import * as XLSX from "xlsx";
import fs from "fs";
import path from "path";

const XLSX_PATH = "/Users/sayam/Downloads/full_annotated_papers_crosschecked.xlsx";
const OUTPUT_PATH = path.join(process.cwd(), "src/data/du-pyp-annotated.json");

function normalizeSemester(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const s = String(raw).trim();

  // Handle "Pool / not fixed" etc.
  if (s.toLowerCase().includes("pool") || s.toLowerCase().includes("not fixed")) return ["Pool"];

  // Map word forms like "Semester 1", "Semester-1", "Semester- I" → "I"
  const wordMap: Record<string, string> = {
    "1": "I", "2": "II", "3": "III", "4": "IV",
    "5": "V", "6": "VI", "7": "VII", "8": "VIII",
    "i": "I", "ii": "II", "iii": "III", "iv": "IV",
    "v": "V", "vi": "VI", "vii": "VII", "viii": "VIII",
  };

  // Strip "Semester " prefix variants
  let cleaned = s
    .replace(/semester[-–\s]*/gi, "")
    .replace(/\bIIi\b/g, "III") // typo fix
    .trim();

  // Split on "/" or "," or " " for multi-semester values
  const parts = cleaned.split(/[\/,\s]+/).filter(Boolean);
  const sems = new Set<string>();
  for (const part of parts) {
    const key = part.trim().toLowerCase();
    if (wordMap[key]) {
      sems.add(wordMap[key]);
    } else if (/^[IVX]+$/i.test(part)) {
      // Already roman numeral-like
      sems.add(part.toUpperCase());
    }
  }
  return [...sems].sort((a, b) => {
    const order = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    return order.indexOf(a) - order.indexOf(b);
  });
}

function normalizePaperType(raw: string | null | undefined): string {
  if (!raw) return "Other";
  const s = String(raw).trim();
  const map: Record<string, string> = {
    "DSC/Core": "DSC",
    "DSC": "DSC",
    "Core": "DSC",
    "DSE": "DSE",
    "GE": "GE",
    "AEC": "AEC",
    "SEC": "SEC",
    "VAC": "VAC",
    "Academic Track": "Academic Track",
    "Community Outreach": "Community Outreach",
    "Compulsory": "Compulsory",
  };
  return map[s] ?? s;
}

async function main() {
  console.log("Reading XLSX:", XLSX_PATH);
  const workbook = XLSX.readFile(XLSX_PATH);
  const ws = workbook.Sheets["All Papers (Full List)"];
  if (!ws) throw new Error("Sheet 'All Papers (Full List)' not found");

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: null });
  console.log(`Total raw rows: ${rawRows.length}`);

  interface PypPaper {
    programme: string;
    semesters: string[];
    paperType: string;
    subjectName: string;
    canonicalName: string;
    courseNumber: string | null;
    upc: string | null;
    credits: string | null;
    officialLink: string | null;
  }

  const papers: PypPaper[] = [];

  for (const row of rawRows) {
    const programme = String(row["Official Programme"] ?? "").trim();
    if (!programme) continue;

    const semesters = normalizeSemester(row["Semester"] as string);
    const paperType = normalizePaperType(row["Paper Type"] as string);
    const subjectName = String(row["Subject / Paper Name"] ?? "").trim();
    const canonicalName = String(row["Canonical Subject Name"] ?? row["Subject / Paper Name"] ?? "").trim();
    const courseNumber = row["Course Number"] ? String(row["Course Number"]).trim() : null;
    const upc = row["UPC"] ? String(row["UPC"]).trim() : null;
    const credits = row["Credits"] ? String(row["Credits"]).trim() : null;
    const officialLink = row["Official Paper Link"] ? String(row["Official Paper Link"]).trim() : null;

    if (!subjectName || !programme) continue;

    papers.push({
      programme,
      semesters,
      paperType,
      subjectName,
      canonicalName,
      courseNumber,
      upc,
      credits,
      officialLink,
    });
  }

  console.log(`Processed ${papers.length} papers`);

  // Stats
  const programmes = new Set(papers.map(p => p.programme));
  const paperTypes = new Set(papers.map(p => p.paperType));
  console.log(`Unique programmes: ${programmes.size}`);
  console.log(`Paper types: ${[...paperTypes].sort().join(", ")}`);

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(papers, null, 2));
  console.log(`Written to: ${OUTPUT_PATH}`);
}

main().catch(err => { console.error(err); process.exit(1); });
