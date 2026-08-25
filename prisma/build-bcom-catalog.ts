import { readFile, writeFile } from "fs/promises";
import path from "path";
import fs from "fs";
import MASTER_SYLLABUS_ROWS from "../public/data/master-syllabus-data.json";

const DRIVE_FILES_JSON = path.join(process.cwd(), "scratch", "bcom_all_drive_pdfs.json");
const SPLIT_INDEX_JSON = path.join(process.cwd(), "scratch", "split_index.json");
const OUTPUT_TS_FILE = path.join(process.cwd(), "src", "data", "bcom-drive-catalog.ts");

const ROMAN_TO_NUM: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
};

function getSemesterNumber(sem: string): string | null {
  if (!sem) return null;
  const cleaned = sem.toUpperCase().trim().replace(/^SEM-?/, "");
  return ROMAN_TO_NUM[cleaned] ? String(ROMAN_TO_NUM[cleaned]) : null;
}

// Map folder names/paths to program names
function getProgramFromPath(folderName: string, pathList: string[]): string {
  const pathStr = pathList.join("/").toLowerCase();
  if (pathStr.includes("b-com-programme") || pathStr.includes("bcom_programme") || pathStr.includes("b.com. programme")) {
    return "B.Com. Programme";
  }
  if (pathStr.includes("b-com-hons") || pathStr.includes("bcom_hons") || pathStr.includes("b.com. (hons.)")) {
    return "B.Com. (Hons.)";
  }
  if (pathStr.includes("common-programme-group") || pathStr.includes("common_programme_group")) {
    return "Common Programme Group";
  }
  if (pathStr.includes("b-a-programme") || pathStr.includes("ba_programme")) {
    return "B.A. Programme";
  }
  return "B.Com. (Hons.)"; // Default fallback
}

function cleanSubjectName(name: string): string {
  return name
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^[\d.]+\s*/, "") // e.g. "2.2 Company Law" -> "Company Law"
    .replace(/^DSC[- ]*/i, "")
    .replace(/^GE[- ]*/i, "")
    .trim();
}

async function main() {
  console.log("🚀 Building B.Com Drive Catalog...");

  if (!fs.existsSync(DRIVE_FILES_JSON)) {
    console.error(`Error: ${DRIVE_FILES_JSON} not found. Run traverse task first.`);
    return;
  }

  const driveFiles = JSON.parse(await readFile(DRIVE_FILES_JSON, "utf-8"));
  let splitIndex: any[] = [];
  if (fs.existsSync(SPLIT_INDEX_JSON)) {
    splitIndex = JSON.parse(await readFile(SPLIT_INDEX_JSON, "utf-8"));
  }

  console.log(`Loaded ${driveFiles.length} drive files and ${splitIndex.length} split index mappings.`);

  const catalogEntries: any[] = [];

  for (const file of driveFiles) {
    const filename = file.name;
    const fileId = file.id;

    // Check if this file is mapped in split_index.json
    // Map by matching filename or substring
    const splitMatch = splitIndex.find(item => 
      filename.includes(item.suggested_filename) || 
      item.suggested_filename?.includes(filename) ||
      (item.source_pdf === filename)
    );

    if (splitMatch) {
      const semNum = getSemesterNumber(splitMatch.semester);
      catalogEntries.push({
        id: `bcom-drive-${fileId}`,
        yearRange: splitMatch.collection_year ? `${splitMatch.collection_year}-${Number(splitMatch.collection_year)+1}` : "2024-2025",
        semesterGroup: `Semester ${semNum || splitMatch.semester}`,
        course: splitMatch.programme_family || "B.Com. (Hons.)",
        subject: splitMatch.canonical_subject,
        semester: semNum,
        upc: splitMatch.upc,
        pdfUrl: file.pdfUrl,
        note: `Google Drive Archive (${splitMatch.collection})`,
        source: "drive",
        fileName: filename
      });
      continue;
    }

    // Otherwise, parse using filename pattern:
    // Format: 01_2022_Sem-II_DSC-Core_Corporate_Accounting_UPC-22411201_QP-657.pdf
    const parts = filename.split("_");
    if (parts.length >= 5) {
      const year = parts[1];
      const semPart = parts[2]; // Sem-II
      const typePart = parts[3]; // DSC-Core

      // Extract UPC
      const upcMatch = filename.match(/UPC-([a-zA-Z0-9_-]+)/i);
      const upc = upcMatch ? upcMatch[1].replace(/_INCOMPLETE/i, "") : null;

      // Extract subject name
      // Everything between typePart and UPC-
      let subjectRaw = "";
      const typeIdx = filename.indexOf(typePart) + typePart.length + 1;
      const upcIdx = filename.indexOf("UPC-");
      if (upcIdx > typeIdx) {
        subjectRaw = filename.substring(typeIdx, upcIdx - 1);
      } else {
        // Fallback: take parts in between
        subjectRaw = parts.slice(4, parts.length - 1).join(" ");
      }

      const canonicalSubject = cleanSubjectName(subjectRaw);
      const program = getProgramFromPath(file.program || "", file.path);
      const semNum = getSemesterNumber(semPart);

      // Try to find a match in the master syllabus to get a clean UPC / subject name if possible
      const syllabusMatch = MASTER_SYLLABUS_ROWS.find(row => 
        (upc && row.upc === upc) || 
        row.subjectName.toLowerCase().replace(/[^a-z0-9]/g, "") === canonicalSubject.toLowerCase().replace(/[^a-z0-9]/g, "")
      );

      catalogEntries.push({
        id: `bcom-drive-${fileId}`,
        yearRange: year ? `${year}-${Number(year)+1}` : "2024-2025",
        semesterGroup: `Semester ${semNum || semPart}`,
        course: syllabusMatch?.course || program,
        subject: syllabusMatch?.subjectName || canonicalSubject,
        semester: semNum || syllabusMatch?.semester || null,
        upc: upc || syllabusMatch?.upc || null,
        pdfUrl: file.pdfUrl,
        note: `Google Drive Archive`,
        source: "drive",
        fileName: filename
      });
    } else {
      // Fallback parser for other files (e.g. index.json, README.txt are already filtered out)
      const program = getProgramFromPath(file.program || "", file.path);
      catalogEntries.push({
        id: `bcom-drive-${fileId}`,
        yearRange: "2024-2025",
        semesterGroup: "Unknown Semester",
        course: program,
        subject: cleanSubjectName(filename.replace(/\.pdf$/i, "")),
        semester: null,
        upc: null,
        pdfUrl: file.pdfUrl,
        note: `Google Drive Archive`,
        source: "drive",
        fileName: filename
      });
    }
  }

  const catalogContent = `import type { CatalogPaper } from "@/lib/pyq-catalog-types";

export const bcomDriveCatalog: CatalogPaper[] = ${JSON.stringify(catalogEntries, null, 2)};
`;

  await writeFile(OUTPUT_TS_FILE, catalogContent, "utf-8");
  console.log(`\n🎉 Success! Mapped and saved ${catalogEntries.length} B.Com papers to ${OUTPUT_TS_FILE}`);
}

main().catch(err => console.error("Error building catalog:", err));
