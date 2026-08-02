/**
 * Recursively imports paper files from mixed-content Drive folders.
 *
 * Folder traversal happens server-side during import. NoteVault stores one
 * row per final PDF, so the public archive can present course -> subject ->
 * year/session navigation without ever sending users to a Drive folder.
 *
 * Dry-run is the default. Pass --include-all to include notes/readings as
 * "Study Material", and --apply to write.
 */
import { createHash } from "node:crypto";
import path from "node:path";
import { config } from "dotenv";

config({ path: path.join(process.cwd(), ".env.local") });
config({ path: path.join(process.cwd(), ".env") });

import { PrismaClient } from "../src/generated/prisma";
import {
  listDriveFolderTreePdfs,
  type DriveTreeFile,
} from "../src/lib/google-drive";

type NestedSource = {
  folderId: string;
  label: string;
  mode: "history" | "bcom" | "mixed";
};

const SOURCES: NestedSource[] = [
  {
    folderId: "1AYgpSfZovaLJhpWxz88nnzAOj7jG7FgC",
    label: "Political Science collection",
    mode: "mixed",
  },
  {
    folderId: "1grlBhjWA1AT7twogG3buq2B9ZK6CvNx9",
    label: "History Hons",
    mode: "history",
  },
  {
    folderId: "15LrMvzQEx1xzt921eNc6KbtTVax1TkdJ",
    label: "B.Com (H)",
    mode: "bcom",
  },
  {
    folderId: "1CNUTY6a0IHDizzO8i1w5GbjX2roRPcG9",
    label: "Miscellaneous collection",
    mode: "mixed",
  },
  {
    folderId: "1a9La5ehnm_RSV7fDpMDaMeyHb1PGjocO",
    label: "PYQ + Answers (Previous 10 Years)",
    mode: "mixed",
  },
  {
    folderId: "1GJ67aNwwfq3Mf_xBXm3POXkxduW5CDPi",
    label: "DU Master Exam & Study Vault (8,300+ Papers)",
    mode: "mixed",
  },
];

const prisma = new PrismaClient();

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isPaper(source: NestedSource, file: DriveTreeFile) {
  const pathText = file.folderPath.join(" / ");
  if (source.mode === "history") {
    return /previous year papers/i.test(pathText);
  }
  if (source.mode === "mixed") {
    return /\bpyqs?\b/i.test(pathText) || /\bpyqs?\b/i.test(file.name);
  }
  return /\bpyq|pyqp|question\s*paper|previous\s*year|past\s*10\s*year|10\s*years?|\bqp\b|gec\s+papers|papers?\s+scanned/i.test(
    file.name,
  );
}

function semesterFromText(value: string) {
  const normalized = normalize(value);
  const numeric = normalized.match(/\bsemester\s*([1-8])\b/);
  if (numeric) return Number(numeric[1]);
  const words: Array<[RegExp, number]> = [
    [/\bfirst semester\b/, 1],
    [/\bsecond semester\b/, 2],
    [/\bthird semester\b/, 3],
    [/\bfourth semester\b/, 4],
    [/\bfifth semester\b/, 5],
    [/\bsixth semester\b/, 6],
    [/\bseventh semester\b/, 7],
    [/\beighth semester\b/, 8],
  ];
  return words.find(([pattern]) => pattern.test(normalized))?.[1] ?? null;
}

function yearFromName(fileName: string) {
  return fileName.match(/\b(20(?:1[0-9]|2[0-6]))\b/)?.[1] ?? null;
}

