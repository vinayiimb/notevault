// Row-classification logic for the admin Bulk Upload "Fresh Upload" flow —
// one spreadsheet row = one Resource, with its own file URL/name, reviewed
// by the admin before anything is created. Shared by the validate action
// (classifies + persists BulkUploadRow, nothing imported yet) and the
// commit action (re-derives the same Resource fields for approved rows).
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { findProgramMatch, findTermMatch } from "@/lib/course-match";
import { guessSubject, guessYear, type MatchableSubject } from "@/lib/subject-match";
import type { BulkUploadRowStatus } from "@/generated/prisma";

export type ProgramWithTerms = {
  id: string;
  name: string;
  terms: {
    id: string;
    name: string;
    subjects: MatchableSubject[];
  }[];
};

export type ClassifiedRow = {
  rowNumber: number;
  status: BulkUploadRowStatus;
  message: string | null;

  courseRaw: string;
  semesterRaw: string;
  subjectRaw: string;
  resourceTypeRaw: string | null;
  yearRaw: string | null;
  fileUrlRaw: string | null;
  fileNameRaw: string | null;

  programId: string | null;
  termId: string | null;
  subjectId: string | null;

  // Only meaningful when status === "VALID" — what commit will write onto
  // the eventual Resource.
  resolved: {
    type: "NOTES" | "PYQ";
    title: string;
    year: number | null;
    fileUrl: string;
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

function mapResourceType(raw: string): "NOTES" | "PYQ" | null {
  if (!raw) return "PYQ";
  const v = raw.trim().toLowerCase();
  if (v === "notes" || v === "note") return "NOTES";
  if (v === "pyq" || v === "paper" || v === "question paper" || v === "previous year paper") return "PYQ";
  return null;
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

// Turns a row's raw fileUrl/fileName/year/type strings into the fields a
// Resource needs. Used both while classifying (to fill ClassifiedRow.resolved)
// and again at commit time (re-derived from the persisted raw columns, since
// they aren't duplicated onto BulkUploadRow itself). Returns null only when
// the resource type is unrecognized — every other input has a fallback.
export function resolveRowForImport(fields: {
  fileUrlRaw: string;
  fileNameRaw: string | null;
  yearRaw: string | null;
  resourceTypeRaw: string | null;
}): { type: "NOTES" | "PYQ"; title: string; year: number | null; fileUrl: string; fileName: string; fileHash: string } | null {
  const type = mapResourceType(fields.resourceTypeRaw ?? "");
  if (!type) return null;

  const fileName = fields.fileNameRaw || fileNameFromUrl(fields.fileUrlRaw);
  const title = fileName.replace(/\.pdf$/i, "");
  const yearHint = fields.yearRaw && /^\d{4}$/.test(fields.yearRaw) ? Number(fields.yearRaw) : null;
  const year = guessYear(fileName) ?? yearHint;
  const fileHash = bulkRowFileHash(fields.fileUrlRaw);

  return { type, title, year, fileUrl: fields.fileUrlRaw, fileName, fileHash };
}

// Pure classification — no DB writes. Does one dedupe lookup (fileHash is
// indexed) when a row otherwise looks valid.
export async function classifyBulkUploadRow(
  rowNumber: number,
  row: Record<string, string>,
  programs: ProgramWithTerms[],
  subjectMemory: Record<string, string>
): Promise<ClassifiedRow> {
  const courseRaw = pick(row, "course", "program");
  const semesterRaw = pick(row, "semester", "term", "sem");
  const subjectRaw = pick(row, "subject");
  const resourceTypeRaw = pick(row, "type", "resourcetype", "resource type") || null;
  const yearRaw = pick(row, "year", "examsession", "session") || null;
  const fileUrlRaw = pick(row, "fileurl", "file url", "link", "url") || null;
  const fileNameRaw = pick(row, "filename", "file name") || null;

  const base: Omit<ClassifiedRow, "status" | "message" | "programId" | "termId" | "subjectId" | "resolved"> = {
    rowNumber,
    courseRaw,
    semesterRaw,
    subjectRaw,
    resourceTypeRaw,
    yearRaw,
    fileUrlRaw,
    fileNameRaw,
  };

  if (!courseRaw) {
    return { ...base, status: "UNMATCHED_COURSE", message: "No course/program given", programId: null, termId: null, subjectId: null, resolved: null };
  }
  const program = findProgramMatch(programs, courseRaw);
  if (!program) {
    return { ...base, status: "UNMATCHED_COURSE", message: `No course matched "${courseRaw}"`, programId: null, termId: null, subjectId: null, resolved: null };
  }

  if (!semesterRaw) {
    return { ...base, status: "UNMATCHED_COURSE", message: "No semester given", programId: program.id, termId: null, subjectId: null, resolved: null };
  }
  const term = findTermMatch(program.terms, semesterRaw);
  if (!term) {
    return { ...base, status: "UNMATCHED_COURSE", message: `No semester matched "${semesterRaw}" in ${program.name}`, programId: program.id, termId: null, subjectId: null, resolved: null };
  }

  if (!subjectRaw) {
    return { ...base, status: "INVALID", message: "No subject name given", programId: program.id, termId: term.id, subjectId: null, resolved: null };
  }
  const subjectId = guessSubject(subjectRaw, term.subjects, subjectMemory);
  if (!subjectId) {
    return { ...base, status: "UNMATCHED_SUBJECT", message: `No subject matched "${subjectRaw}" in ${program.name} · ${term.name}`, programId: program.id, termId: term.id, subjectId: null, resolved: null };
  }

  if (!fileUrlRaw) {
    return { ...base, status: "INVALID", message: "No file URL given", programId: program.id, termId: term.id, subjectId, resolved: null };
  }

  const resolved = resolveRowForImport({ fileUrlRaw, fileNameRaw, yearRaw, resourceTypeRaw });
  if (!resolved) {
    return { ...base, status: "INVALID", message: `Unrecognized resource type "${resourceTypeRaw}" — use Notes or PYQ`, programId: program.id, termId: term.id, subjectId, resolved: null };
  }

  const existing = await prisma.resource.findFirst({ where: { fileHash: resolved.fileHash }, select: { id: true, title: true } });
  if (existing) {
    return { ...base, status: "DUPLICATE", message: `Already imported as "${existing.title}"`, programId: program.id, termId: term.id, subjectId, resolved: null };
  }

  return {
    ...base,
    status: "VALID",
    message: null,
    programId: program.id,
    termId: term.id,
    subjectId,
    resolved,
  };
}

export async function loadProgramsForMatching(): Promise<ProgramWithTerms[]> {
  return prisma.program.findMany({
    include: { terms: { include: { subjects: { select: { id: true, name: true } } } } },
  });
}

export async function loadSubjectMatchMemory(): Promise<Record<string, string>> {
  const rows = await prisma.subjectMatchMemory.findMany();
  return Object.fromEntries(rows.map((r) => [r.key, r.subjectId]));
}
