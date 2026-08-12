import fs from "fs";
import path from "path";
import { geographyDriveCatalog } from "../src/data/geography-drive-catalog";
import { politicalScienceDriveCatalog } from "../src/data/political-science-drive-catalog";
import { duMasterDriveCatalog } from "../src/data/du-master-drive-catalog";
import { bcomDriveCatalog } from "../src/data/bcom-drive-catalog";
import { extractedZipCatalog } from "../src/data/extracted-pyq-catalog";

const duQbPath = path.resolve("src/data/du-question-bank-full-mapped.json");
const ramanujanPath = path.resolve("src/data/ramanujan-pyq-catalog.json");
const outputPath = path.resolve("public/data/papers-catalog.json");

const duQb = JSON.parse(fs.readFileSync(duQbPath, "utf-8"));
const ramanujan = JSON.parse(fs.readFileSync(ramanujanPath, "utf-8"));

const papers: any[] = [];
let idx = 0;

// 1. DU Question Bank + Shivaji + Kalindi + ANDC (23,183 rows)
for (const row of duQb) {
  const link = row.questionPaperLink || row.officialPaperLink;
  if (!link) continue;

  const isShiv = Boolean(row.isShivaji);
  const isKal = Boolean(row.isKalindi);
  const isAnd = Boolean(row.isANDC);

  const collegeRaw = row.college || (isShiv ? "Shivaji" : isKal ? "Kalindi" : isAnd ? "ANDC" : null);
  const collegeLabel = collegeRaw ? `[${collegeRaw[0]}] ${collegeRaw}` : null;

  const noteParts = [
    collegeLabel,
    row.upc ? `UPC ${row.upc}` : null,
    row.paperType,
    row.courseNumber,
    row.questionPaperSession,
    row.questionPaperSet,
    row.questionPaperMarks ? `${row.questionPaperMarks} marks` : null,
  ];
  const note = noteParts.filter(Boolean).join(" | ");

  const sess = row.questionPaperSession || "";
  const yr = row.questionPaperYear || "";
  const yearRange = `${sess} ${yr}`.trim() || yr || "Unknown";

  papers.push({
    id: `du-qb-${idx++}`,
    yearRange,
    semesterGroup: row.semester ? `Semester ${row.semester}` : "Semester Unknown",
    course: (row.officialProgramme || "General / Interdisciplinary").trim(),
    subject: row.subjectPaperName || "",
    semester: row.semester ? String(row.semester) : null,
    pdfUrl: link,
    note: note || null,
    source: "upload",
    isShivaji: isShiv,
    isKalindi: isKal,
    isANDC: isAnd,
    isRamanujan: false,
    college: collegeRaw,
  });
}

// 2. Ramanujan College Catalog (2,701 rows)
for (const row of ramanujan) {
  const link = row.pdfUrl;
  if (!link) continue;

  papers.push({
    id: row.id || `ram-${idx++}`,
    yearRange: row.yearRange || "Unknown",
    semesterGroup: row.semesterGroup || "Semester Unknown",
    course: (row.course || "General / Interdisciplinary").trim(),
    subject: row.subject || "",
    semester: row.semester ? String(row.semester) : null,
    pdfUrl: link,
    note: row.note ? `[R] Ramanujan | ${row.note}` : "[R] Ramanujan",
    source: "library",
    isShivaji: false,
    isKalindi: false,
    isANDC: false,
    isRamanujan: true,
    college: "Ramanujan",
  });
}

// 3. Drive Catalogs (Geography, PolSci, DU Master, BCom, Extracted)
const driveCatalogs = [
  ...geographyDriveCatalog,
  ...politicalScienceDriveCatalog,
  ...duMasterDriveCatalog,
  ...bcomDriveCatalog,
  ...extractedZipCatalog,
];

for (const p of driveCatalogs) {
  if (!p.pdfUrl) continue;
  papers.push({
    id: p.id || `drive-${idx++}`,
    yearRange: p.yearRange || "Unknown",
    semesterGroup: p.semesterGroup || "Semester Unknown",
    course: (p.course || "General / Interdisciplinary").trim(),
    subject: p.subject || "",
    semester: p.semester ? String(p.semester) : null,
    pdfUrl: p.pdfUrl,
    note: p.note || null,
    source: p.source || "drive",
    isShivaji: false,
    isKalindi: false,
    isANDC: false,
    isRamanujan: false,
    college: null,
  });
}

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify(papers), "utf-8");

console.log(`Successfully generated ${outputPath}`);
console.log(`TOTAL PAPERS IN UNIFIED CATALOG: ${papers.length}`);
console.log(`File size: ${(fs.statSync(outputPath).size / (1024 * 1024)).toFixed(2)} MB`);