function cleanFolderSubject(value: string) {
  return value
    .replace(/\((?:core|dse|disc\.?\s*spec(?:ific)?)\)/gi, " ")
    .replace(/\b(?:core|dse|disc\.?\s*spec(?:ific)?)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function courseFromMixed(file: DriveTreeFile) {
  const value = normalize(`${file.folderPath.join(" ")} ${file.name}`);
  if (/\bvac\b/.test(value)) return "VAC";
  if (/\b(?:aec|aecc)\b/.test(value)) return "AEC";
  if (/\bsec\b/.test(value)) return "SEC";
  if (/\bge\b/.test(value)) return "Generic Elective";
  if (/\bbcom\b|\bb com\b/.test(value)) {
    if (/\b(?:prog|programme)\b/.test(value)) return "B. Com. (P)";
    return "B. Com. (H)";
  }
  if (/\bpolitic/.test(value)) return "Political Science";
  if (/\bhistory\b/.test(value)) return "History";
  if (/\beconomics?\b|\beco hons\b/.test(value)) return "Economics";
  if (/\benglish\b/.test(value)) return "English";
  if (/\bhindi\b/.test(value)) return "Hindi";
  if (/\bphysics\b/.test(value)) return "Physics";
  if (/\bchemistry\b/.test(value)) return "Chemistry";
  if (/\b(?:maths|mathematics)\b/.test(value)) return "Mathematics";
  if (/\bbsc\b|\bb sc\b/.test(value)) return "B.Sc. Question Papers";
  if (/\bba\b|\bb a\b/.test(value)) return "B.A. (P)";
  return "Another Question Papers";
}

function subjectFromMixed(file: DriveTreeFile) {
  return file.name
    .replace(/\.pdf$/i, "")
    .replace(/\b(?:vac|aec|aecc|sec|ge)\b/gi, " ")
    .replace(/\b(?:bcom|b\.?\s*com\.?)\s*(?:hons?|prog(?:ramme)?)?/gi, " ")
    .replace(/\b(?:bsc|b\.?\s*sc\.?)\s*(?:hons?|prog(?:ramme)?)?/gi, " ")
    .replace(/\b(?:ba|b\.?\s*a\.?)\s*(?:hons?|prog(?:ramme)?)?/gi, " ")
    .replace(/\b(?:core|question\s*papers?|pyqs?|answers?)\b/gi, " ")
    .replace(/[_;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function classify(source: NestedSource, file: DriveTreeFile, paper: boolean) {
  const pathText = file.folderPath.join(" / ");
  const semester = semesterFromText(`${pathText} ${file.name}`);
  const year = yearFromName(file.name);

  if (source.mode === "history") {
    if (!paper) {
      const meaningfulPath =
        [...file.folderPath]
          .reverse()
          .find(
            (part) =>
              !/^(?:notes?|1st year|2nd year|3rd year)$/i.test(part.trim()),
          ) ?? "History Hons";
      const subject = /books?\s*&\s*readings/i.test(pathText)
        ? "Books & Readings"
        : /history sec/i.test(pathText)
          ? "History SEC — Archives and Museums"
          : cleanFolderSubject(meaningfulPath);
      return {
        course: "History",
        subject,
        semester,
        yearRange: "Study Material",
      };
    }
    const previousIndex = file.folderPath.findIndex((part) =>
      /previous year papers/i.test(part),
    );
    const parent =
      previousIndex > 0 ? file.folderPath[previousIndex - 1] : "History Hons";
    const subject =
      /^(?:1st|2nd|3rd) year$/i.test(parent) || /semester/i.test(parent)
        ? `History Hons${semester ? ` — Semester ${semester}` : ""}`
        : cleanFolderSubject(parent);
    return {
      course: "History",
      subject,
      semester,
      yearRange: year ?? "Previous Year Papers",
    };
  }

  if (source.mode === "bcom") {
    const subjectFolder =
      [...file.folderPath]
        .reverse()
        .find((part) => !/^semester\s*\d+$/i.test(part.trim())) ??
      "B.Com (H) Question Papers";
    return {
      course: "B. Com. (H)",
      subject: cleanFolderSubject(subjectFolder),
      semester,
      yearRange: paper ? year ?? "Previous 10 Years" : "Study Material",
    };
  }

  return {
    course: courseFromMixed(file),
    subject: subjectFromMixed(file),
    semester,
    yearRange: paper ? year ?? "Previous 10 Years" : "Study Material",
  };
}

function driveHash(fileId: string) {
  return createHash("sha256").update(`google-drive:${fileId}`).digest("hex");
}

async function main() {
  const apply = process.argv.includes("--apply");
  const includeAll = process.argv.includes("--include-all");
  const unavailable: Array<{ label: string; folderId: string }> = [];
  const discovered: Array<{
    driveFileId: string;
    course: string;
    subject: string;
    yearRange: string;
    semesterGroup: string;
    semester: number | null;
    fileUrl: string;
    fileName: string;
    fileSize: number;
    fileHash: string;
    note: string;
    isPaper: boolean;
  }> = [];

  for (const source of SOURCES) {
    const files = await listDriveFolderTreePdfs(source.folderId);
    if (!files.length) {
      unavailable.push({ label: source.label, folderId: source.folderId });
      continue;
    }
    for (const file of files) {
      const paper = isPaper(source, file);
      if (!includeAll && !paper) continue;
      const metadata = classify(source, file, paper);
      discovered.push({
        driveFileId: file.id,
        ...metadata,
        semesterGroup: metadata.semester
          ? String(metadata.semester)
          : paper
            ? "Previous-year collection"
            : "Study Material",
        fileUrl: file.webViewLink,
        fileName: file.name,
        fileSize: 0,
        fileHash: driveHash(file.id),
        note: `Google Drive · ${paper ? "PYQ" : "Study Material"} · ${source.label} · ${file.folderPath.join(" / ") || "Root"}`,
        isPaper: paper,
      });
    }
  }

  const [existingUploads, existingSessionFiles] = await Promise.all([
    prisma.catalogPaperUpload.findMany({
      where: { fileHash: { in: discovered.map((paper) => paper.fileHash) } },
      select: { fileHash: true },
    }),
    prisma.driveFileMatch.findMany({
      where: { driveFileId: { in: discovered.map((paper) => paper.driveFileId) } },
      select: { driveFileId: true },
    }),
  ]);
  const existingHashes = new Set(existingUploads.map((paper) => paper.fileHash));
  const existingDriveIds = new Set(
    existingSessionFiles.map((paper) => paper.driveFileId),
  );
  const newPapers = discovered.filter(
    (paper) =>
      !existingHashes.has(paper.fileHash) &&
      !existingDriveIds.has(paper.driveFileId),
  );

  if (apply && newPapers.length) {
    await prisma.catalogPaperUpload.createMany({
      data: newPapers.map(
        ({ driveFileId: _driveFileId, isPaper: _isPaper, ...paper }) => paper,
      ),
      skipDuplicates: true,
    });
  }

  const bySource = Object.fromEntries(
    SOURCES.map((source) => [
      source.label,
      discovered.filter((paper) => paper.note.includes(`· ${source.label} ·`))
        .length,
    ]),
  );
  const byCourse = Object.fromEntries(
    [...newPapers.reduce((counts, paper) => {
      counts.set(paper.course, (counts.get(paper.course) ?? 0) + 1);
      return counts;
    }, new Map<string, number>())].sort((a, b) => b[1] - a[1]),
  );

  console.log(
    JSON.stringify(
      {
        mode: apply ? "apply" : "dry-run",
        discovered: discovered.length,
        exactExisting:
          discovered.length - newPapers.length,
        added: apply ? newPapers.length : 0,
        wouldAdd: newPapers.length,
        unavailable,
        bySource,
        byCourse,
        byKind: {
          pyq: newPapers.filter((paper) => paper.isPaper).length,
          studyMaterial: newPapers.filter((paper) => !paper.isPaper).length,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
