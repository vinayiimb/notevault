// @ts-nocheck
// @ts-nocheck
import { readFile, writeFile, mkdir } from "fs/promises";
import path from "path";
import fs from "fs";
// import JSZip from "jszip";
const JSZip = {} as any;
import { MASTER_SYLLABUS_ROWS } from "../src/lib/content/master-syllabus-data";

const DOWNLOADS_DIR = "/Users/sayam/Downloads";
const PUBLIC_QPS_DIR = path.join(process.cwd(), "public", "qps");

const ZIP_FILES = [
  "02_BA_H_Economics.zip",
  "05_BA_H_History.zip",
  "2026_05_BA_H_History.zip",
  "17_BSc_H_Zoology.zip",
  "2026_17_BSc_H_Zoology.zip"
];

function cleanSubjectName(filename: string): string {
  // Remove .pdf extension
  let name = filename.replace(/\.pdf$/i, "");
  // Remove any trailing numbers or alphanumeric codes (e.g. 5107, 1799A, 32175912) at the end
  name = name.replace(/\s+\d+[A-Z]?\s*$/, "");
  name = name.replace(/\s*\.\d+\s*$/, ""); // e.g. "Research Methodology .269"
  // Clean up double spaces, typos, punctuation
  name = name.replace(/\s+/g, " ").trim();
  return name;
}

function findSyllabusMatch(cleanedName: string) {
  const normalizedQuery = cleanedName.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!normalizedQuery) return null;

  // Manual overrides for filenames with typos or special structures
  const manualOverrides: Record<string, string> = {
    "microbiodata": "2234002005", // Microbiota: Importance in Health and Disease
    "lifestylesdisorders": "2234001201", // Lifestyle Disorders
    "developmentbiology": "2232012402", // Developmental Biology
    "historyofindia300750": "2312101201" // History of India – II c. 4th Century BCE to 750 CE
  };

  if (manualOverrides[normalizedQuery]) {
    const upc = manualOverrides[normalizedQuery];
    const match = MASTER_SYLLABUS_ROWS.find(row => row.upc === upc);
    if (match) return match;
  }
  
  // 1. Try exact match first
  const match = MASTER_SYLLABUS_ROWS.find(row => {
    const normSubject = row.subjectName.toLowerCase().replace(/[^a-z0-9]/g, "");
    return normSubject === normalizedQuery;
  });
  if (match) return match;

  // 2. Try token overlap match
  const queryTokens = cleanedName.toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(t => t.length >= 3 && t !== "and" && t !== "the" && t !== "for" && t !== "with" && t !== "from");

  if (queryTokens.length > 0) {
    let bestMatch: any = null;
    let maxOverlap = 0;

    for (const row of MASTER_SYLLABUS_ROWS) {
      // Only match relevant courses to keep accuracy high
      const isRelevant = row.course.includes("Economics") || 
                         row.course.includes("History") || 
                         row.course.includes("Zoology") || 
                         row.course.includes("Sociology") ||
                         row.course.includes("English") ||
                         row.course.includes("Hindi");
      if (!isRelevant) continue;

      const subjectTokens = row.subjectName.toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(t => t.length >= 3);

      const overlap = queryTokens.filter(t => subjectTokens.includes(t)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = row;
      }
    }

    // Require at least 2 tokens overlap (or 1 if query is very short)
    const minRequiredOverlap = Math.min(queryTokens.length, 2);
    if (maxOverlap >= minRequiredOverlap) {
      return bestMatch;
    }
  }

  return null;
}

async function main() {
  console.log("🚀 Starting extraction and mapping of ZIP pyqs...");
  await mkdir(PUBLIC_QPS_DIR, { recursive: true });

  const catalogEntries: any[] = [];
  let totalExtracted = 0;
  let totalMatched = 0;

  for (const zipFile of ZIP_FILES) {
    const zipPath = path.join(DOWNLOADS_DIR, zipFile);
    if (!fs.existsSync(zipPath)) {
      console.warn(`⚠️ Zip file not found: ${zipFile}, skipping.`);
      continue;
    }

    console.log(`\n📦 Processing ${zipFile}...`);
    const zipBuffer = await readFile(zipPath);
    const zip = await JSZip.loadAsync(zipBuffer);

    for (const [relativePath, file] of Object.entries(zip.files)) {
      if (file.dir || relativePath.endsWith("desktop.ini") || relativePath.startsWith("__MACOSX")) {
        continue;
      }

      const basename = path.basename(relativePath);
      if (!basename.endsWith(".pdf")) continue;

      const cleanedName = cleanSubjectName(basename);
      const match = findSyllabusMatch(cleanedName);

      // Create a unique output name
      const safeBasename = basename.replace(/[^a-zA-Z0-9.\-_]/g, "_");
      const destPath = path.join(PUBLIC_QPS_DIR, safeBasename);

      // Extract file bytes
      const fileData = await file.async("nodebuffer");
      await writeFile(destPath, fileData);
      totalExtracted++;

      if (match) {
        totalMatched++;
        console.log(`  ✅ Matched: "${basename}" -> "${match.subjectName}" (UPC: ${match.upc}, Course: ${match.course})`);
        catalogEntries.push({
          id: `zip-${zipFile.replace(".zip", "")}-${safeBasename}`,
          yearRange: zipFile.includes("2026") ? "2025-2026" : "2024-2025",
          semesterGroup: `Semester ${match.semester}`,
          course: match.course,
          subject: match.subjectName,
          semester: match.semester,
          upc: match.upc,
          pdfUrl: `/qps/${safeBasename}`,
          note: `Extracted from ${zipFile}`,
          source: "drive",
          fileName: basename
        });
      } else {
        console.log(`  ❌ Unmatched: "${basename}" (Cleaned: "${cleanedName}")`);
        // Add as unmatched entry
        catalogEntries.push({
          id: `zip-${zipFile.replace(".zip", "")}-${safeBasename}`,
          yearRange: zipFile.includes("2026") ? "2025-2026" : "2024-2025",
          semesterGroup: "Unknown Semester",
          course: zipFile.includes("Zoology") ? "B.Sc. (Hons.) Zoology" : (zipFile.includes("Economics") ? "B.A. (Hons.) Economics" : "B.A. (Hons.) History"),
          subject: cleanedName,
          semester: null,
          upc: null,
          pdfUrl: `/qps/${safeBasename}`,
          note: `Extracted from ${zipFile}`,
          source: "drive",
          fileName: basename
        });
      }
    }
  }

  // Write catalog file
  const catalogContent = `import type { CatalogPaper } from "@/lib/pyq-catalog-types";

export const extractedZipCatalog: CatalogPaper[] = ${JSON.stringify(catalogEntries, null, 2)};
`;

  const outputPath = path.join(process.cwd(), "src", "data", "extracted-pyq-catalog.ts");
  await writeFile(outputPath, catalogContent);
  console.log(`\n🎉 Done! Extracted ${totalExtracted} files, matched ${totalMatched} to master syllabus.`);
  console.log(`Saved catalog to ${outputPath}`);
}

main().catch(err => console.error("Fatal error:", err));
