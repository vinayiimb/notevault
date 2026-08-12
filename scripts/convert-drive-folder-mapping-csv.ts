#!/usr/bin/env npx tsx
/**
 * Converts a Drive-crawl "folder mapping" export (course/subject slugs +
 * drive_link, one row per scanned PDF) into the column shape
 * prisma/import-full-archive-csv.ts expects: course,subject,yearrange,
 * semestergroup,semester,fileurl,filename,note.
 *
 * Usage: npx tsx scripts/convert-drive-folder-mapping-csv.ts <input.csv> <output.csv>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseCsv } from "../src/lib/csv";

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error("Usage: convert-drive-folder-mapping-csv.ts <input.csv> <output.csv>");
  process.exit(1);
}

// Only the course slugs actually present in the current export — extend as
// new courses show up in future crawls.
const COURSE_MAP: Record<string, string> = {
  "ba-hons-economics": "B.A. (Hons.) Economics",
  "ba-hons-history": "B.A. (Hons.) History",
  "ba-multidisciplinary-history": "B.A. (Multidisciplinary) History",
  "ba-programme-business-economics": "B.A. (Programme) Business Economics",
  "ba-programme-economics": "B.A. (Programme) Economics",
  "ba-programme-history": "B.A. (Programme) History",
  "bsc-hons-zoology": "B.Sc. (Hons.) Zoology",
  "bsc-hons-zoology-and-life-science": "B.Sc. (Hons.) Zoology and Life Science",
};

const SMALL_WORDS = new Set(["of", "and", "the", "for", "in", "to", "a", "an"]);
const ROMAN_NUMERAL_RE = /^(i|ii|iii|iv|v|vi|vii|viii)$/i;

function titleCase(slug: string): string {
  const words = slug.split("-").filter(Boolean);
  const cased = words.map((word, i) => {
    if (ROMAN_NUMERAL_RE.test(word)) return word.toUpperCase();
    if (i > 0 && SMALL_WORDS.has(word)) return word;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });
  // Rejoin consecutive pure-digit words ("1200" "1500") that the hyphen
  // split apart, e.g. from a slug like "...-1200-1500" (a year/date range).
  const out: string[] = [];
  for (const w of cased) {
    if (/^\d+$/.test(w) && out.length && /^\d+$/.test(out[out.length - 1])) {
      out[out.length - 1] += `-${w}`;
    } else {
      out.push(w);
    }
  }
  return out.join(" ");
}

function subjectFromSlug(slug: string): string {
  const afterPrefix = slug.includes("__") ? slug.split("__").slice(1).join("__") : slug;
  return titleCase(afterPrefix);
}

// Paper name convention: "<year> sem-<n|roman-range> <type-token(s)> upc-<upc> [qp-<num>] [set-<nn>]"
// qp is sometimes absent (older/OC papers); semester is sometimes a hyphenated
// roman-numeral range ("sem-iii-v-vii") instead of a single digit.
const ROMAN_TO_NUM: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

type ParsedPaperName = { year: string; semester: string; semesterGroup: string; type: string; upc: string; qp: string | null; set: string | null };

function parsePaperName(raw: string): ParsedPaperName | null {
  const tokens = raw.trim().split(/\s+/);
  if (tokens.length < 3 || !/^\d{4}$/.test(tokens[0])) return null;
  const year = tokens[0];

  if (!tokens[1].toLowerCase().startsWith("sem-")) return null;
  const semPart = tokens[1].slice(4);

  const upcIdx = tokens.findIndex((t) => t.toLowerCase().startsWith("upc-"));
  if (upcIdx < 2) return null;
  const upc = tokens[upcIdx].slice(4);
  const type = tokens.slice(2, upcIdx).join(" ");
  if (!type) return null;

  const qpToken = tokens.find((t) => t.toLowerCase().startsWith("qp-"));
  const qp = qpToken ? qpToken.slice(3) : null;
  const setToken = tokens.find((t) => t.toLowerCase().startsWith("set-"));
  const set = setToken ? setToken.slice(4) : null;

  let semester: string;
  let semesterGroup: string;
  if (/^\d+$/.test(semPart)) {
    semester = semPart;
    semesterGroup = `Semester ${semPart}`;
  } else {
    // Hyphenated roman-numeral range, e.g. "iii-v-vii" -> use the lowest as
    // the canonical semester int, list all as the group label.
    const romanParts = semPart.split("-").filter(Boolean);
    const nums = romanParts.map((r) => ROMAN_TO_NUM[r.toLowerCase()]).filter((n): n is number => !!n);
    if (nums.length === 0) return null;
    semester = String(Math.min(...nums));
    semesterGroup = `Semester ${romanParts.map((r) => r.toUpperCase()).join(", ")}`;
  }

  return { year, semester, semesterGroup, type, upc, qp, set };
}

function csvField(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const raw = readFileSync(inputPath, "utf8");
const rows = parseCsv(raw);

const outHeader = ["course", "subject", "yearrange", "semestergroup", "semester", "fileurl", "filename", "note"];
const outLines = [outHeader.join(",")];

let skipped = 0;
for (const row of rows) {
  const courseSlug = row["course"];
  const course = COURSE_MAP[courseSlug];
  if (!course) {
    console.warn(`Skipping row — unknown course slug "${courseSlug}"`);
    skipped++;
    continue;
  }

  const subject = subjectFromSlug(row["subject"]);
  const yearRange = row["year"];
  const fileUrl = row["drive_link"];
  const fileName = row["file_name"];

  const parsed = parsePaperName(row["paper_name"]);
  let semester = "";
  let semesterGroup = "";
  let note = "";
  if (parsed) {
    semester = parsed.semester;
    semesterGroup = parsed.semesterGroup;
    note = [
      `UPC: ${parsed.upc}`,
      parsed.qp ? `QP: ${parsed.qp}` : null,
      `Type: ${parsed.type.toUpperCase()}`,
      parsed.set ? `Set: ${parsed.set}` : null,
    ].filter(Boolean).join(" | ");
  } else {
    console.warn(`Row for "${fileName}" — couldn't parse paper_name "${row["paper_name"]}", skipping`);
    skipped++;
    continue;
  }

  if (!course || !subject || !yearRange || !semesterGroup || !fileUrl) {
    skipped++;
    continue;
  }

  outLines.push(
    [course, subject, yearRange, semesterGroup, semester, fileUrl, fileName, note]
      .map(csvField)
      .join(",")
  );
}

writeFileSync(outputPath, outLines.join("\n") + "\n");
console.log(`Converted ${outLines.length - 1} rows (skipped ${skipped}) -> ${outputPath}`);
