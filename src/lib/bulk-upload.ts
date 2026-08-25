// Row-classification logic for the admin Bulk Upload "Fresh Upload" flow —
// one spreadsheet row = one CatalogPaperUpload (Full Archive catalog entry),
// reviewed by the admin before anything is created. Course/subject here are
// free text, same as CatalogPaperUpload itself — not matched against the
// curated Program/Term/Subject taxonomy (see src/lib/course-match.ts for
// that other, unrelated matching flow used elsewhere in admin).
import { createHash } from "node:crypto";
import type { BulkUploadRowStatus } from "@prisma/client";

export type ClassifiedRow = {
  rowNumber: number;
  status: BulkUploadRowStatus;
  message: string | null;

  courseRaw: string;
  subjectRaw: string;
  yearRangeRaw: string | null;
  semesterGroupRaw: string | null;
  semesterRaw: string | null;
  fileUrlRaw: string | null;
  fileNameRaw: string | null;
  noteRaw: string | null;

  // Only meaningful when status === "VALID" — what commit will write onto
  // the eventual CatalogPaperUpload.
  resolved: {
    semester: number | null;
    fileName: string;
    fileHash: string;
  } | null;
};

function pick(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

// Drive file (not folder) links carry the same file id whether the admin
// pastes a "view" link, an "edit" link, or a bare id — extracting it lets a
// bulk-row import dedupe against a file already imported by the older
// Drive-folder-crawl flow, which hashed on this same id.
function extractDriveFileId(url: string): string | null {
  const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/);
  if (fileMatch) return fileMatch[1];
  const idParam = url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (idParam) return idParam[1];
  return null;
}

export function bulkRowFileHash(fileUrl: string): string {
  const driveFileId = extractDriveFileId(fileUrl);
  const key = driveFileId ? `google-drive:${driveFileId}` : `bulk-url:${fileUrl.trim().toLowerCase()}`;
  return createHash("sha256").update(key).digest("hex");
}

function fileNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    return last ? decodeURIComponent(last) : url;
  } catch {
    return url;
  }
}

function parseSemester(raw: string | null): number | null {
  if (!raw) return null;
  const n = Number(raw.match(/\d+/)?.[0]);
  return Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

// Turns a row's raw fileUrl/fileName/semester strings into the fields a
// CatalogPaperUpload needs. Used both while classifying (to fill
// ClassifiedRow.resolved) and again at commit time (re-derived from the
// persisted raw columns, since they aren't duplicated onto BulkUploadRow).
export function resolveRowForImport(fields: {
  fileUrlRaw: string;
  fileNameRaw: string | null;
  semesterRaw: string | null;
}): { semester: number | null; fileName: string; fileHash: string } {
  const fileName = fields.fileNameRaw || fileNameFromUrl(fields.fileUrlRaw);
  const fileHash = bulkRowFileHash(fields.fileUrlRaw);
  return { semester: parseSemester(fields.semesterRaw), fileName, fileHash };
}

// Pure classification — no DB access at all. Dedupe is checked against
// existingHashes (fileHash -> fileName), which the caller batch-fetches
// once for the whole sheet up front (see validateBulkUploadAction) instead
// of this function querying per row — with a few hundred rows, one round
// trip per row instead of one total is the difference between validating
// in a couple seconds and timing out the whole request.
// Pulled out so validateBulkUploadAction can compute every row's candidate
// fileHash up front, for one batched dedupe query instead of one per row.
export function extractFileUrlRaw(row: Record<string, string>): string | null {
  return pick(row, "fileurl", "file url", "pdfurl", "pdf url", "link", "url") || null;
}

export function classifyBulkUploadRow(
  rowNumber: number,
  row: Record<string, string>,
  existingHashes: ReadonlyMap<string, string>
): ClassifiedRow {
  const courseRaw = pick(row, "course");
  const subjectRaw = pick(row, "subject");
  const yearRangeRaw = pick(row, "yearrange", "year range", "year") || null;
  const semesterGroupRaw = pick(row, "semestergroup", "semester group") || null;
  const semesterRaw = pick(row, "semester", "term", "sem") || null;
  const fileUrlRaw = extractFileUrlRaw(row);
  const fileNameRaw = pick(row, "filename", "file name") || null;
  const noteRaw = pick(row, "note", "notes") || null;

  const base: Omit<ClassifiedRow, "status" | "message" | "resolved"> = {
    rowNumber,
    courseRaw,
    subjectRaw,
    yearRangeRaw,
    semesterGroupRaw,
    semesterRaw,
    fileUrlRaw,
    fileNameRaw,
    noteRaw,
  };

  if (!courseRaw) return { ...base, status: "INVALID", message: "No course given", resolved: null };
  if (!subjectRaw) return { ...base, status: "INVALID", message: "No subject given", resolved: null };
  if (!yearRangeRaw) return { ...base, status: "INVALID", message: "No year/session range given", resolved: null };
  if (!semesterGroupRaw) return { ...base, status: "INVALID", message: "No semester group given", resolved: null };
  if (!fileUrlRaw) return { ...base, status: "INVALID", message: "No file URL given", resolved: null };

  const resolved = resolveRowForImport({ fileUrlRaw, fileNameRaw, semesterRaw });

  const existingFileName = existingHashes.get(resolved.fileHash);
  if (existingFileName !== undefined) {
    return { ...base, status: "DUPLICATE", message: `Already in the catalog as "${existingFileName}"`, resolved: null };
  }

  return { ...base, status: "VALID", message: null, resolved };
}
