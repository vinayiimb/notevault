"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { MERGE_TARGET_SEP } from "@/lib/archive-customize-constants";
import {
  saveUploadedFile,
  hashFile,
  putBytes,
  deleteByUrl,
  createDirectUploadTarget,
  storedObjectSize,
} from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { heroImageExtensionsFor } from "@/lib/hero-image";
import { currencyIconExtensionFor } from "@/lib/currency-icon";
import { normalizeMemoryKey } from "@/lib/subject-match";
import { extractUpcCandidate, matchOfficialSubject } from "@/lib/subject-normalization";
import { findProgramMatch, findTermMatch, normalizeLoose } from "@/lib/course-match";
import {
  getCatalogYearRanges,
  getSemesterGroupsForYear,
  isCatalogCourseSubject,
} from "@/lib/pyq-catalog";
import {
  createSessionCookie,
  destroySessionCookie,
  getSession,
  verifyPassword,
} from "@/lib/auth";
import type { Prisma, BulkUploadRowStatus } from "@/generated/prisma";
import { DEFAULT_THEME, ThemeValuesSchema } from "@/lib/note-theme";
import { StructuredNoteSchema } from "@/lib/note-schema";
import { generateStructuredNote } from "@/lib/ai";
import { detectSourceKind, extractSourceTextFromUpload, saveSourceFile } from "@/lib/note-ingestion";
import {
  StudyContentBlockListSchema,
  StudyContentBlockSchema,
  createDefaultBlock,
  type StudyContentBlockType,
} from "@/lib/content/content-block-schema";

async function requireAdmin() {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthorized");
  }
  return session;
}

async function uniqueSlug(base: string, exists: (slug: string) => Promise<boolean>) {
  const root = slugify(base) || "item";
  let candidate = root;
  let i = 1;
  while (await exists(candidate)) {
    i += 1;
    candidate = `${root}-${i}`;
  }
  return candidate;
}

// ---------- OCR metadata import ----------

const corePyqCourses = {
  Biochemistry: "B.Sc. (Hons.) Biochemistry",
  Botany: "B.Sc. (Hons.) Botany",
  Chemistry: "B.Sc. (Hons.) Chemistry",
  Mathematics: "B.Sc. (Hons.) Mathematics",
  Physics: "B.Sc. (Hons.) Physics",
  Zoology: "B.Sc. (Hons.) Zoology",
} as const;

const corePyqSemesters = {
  Semester_I: 1,
  Semester_II: 2,
  Semester_III: 3,
  Semester_IV: 4,
  Semester_V: 5,
  Semester_VI: 6,
} as const;

type CorePyqCourse = keyof typeof corePyqCourses;
type CorePyqSemester = keyof typeof corePyqSemesters;

type CorePyqMetadataRecord = {
  sourceJsonName: string;
  course: CorePyqCourse;
  semester: CorePyqSemester;
  academicYear: string;
  year: number;
  originalFilename?: string;
  extractionMethod?: string;
  ocrText: string;
  pageCount: number;
  ocrTextHash?: string;
};

function corePyqHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function isCorePyqCourse(value: unknown): value is CorePyqCourse {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(corePyqCourses, value);
}

function isCorePyqSemester(value: unknown): value is CorePyqSemester {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(corePyqSemesters, value);
}

/**
 * Attach OCR JSON to the PDF resources that are already in production.
 * This is deliberately admin-only and accepts one subject manifest at a time
 * so large OCR bodies never have to travel through a public endpoint.
 */
export async function importCorePyqMetadataAction(
  _previousState: { ok: boolean; message: string } | undefined,
  formData: FormData,
) {
  await requireAdmin();

  const file = formData.get("file");
  if (!(file instanceof File)) return { ok: false, message: "Choose a JSON manifest first." };
  if (file.size > 25 * 1024 * 1024) return { ok: false, message: "Manifest is larger than 25 MB." };

  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    return { ok: false, message: "The selected file is not valid JSON." };
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return { ok: false, message: "Manifest must be a non-empty JSON array." };
  }

  let imported = 0;
  const missing: string[] = [];
  const errors: string[] = [];

  for (const raw of parsed) {
    const record = raw as Partial<CorePyqMetadataRecord>;
    const label = String(record.sourceJsonName ?? "unknown source");
    const pageCount = Number(record.pageCount);
    if (
      typeof record.sourceJsonName !== "string" ||
      !isCorePyqCourse(record.course) ||
      !isCorePyqSemester(record.semester) ||
      typeof record.academicYear !== "string" ||
      !/^\d{4}-\d{2}$/.test(record.academicYear) ||
      typeof record.year !== "number" ||
      typeof record.ocrText !== "string" ||
      record.ocrText.length === 0 ||
      !Number.isInteger(pageCount) ||
      pageCount <= 0
    ) {
      errors.push(`${label}: invalid metadata record`);
      continue;
    }

    try {
      const semesterOrder = corePyqSemesters[record.semester];
      const programName = corePyqCourses[record.course];
      const program = await prisma.program.upsert({
        where: { slug: `bsc-hons-${record.course.toLowerCase()}` },
        create: { name: programName, slug: `bsc-hons-${record.course.toLowerCase()}`, level: "COLLEGE" },
        update: { name: programName },
      });
      const term = await prisma.term.upsert({
        where: { programId_order: { programId: program.id, order: semesterOrder } },
        create: { programId: program.id, order: semesterOrder, name: `Semester ${semesterOrder}` },
        update: { name: `Semester ${semesterOrder}` },
      });
      const subject = await prisma.subject.upsert({
        where: { termId_slug: { termId: term.id, slug: record.course.toLowerCase() } },
        create: {
          termId: term.id,
          name: record.course,
          slug: record.course.toLowerCase(),
          description: `Combined ${record.course} previous-year question papers for ${programName}, Semester ${semesterOrder}.`,
        },
        update: { name: record.course },
      });

      let resource = await prisma.resource.findUnique({ where: { sourceJsonName: record.sourceJsonName } });
      if (!resource) {
        resource = await prisma.resource.findFirst({
          where: { subjectId: subject.id, type: "PYQ", year: record.year },
          orderBy: { createdAt: "desc" },
        });
      }
      if (!resource) {
        missing.push(label);
        continue;
      }

      await prisma.resource.update({
        where: { id: resource.id },
        data: {
          subjectId: subject.id,
          type: "PYQ",
          year: record.year,
          academicYear: record.academicYear,
          ocrText: record.ocrText,
          ocrTextHash: record.ocrTextHash || corePyqHash(record.ocrText),
          sourceJsonName: record.sourceJsonName,
          pageCount,
        },
      });
      imported += 1;
      revalidatePath(`/subjects/${subject.id}`);
    } catch (error) {
      errors.push(`${label}: ${error instanceof Error ? error.message : "database update failed"}`);
    }
  }

  const parts = [`Imported ${imported} of ${parsed.length} papers.`];
  if (missing.length) parts.push(`Missing PDF resources: ${missing.join(", ")}.`);
  if (errors.length) parts.push(`Errors: ${errors.join(" | ")}`);
  return { ok: missing.length === 0 && errors.length === 0, message: parts.join(" ") };
}

// This formatter is deliberately self-contained. It does not call an external
// model, rewrite the source text, or depend on an API quota. Every non-empty
// OCR line is retained in order; only headings, spacing, and page dividers are
// added around it.
const OCR_LOCAL_MARKER = "<!-- OCR_REFORMATTED_V2 -->";
const LEGACY_OCR_MARKER = "<!-- AI_REFORMATTED_OCR_V1 -->";

function formatOcrLocally(source: string) {
  const cleanSource = source
    .replace(new RegExp(`^\\s*(?:${OCR_LOCAL_MARKER}|${LEGACY_OCR_MARKER})\\s*`, "i"), "")
    .replace(/\r\n?/g, "\n");
  const lines = cleanSource.split("\n");
  const metadata: string[] = [];
  const document: string[] = [];
  const body: string[] = [];
  let inQuestions = false;
  let sawQuestion = false;

  const flushBody = () => {
    const text = body.map((line) => line.trim()).filter(Boolean).join(" ");
    if (text) document.push(text);
    body.length = 0;
  };
  const startQuestions = () => {
    if (inQuestions) return;
    flushBody();
    inQuestions = true;
    document.push("## Questions");
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const markdownQuestion = line.match(/^#{2,4}\s*(?:Question\s*)?(\d{1,2})\s*(?:[.:)\\-]\s*)?(.*)$/i);
    const question = line.match(/^(?:Question\s*)?(\d{1,2})\s*(?:[.:)\\-]\s*)?(.*)$/i);
    const markdownSubquestion = line.match(/^#{3,5}\s*((?:\([a-z]\)|\([ivx]+\)|[A-Z]\.))\s*(.*)$/i);
    const subquestion = line.match(/^((?:\([a-z]\)|\([ivx]+\)|[A-Z]\.))\s*(.*)$/i);
    const page = line.replace(/[0O]/g, "0").match(/^p\.?\s*t\.?\s*o\.?$/i);

    if (page) {
      flushBody();
      document.push("---", "*P.T.O.*", "---");
      continue;
    }
    if (markdownQuestion || (question && Number(question[1]) <= 20 && (inQuestions || question[2].trim()))) {
      startQuestions();
      flushBody();
      const match = markdownQuestion ?? question!;
      const suffix = match[2].trim();
      document.push(`## Question ${match[1]}${suffix ? ` — ${suffix}` : ""}`);
      sawQuestion = true;
      continue;
    }
    if (markdownSubquestion || subquestion) {
      startQuestions();
      if (!sawQuestion) {
        document.push("## Question 1");
        sawQuestion = true;
      }
      flushBody();
      const match = markdownSubquestion ?? subquestion!;
      document.push(`### ${match[1]}${match[2].trim() ? ` ${match[2].trim()}` : ""}`);
      continue;
    }

    if (!inQuestions) metadata.push(line);
    else body.push(line);
  }
  flushBody();

  const output: string[] = [];
  if (metadata.length) {
    output.push("## Paper details", ...metadata.map((line) => `- ${line}`));
  }
  output.push(...document);
  return `${OCR_LOCAL_MARKER}\n\n${output.join("\n\n")}`;
}

/**
 * Reformats exactly one paper per request. Keeping a paper atomic means a
 * partial model response can never replace its original OCR text.
 */
export async function reformatNextOcrPaperAction() {
  await requireAdmin();
  const resource = await prisma.resource.findFirst({
    where: {
      type: "PYQ",
      ocrText: { not: null },
      NOT: { ocrText: { startsWith: OCR_LOCAL_MARKER } },
    },
    orderBy: [{ academicYear: "asc" }, { year: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, subjectId: true, ocrText: true },
  });

  if (!resource || !resource.ocrText) {
    return { ok: true, done: true, message: "All OCR papers are already reformatted." };
  }

  await prisma.resource.update({
    where: { id: resource.id },
    data: { ocrText: formatOcrLocally(resource.ocrText) },
  });
  return {
    ok: true,
    done: false,
    message: `Reformatted ${resource.title} with lossless local structure.`,
  };
}

// ---------- Auth ----------

export async function loginAction(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const requestedPath = String(formData.get("next") ?? "").trim();

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSessionCookie({ adminId: admin.id, email: admin.email, name: admin.name });
  const safePath =
    (requestedPath === "/admin" || requestedPath.startsWith("/admin/")) &&
    !requestedPath.startsWith("//")
      ? requestedPath
      : "/admin";
  redirect(safePath);
}

export async function logoutAction() {
  await destroySessionCookie();
  redirect("/admin/login");
}

// ---------- Programs ----------

export async function createProgramAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const level = String(formData.get("level") ?? "COLLEGE") as "SCHOOL" | "COLLEGE";
  const summary = String(formData.get("summary") ?? "").trim() || null;
  if (!name) throw new Error("Program name is required.");

  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.program.findUnique({ where: { slug: s } });
    return !!found;
  });

  await prisma.program.create({ data: { name, level, summary, slug } });
  revalidatePath("/admin/programs");
  revalidatePath("/browse/[level]", "page");
}

export async function deleteProgramAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.program.delete({ where: { id } });
  revalidatePath("/admin/programs");
}

// ---------- Exam sessions (year -> course -> Drive link) ----------

export async function createExamSessionAction(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  const order = Number(formData.get("order") ?? 0) || 0;
  const masterDriveUrl = String(formData.get("masterDriveUrl") ?? "").trim() || null;
  if (!label) throw new Error("Session label is required.");

  await prisma.examSession.create({ data: { label, order, masterDriveUrl } });
  revalidatePath("/admin/exam-sessions");
  revalidatePath("/exam-sessions");
}

export async function updateExamSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  const order = Number(formData.get("order") ?? 0) || 0;
  const masterDriveUrl = String(formData.get("masterDriveUrl") ?? "").trim() || null;
  if (!label) throw new Error("Session label is required.");

  await prisma.examSession.update({ where: { id }, data: { label, order, masterDriveUrl } });
  revalidatePath("/admin/exam-sessions");
  revalidatePath(`/admin/exam-sessions/${id}`);
  revalidatePath("/exam-sessions");
  revalidatePath(`/exam-sessions/${id}`);
}

export async function deleteExamSessionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.examSession.delete({ where: { id } });
  revalidatePath("/admin/exam-sessions");
  revalidatePath("/exam-sessions");
}

// Manually links (or edits) one Program's Drive folder for a session —
// used both for one-off edits and to resolve a CSV row the auto-matcher
// flagged as "needs-review". Upserted, so re-submitting the same
// session+program never creates a duplicate row.
export async function linkProgramToSessionAction(formData: FormData) {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId"));
  const programId = String(formData.get("programId"));
  const variantLabel = String(formData.get("variantLabel") ?? "").trim();
  const driveUrl = String(formData.get("driveUrl") ?? "").trim();
  if (!sessionId || !programId) throw new Error("Session and course are required.");
  if (!driveUrl) throw new Error("A Drive link is required.");

  await prisma.sessionProgramLink.upsert({
    where: { sessionId_programId_variantLabel: { sessionId, programId, variantLabel } },
    update: { driveUrl },
    create: { sessionId, programId, variantLabel, driveUrl },
  });

  revalidatePath(`/admin/exam-sessions/${sessionId}`);
  revalidatePath(`/exam-sessions/${sessionId}`);
}

export async function deleteSessionProgramLinkAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const sessionId = String(formData.get("sessionId"));
  await prisma.sessionProgramLink.delete({ where: { id } });
  revalidatePath(`/admin/exam-sessions/${sessionId}`);
  revalidatePath(`/exam-sessions/${sessionId}`);
}

export type SessionCsvRowResult = {
  courseLabel: string;
  driveUrl: string;
  status: "linked" | "needs-review" | "invalid";
  matchedProgramId?: string;
  matchedProgramName?: string;
  confidence?: number;
  message?: string;
};

// Bulk-imports a session's course -> Drive-link table from a pasted/uploaded
// CSV (columns: course/program/name, url/link/drive/folder). Matches each
// row against the existing, small, stable Program list — never against
// individual Subjects — so minor name variants across yearly re-imports
// resolve to the same Program instead of the old bug where a fresh row (and
// effectively a whole duplicate "folder") got created for every spelling
// variant. High-confidence matches (>=0.9) are linked automatically;
// anything less confident is left unlinked and reported back as
// "needs-review" for the admin to resolve by hand via
// linkProgramToSessionAction — nothing is ever silently auto-created.
export async function importSessionLinksFromCsvAction(
  formData: FormData
): Promise<{ results: SessionCsvRowResult[] }> {
  await requireAdmin();
  const sessionId = String(formData.get("sessionId"));
  const file = formData.get("file") as File | null;
  if (!sessionId) throw new Error("A session is required.");
  if (!file || file.size === 0) throw new Error("A CSV file is required.");

  const { parseCsv } = await import("@/lib/csv");
  const { matchProgramName } = await import("@/lib/subject-quality");
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error(
      "Could not read any rows from that file — check it's a real CSV (comma, semicolon, or tab-separated) with a header row."
    );
  }

  const programs = await prisma.program.findMany();
  const results: SessionCsvRowResult[] = [];
  let touched = false;

  for (const row of rows) {
    const courseLabel = (row.course || row.program || row.name || "").trim();
    const driveUrl = (row.url || row.link || row.drive || row.folder || "").trim();

    if (!courseLabel) {
      results.push({ courseLabel: "(blank)", driveUrl, status: "invalid", message: "No course/program column found" });
      continue;
    }
    if (!driveUrl) {
      results.push({ courseLabel, driveUrl: "", status: "invalid", message: "No Drive link found" });
      continue;
    }

    const { program, confidence, variantLabel } = matchProgramName(programs, courseLabel);
    if (program && confidence >= 0.9) {
      await prisma.sessionProgramLink.upsert({
        where: { sessionId_programId_variantLabel: { sessionId, programId: program.id, variantLabel } },
        update: { driveUrl },
        create: { sessionId, programId: program.id, variantLabel, driveUrl },
      });
      touched = true;
      results.push({
        courseLabel,
        driveUrl,
        status: "linked",
        matchedProgramId: program.id,
        matchedProgramName: variantLabel ? `${program.name} (${variantLabel})` : program.name,
        confidence,
      });
    } else {
      results.push({
        courseLabel,
        driveUrl,
        status: "needs-review",
        matchedProgramId: program?.id,
        matchedProgramName: program?.name,
        confidence,
        message: program
          ? `Closest match "${program.name}" is only ${Math.round(confidence * 100)}% confident`
          : "No similar course found",
      });
    }
  }

  if (touched) {
    revalidatePath(`/admin/exam-sessions/${sessionId}`);
    revalidatePath(`/exam-sessions/${sessionId}`);
  }

  return { results };
}

export type DriveSyncRowResult = {
  fileName: string;
  subjectName: string;
  isNewSubject: boolean;
};

// Lists the PDFs inside a SessionProgramLink's Drive folder and, for each
// one, derives a subject name straight from the filename (see
// deriveSubjectNameFromFilename) rather than matching against the old
// code-prefixed Subject taxonomy. The derived name is then matched against
// DriveSubjects already known for this Program (across every session/year)
// so a re-sync next year — even with different capitalization, "(H)" vs
// "(Hons)" wording, or a small typo in the filename — reuses the same
// subject instead of creating a near-duplicate. Never downloads the PDFs;
// only stores id/name/link. Safe to re-run (upsert on [linkId, driveFileId]).
export async function syncDriveFilesForLinkAction(
  formData: FormData
): Promise<{ results: DriveSyncRowResult[] }> {
  await requireAdmin();
  const linkId = String(formData.get("linkId"));
  if (!linkId) throw new Error("A course link is required.");

  const link = await prisma.sessionProgramLink.findUnique({ where: { id: linkId } });
  if (!link) throw new Error("That course link no longer exists.");

  const { extractDriveFolderId, listDriveFolderPdfs } = await import("@/lib/google-drive");
  const folderId = extractDriveFolderId(link.driveUrl);
  if (!folderId) throw new Error("Could not find a folder id in that Drive link.");

  const files = await listDriveFolderPdfs(folderId);

  const { guessYear } = await import("@/lib/subject-match");
  const { deriveSubjectNameFromFilename, matchDriveSubjectName, classifyDriveFilename } = await import(
    "@/lib/subject-quality"
  );

  const [driveSubjectsInit, allPrograms] = await Promise.all([
    prisma.driveSubject.findMany({ where: { programId: link.programId } }),
    prisma.program.findMany({ select: { id: true, name: true } }),
  ]);
  const driveSubjects = driveSubjectsInit;

  const results: DriveSyncRowResult[] = [];

  for (const file of files) {
    const rawName = deriveSubjectNameFromFilename(file.name) || file.name.replace(/\.pdf$/i, "");
    const year = guessYear(file.name);

    // A shared Drive folder can hold every program's own combined booklet
    // side by side — only this program's own booklet belongs here at all;
    // another program's leaks in from the shared folder and is dropped.
    const classification = classifyDriveFilename(allPrograms, link.programId, rawName);
    if (classification === "foreign_booklet") continue;

    if (classification === "own_booklet") {
      await prisma.driveFileMatch.upsert({
        where: { linkId_driveFileId: { linkId, driveFileId: file.id } },
        update: { fileName: file.name, webViewLink: file.webViewLink, year, driveSubjectId: null, isCourseBooklet: true },
        create: {
          linkId,
          driveFileId: file.id,
          fileName: file.name,
          webViewLink: file.webViewLink,
          year,
          driveSubjectId: null,
          isCourseBooklet: true,
        },
      });
      results.push({ fileName: file.name, subjectName: "(combined booklet — not yet split)", isNewSubject: false });
      continue;
    }

    const { subject, confidence } = matchDriveSubjectName(driveSubjects, rawName);
    let driveSubjectId: string;
    let isNewSubject = false;
    if (subject && confidence >= 0.85) {
      driveSubjectId = subject.id;
    } else {
      const slug = await uniqueSlug(rawName, async (s) => {
        const found = await prisma.driveSubject.findUnique({
          where: { programId_slug: { programId: link.programId, slug: s } },
        });
        return !!found;
      });
      const created = await prisma.driveSubject.create({
        data: { programId: link.programId, name: rawName, slug },
      });
      driveSubjects.push(created);
      driveSubjectId = created.id;
      isNewSubject = true;
    }

    await prisma.driveFileMatch.upsert({
      where: { linkId_driveFileId: { linkId, driveFileId: file.id } },
      update: { fileName: file.name, webViewLink: file.webViewLink, year, driveSubjectId },
      create: {
        linkId,
        driveFileId: file.id,
        fileName: file.name,
        webViewLink: file.webViewLink,
        year,
        driveSubjectId,
      },
    });

    results.push({
      fileName: file.name,
      subjectName: driveSubjects.find((s) => s.id === driveSubjectId)?.name ?? rawName,
      isNewSubject,
    });
  }

  revalidatePath(`/admin/exam-sessions/${link.sessionId}`);
  revalidatePath(`/exam-sessions/${link.sessionId}/${link.id}`);

  return { results };
}

// Renames a DriveSubject (e.g. to merge a wording the auto-matcher didn't
// catch, or just to tidy up a name straight from a messy filename).
export async function renameDriveSubjectAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("A name is required.");

  const subject = await prisma.driveSubject.findUnique({ where: { id } });
  if (!subject) throw new Error("That subject no longer exists.");

  const slug = await uniqueSlug(name, async (s) => {
    if (s === subject.slug) return false;
    const found = await prisma.driveSubject.findUnique({
      where: { programId_slug: { programId: subject.programId, slug: s } },
    });
    return !!found;
  });

  await prisma.driveSubject.update({ where: { id }, data: { name, slug } });
  revalidatePath(`/admin/exam-sessions`);
}

// Merges one DriveSubject into another (moves all its files over, then
// deletes the now-empty one) — for the rare case the auto-matcher created
// two subjects for what's really the same one.
export async function mergeDriveSubjectsAction(formData: FormData) {
  await requireAdmin();
  const fromId = String(formData.get("fromId"));
  const intoId = String(formData.get("intoId"));
  if (!fromId || !intoId || fromId === intoId) throw new Error("Pick two different subjects to merge.");

  await prisma.driveFileMatch.updateMany({ where: { driveSubjectId: fromId }, data: { driveSubjectId: intoId } });
  await prisma.driveSubject.delete({ where: { id: fromId } });
  revalidatePath(`/admin/exam-sessions`);
}

// Links a DriveSubject (filename-derived, e.g. "Company Law III") to its
// matching catalog Subject (syllabus-derived, e.g. "DSC-2.2 — Company Law")
// so its Drive-matched papers count toward that subject's coverage on the
// Course Coverage page. Several DriveSubjects can point at the same catalog
// Subject; pass an empty subjectId to unlink. See
// prisma/link-drive-subjects-to-catalog.ts for the auto-linker this backs up.
export async function linkDriveSubjectToSubjectAction(formData: FormData) {
  await requireAdmin();
  const driveSubjectId = String(formData.get("driveSubjectId"));
  const subjectId = String(formData.get("subjectId") ?? "").trim() || null;
  if (!driveSubjectId) throw new Error("A Drive subject is required.");

  await prisma.driveSubject.update({ where: { id: driveSubjectId }, data: { subjectId } });
  revalidatePath("/admin/course-coverage");
}

// ---------- Terms ----------

export async function createTermAction(formData: FormData) {
  await requireAdmin();
  const programId = String(formData.get("programId"));
  const name = String(formData.get("name") ?? "").trim();
  const order = Number(formData.get("order") ?? 1);
  if (!name) throw new Error("Term name is required.");

  await prisma.term.create({ data: { programId, name, order } });
  revalidatePath(`/admin/programs/${programId}`);
}

export async function deleteTermAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.term.delete({ where: { id } });
  revalidatePath(`/admin/programs/${programId}`);
}

// ---------- Subjects ----------

export async function createSubjectAction(formData: FormData) {
  await requireAdmin();
  const termId = String(formData.get("termId"));
  const programId = String(formData.get("programId"));
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const upc =
    String(formData.get("upc") ?? "").trim() ||
    extractUpcCandidate(String(formData.get("sourceText") ?? ""));
  const paperType = String(formData.get("paperType") ?? "").trim().toUpperCase() || null;
  const aliases = String(formData.get("aliases") ?? "")
    .split(/[;|\n]/)
    .map((alias) => alias.trim())
    .filter(Boolean);
  if (!name) throw new Error("Subject name is required.");

  // Case, punctuation, and spacing changes should not create a second row
  // for the same subject. Fuzzy cases remain reviewable in Subject issues.
  const baseSlug = slugify(name) || "subject";
  const existing = await prisma.subject.findUnique({
    where: { termId_slug: { termId, slug: baseSlug } },
  });
  if (existing) {
    revalidatePath(`/admin/programs/${programId}`);
    return;
  }

  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.subject.findUnique({
      where: { termId_slug: { termId, slug: s } },
    });
    return !!found;
  });

  await prisma.subject.create({ data: { termId, name, description, slug, upc, paperType, aliases } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/subject-issues");
}

export async function updateSubjectIdentityAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const upc = String(formData.get("upc") ?? "").trim() || null;
  const paperType = String(formData.get("paperType") ?? "").trim().toUpperCase() || null;
  const aliases = String(formData.get("aliases") ?? "")
    .split(/[;|\n]/)
    .map((alias) => alias.trim())
    .filter(Boolean);
  if (!subjectId) throw new Error("A subject is required.");

  const subject = await prisma.subject.update({
    where: { id: subjectId },
    data: { upc, paperType, aliases: [...new Set(aliases)] },
    select: { term: { select: { programId: true } } },
  });
  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath(`/admin/programs/${subject.term.programId}`);
}

// Reuses an existing subject if one with this name already exists under the
// term, instead of always creating a new one — needed for the consolidated
// (Semester/Subject/Year) upload flow, where the same subject folder (e.g.
// "Physics") gets uploaded across several separate zip/session runs and
// each run should land in the same subject, not spawn "Physics (2)", "Physics (3)".
export async function findOrCreateSubjectAction(formData: FormData) {
  await requireAdmin();
  const termId = String(formData.get("termId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!termId) throw new Error("A semester is required.");
  if (!name) throw new Error("Subject name is required.");

  const slug = slugify(name) || "subject";
  const existing = await prisma.subject.findUnique({ where: { termId_slug: { termId, slug } } });
  if (existing) return { id: existing.id, name: existing.name, termId };

  const created = await prisma.subject.create({ data: { termId, name, slug } });
  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (term) revalidatePath(`/admin/programs/${term.programId}`);
  revalidatePath("/admin/subject-issues");
  return { id: created.id, name: created.name, termId };
}

// Upload/import resolver. Unlike findOrCreateSubjectAction this function is
// deliberately read-only: a filename can match an official subject, but can
// never become a new Subject row. The caller must send unmatched files to the
// review queue.
export async function findOfficialSubjectAction(formData: FormData) {
  await requireAdmin();
  const termId = String(formData.get("termId") ?? "").trim();
  const subjectName = String(formData.get("subjectName") ?? formData.get("name") ?? "").trim();
  const upc = String(formData.get("upc") ?? "").trim() || null;
  if (!termId) throw new Error("A semester is required.");

  const candidates = await prisma.subject.findMany({
    where: { termId },
    select: { id: true, name: true, upc: true, aliases: true },
  });
  const match = matchOfficialSubject(candidates, { subjectName, upc });
  return {
    subject: match.subject ? { id: match.subject.id, name: match.subject.name, termId } : null,
    method: match.method,
  };
}

// Same as createSubjectAction, but returns the created row so callers that
// invoke it programmatically (not via a <form>) can use the new id right
// away — e.g. assigning it to a row mid-workflow without a page reload.
export async function quickCreateSubjectAction(formData: FormData) {
  await requireAdmin();
  const termId = String(formData.get("termId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!termId) throw new Error("A semester is required.");
  if (!name) throw new Error("Subject name is required.");

  const baseSlug = slugify(name) || "subject";
  const existing = await prisma.subject.findUnique({
    where: { termId_slug: { termId, slug: baseSlug } },
  });
  if (existing) return { id: existing.id, name: existing.name, termId: existing.termId };

  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.subject.findUnique({
      where: { termId_slug: { termId, slug: s } },
    });
    return !!found;
  });

  const subject = await prisma.subject.create({ data: { termId, name, slug } });
  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (term) revalidatePath(`/admin/programs/${term.programId}`);
  revalidatePath("/admin/subject-issues");

  return { id: subject.id, name: subject.name, termId: subject.termId };
}

// Long-form compiled notes an admin pastes in as markdown — rendered on the
// public subject page with its own styling, separate from uploaded NOTES
// PDFs. Empty content deletes the row instead of storing a blank note.
export async function updateSubjectNotesAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId"));
  const content = String(formData.get("content") ?? "").trim();
  const themeRaw = String(formData.get("theme") ?? "sky");
  const theme = (["sky", "violet", "emerald", "amber"] as const).includes(
    themeRaw as "sky" | "violet" | "emerald" | "amber"
  )
    ? themeRaw
    : "sky";
  if (!subjectId) throw new Error("Subject is required.");

  if (!content) {
    await prisma.subjectNotes.deleteMany({ where: { subjectId } });
  } else {
    await prisma.subjectNotes.upsert({
      where: { subjectId },
      create: { subjectId, content, theme },
      update: { content, theme },
    });
  }

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
}

// Saves a note keyed directly by the 118-programme canonical syllabus file
// (see canonical-subject-notes-data.ts) rather than a Program/Term/Subject
// DB row — that hierarchy has duplicate/legacy programmes and names that
// don't reliably match the canonical syllabus, which is what this action
// exists to route around.
export async function updateCanonicalSubjectNoteAction(formData: FormData) {
  await requireAdmin();
  const programmeSlug = String(formData.get("programmeSlug") ?? "");
  const programme = String(formData.get("programme") ?? "");
  const subjectSlug = String(formData.get("subjectSlug") ?? "");
  const subject = String(formData.get("subject") ?? "");
  const content = String(formData.get("content") ?? "").trim();
  const themeRaw = String(formData.get("theme") ?? "sky");
  const theme = (["sky", "violet", "emerald", "amber"] as const).includes(
    themeRaw as "sky" | "violet" | "emerald" | "amber"
  )
    ? themeRaw
    : "sky";
  if (!programmeSlug || !subjectSlug) throw new Error("Programme and subject are required.");

  if (!content) {
    await prisma.canonicalSubjectNote.deleteMany({ where: { programmeSlug, subjectSlug } });
  } else {
    await prisma.canonicalSubjectNote.upsert({
      where: { programmeSlug_subjectSlug: { programmeSlug, subjectSlug } },
      create: { programmeSlug, programme, subjectSlug, subject, content, theme },
      update: { programme, subject, content, theme },
    });
  }

  revalidatePath(`/admin/subject-notes/subject/${programmeSlug}/${subjectSlug}`);
  revalidatePath(`/admin/subject-notes/program/${programmeSlug}`);
  revalidatePath(`/admin/subject-notes`);
}

// Shared by moveSubjectsToTermAction (UI-driven) and
// matchUnsortedFromCsvAction (CSV-driven) — grouped by destination term,
// then done in as few queries as possible: subjects whose existing slug
// doesn't collide with anything already in that term get one batched
// `updateMany` per group (no per-row round trip); only genuine slug
// collisions fall back to a per-row update with a regenerated unique slug,
// since that's rare in practice.
async function applySubjectMoves(assignments: { subjectId: string; termId: string }[]): Promise<number> {
  if (assignments.length === 0) return 0;

  const subjectIds = assignments.map((a) => a.subjectId);
  const subjects = await prisma.subject.findMany({
    where: { id: { in: subjectIds } },
    select: { id: true, name: true, slug: true },
  });
  const subjectById = new Map(subjects.map((s) => [s.id, s]));

  const byTerm = new Map<string, string[]>();
  for (const a of assignments) {
    if (!subjectById.has(a.subjectId)) continue;
    if (!byTerm.has(a.termId)) byTerm.set(a.termId, []);
    byTerm.get(a.termId)!.push(a.subjectId);
  }

  let moved = 0;
  const touchedProgramIds = new Set<string>();

  for (const [termId, ids] of byTerm) {
    const term = await prisma.term.findUnique({ where: { id: termId }, select: { programId: true } });
    if (!term) continue;
    touchedProgramIds.add(term.programId);

    const destSlugs = new Set(
      (await prisma.subject.findMany({ where: { termId }, select: { slug: true } })).map((s) => s.slug)
    );

    const clean: string[] = [];
    const collisions: string[] = [];
    for (const id of ids) {
      const slug = subjectById.get(id)!.slug;
      if (destSlugs.has(slug)) collisions.push(id);
      else clean.push(id);
    }

    if (clean.length > 0) {
      const result = await prisma.subject.updateMany({
        where: { id: { in: clean } },
        data: { termId },
      });
      moved += result.count;
    }

    for (const id of collisions) {
      const subject = subjectById.get(id)!;
      const slug = await uniqueSlug(subject.name, async (s) => destSlugs.has(s));
      destSlugs.add(slug);
      await prisma.subject.update({ where: { id }, data: { termId, slug } });
      moved++;
    }
  }

  for (const programId of touchedProgramIds) revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/unsorted");

  return moved;
}

// Reassigns subjects to a real course + semester — the fast path out of
// the "Unsorted (Pending Categorization)" holding pool. Each subject can go
// to a DIFFERENT destination (the whole point — 512 imported subjects
// span every department, not one shared course), so this takes a list of
// individual {subjectId, termId} assignments rather than one shared termId.
export async function moveSubjectsToTermAction(formData: FormData) {
  await requireAdmin();
  const assignmentsRaw = String(formData.get("assignments") ?? "[]");
  let assignments: { subjectId: string; termId: string }[];
  try {
    assignments = JSON.parse(assignmentsRaw);
  } catch {
    throw new Error("Malformed assignment list.");
  }
  assignments = assignments.filter((a) => a?.subjectId && a?.termId);
  if (assignments.length === 0) throw new Error("No subjects with a destination picked.");

  const moved = await applySubjectMoves(assignments);
  return { moved };
}

export type UnsortedCsvRowResult = {
  name: string;
  status: "matched" | "no-subject-match" | "no-program-match" | "no-term-match" | "no-name";
  message?: string;
};

// CSV-driven version of the same move — for going through the Unsorted
// backlog offline (in a spreadsheet) instead of one search-batch at a time
// in the UI. Expected columns (case-insensitive, any order): name (or
// subject), program (or course), term (or semester). Matches each row's
// name against the current Unsorted pool by exact-then-loose match; a name
// that appears twice in the sheet only consumes one subject (first match
// wins) so accidental duplicate rows can't double-claim the same subject.
export async function matchUnsortedFromCsvAction(
  formData: FormData
): Promise<{ results: UnsortedCsvRowResult[] }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("A CSV file is required.");

  const { parseCsv } = await import("@/lib/csv");
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error(
      "Could not read any rows from that file — check it's a real CSV (comma, semicolon, or tab-separated) with a header row."
    );
  }

  const holding = await prisma.program.findFirst({ where: { name: "Unsorted (Pending Categorization)" } });
  const unsortedSubjects = holding
    ? await prisma.subject.findMany({
        where: { term: { programId: holding.id } },
        select: { id: true, name: true, slug: true },
      })
    : [];

  const programs = await prisma.program.findMany({
    where: { id: { not: holding?.id ?? "" } },
    include: { terms: true },
  });

  const results: UnsortedCsvRowResult[] = [];
  const assignments: { subjectId: string; termId: string }[] = [];
  const claimed = new Set<string>();

  for (const row of rows) {
    const name = (row.name || row.subject || row.title || "").trim();
    if (!name) {
      results.push({ name: "(blank)", status: "no-name" });
      continue;
    }

    const subject =
      unsortedSubjects.find((s) => !claimed.has(s.id) && s.name.trim().toLowerCase() === name.toLowerCase()) ??
      unsortedSubjects.find((s) => !claimed.has(s.id) && normalizeLoose(s.name) === normalizeLoose(name));
    if (!subject) {
      results.push({ name, status: "no-subject-match" });
      continue;
    }

    const programVal = (row.program || row.course || "").trim();
    const program = findProgramMatch(programs, programVal);
    if (!program) {
      results.push({ name, status: "no-program-match", message: `No course matched "${programVal}"` });
      continue;
    }

    const termVal = (row.term || row.semester || row.sem || "").trim();
    const term = findTermMatch(program.terms, termVal);
    if (!term) {
      results.push({
        name,
        status: "no-term-match",
        message: `No semester matched "${termVal}" in ${program.name}`,
      });
      continue;
    }

    claimed.add(subject.id);
    assignments.push({ subjectId: subject.id, termId: term.id });
    results.push({ name, status: "matched" });
  }

  await applySubjectMoves(assignments);

  return { results };
}

export type NewSubjectCsvRowResult = {
  name: string;
  status: "created" | "duplicate" | "no-program-match" | "no-term-match" | "no-name";
  message?: string;
};

// Creates brand-new subjects straight into their real course + semester —
// for subjects that were never in the Unsorted import at all, skipping the
// holding pool entirely. Expected columns (case-insensitive, any order):
// name (or subject), program (or course), term (or semester), and
// optionally code and description.
export async function createSubjectsFromCsvAction(
  formData: FormData
): Promise<{ results: NewSubjectCsvRowResult[] }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("A CSV file is required.");

  const { parseCsv } = await import("@/lib/csv");
  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length === 0) {
    throw new Error(
      "Could not read any rows from that file — check it's a real CSV (comma, semicolon, or tab-separated) with a header row."
    );
  }

  const programs = await prisma.program.findMany({
    include: { terms: { include: { subjects: { select: { id: true, name: true, slug: true } } } } },
  });

  const results: NewSubjectCsvRowResult[] = [];
  const touchedProgramIds = new Set<string>();

  for (const row of rows) {
    const name = (row.name || row.subject || row.title || "").trim();
    if (!name) {
      results.push({ name: "(blank)", status: "no-name" });
      continue;
    }

    const programVal = (row.program || row.course || "").trim();
    const program = findProgramMatch(programs, programVal);
    if (!program) {
      results.push({ name, status: "no-program-match", message: `No course matched "${programVal}"` });
      continue;
    }

    const termVal = (row.term || row.semester || row.sem || "").trim();
    const term = findTermMatch(program.terms, termVal);
    if (!term) {
      results.push({
        name,
        status: "no-term-match",
        message: `No semester matched "${termVal}" in ${program.name}`,
      });
      continue;
    }

    const code = (row.code || "").trim();
    const upc = (row.upc || row.paper_code || row.course_number || code).trim() || null;
    const paperType = (row.paper_type || row.type || row.category || "").trim().toUpperCase() || null;
    const aliases = (row.aliases || row.alias || "")
      .split(/[;|]/)
      .map((alias) => alias.trim())
      .filter(Boolean);
    const descRaw = (row.description || "").trim();
    const description = code ? (descRaw ? `Code: ${code} | ${descRaw}` : `Code: ${code}`) : descRaw || null;

    const baseSlug = slugify(name) || "subject";
    const existing = term.subjects.find(
      (subject) => subject.slug === baseSlug || subject.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      await prisma.subject.update({
        where: { id: existing.id },
        data: { upc, paperType, aliases: [...new Set(aliases)], ...(description ? { description } : {}) },
      });
      touchedProgramIds.add(program.id);
      results.push({
        name,
        status: "duplicate",
        message: `Updated official identity for existing subject in ${program.name} · ${term.name}`,
      });
      continue;
    }

    const takenSlugs = new Set(term.subjects.map((s) => s.slug));
    const slug = await uniqueSlug(name, async (s) => takenSlugs.has(s));

    const created = await prisma.subject.create({
      data: { termId: term.id, name, slug, description, upc, paperType, aliases: [...new Set(aliases)] },
    });
    term.subjects.push({ id: created.id, name, slug });
    touchedProgramIds.add(program.id);
    results.push({ name, status: "created" });
  }

  for (const programId of touchedProgramIds) revalidatePath(`/admin/programs/${programId}`);
  if (touchedProgramIds.size > 0) revalidatePath("/admin/subject-issues");

  return { results };
}

// Remembers a title -> subject association from a manual Bulk Upload
// correction, so future papers with a similarly-named title (same title,
// different trailing paper number) auto-match without re-picking.
export async function rememberSubjectMatchAction(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  if (!key || !subjectId) return;

  await prisma.subjectMatchMemory.upsert({
    where: { key },
    create: { key, subjectId },
    update: { subjectId },
  });
}

// Remembers a course-guess -> Program association from a manual
// Consolidated Upload correction, so a future upload with a similarly
// (but not identically) worded course name auto-matches without re-picking.
export async function rememberCourseMatchAction(formData: FormData) {
  await requireAdmin();
  const key = String(formData.get("key") ?? "").trim();
  const programId = String(formData.get("programId") ?? "").trim();
  if (!key || !programId) return;

  await prisma.courseMatchMemory.upsert({
    where: { key },
    create: { key, programId },
    update: { programId },
  });
}

export async function deleteSubjectAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.subject.delete({ where: { id } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/subject-issues");
}

// Folds a duplicate subject (created by mistake — same subject filed twice
// under slightly different names/spellings) into another. Every resource
// and question moves over; compiled notes/analysis move over only if the
// target doesn't already have its own (both are @unique on subjectId, so
// keeping both would violate that constraint — the target's version wins
// on conflict since it's the one being kept). The source subject is then
// deleted. Redirects to the surviving subject since the source's admin
// page no longer exists after this runs.
export async function mergeSubjectsAction(formData: FormData) {
  await requireAdmin();
  const sourceId = String(formData.get("sourceId") ?? "").trim();
  const targetId = String(formData.get("targetId") ?? "").trim();
  const mergedName = String(formData.get("mergedName") ?? "").trim();
  if (!sourceId || !targetId) throw new Error("Both subjects are required.");
  if (sourceId === targetId) throw new Error("Can't merge a subject into itself.");

  const [source, target] = await Promise.all([
    prisma.subject.findUnique({
      where: { id: sourceId },
      include: { notes: true, analysis: true, term: true },
    }),
    prisma.subject.findUnique({ where: { id: targetId }, include: { notes: true, analysis: true } }),
  ]);
  if (!source || !target) throw new Error("Subject not found.");

  // Give the target a unique slug if the admin renamed it, so the rename
  // can't collide with an unrelated subject already in the same term.
  let renameSlug: string | null = null;
  if (mergedName && mergedName !== target.name) {
    const baseSlug = slugify(mergedName) || "subject";
    renameSlug = baseSlug;
    let suffix = 2;
    while (
      renameSlug !== target.slug &&
      (await prisma.subject.findUnique({ where: { termId_slug: { termId: target.termId, slug: renameSlug } } }))
    ) {
      renameSlug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }
  }

  await prisma.$transaction([
    prisma.resource.updateMany({ where: { subjectId: sourceId }, data: { subjectId: targetId } }),
    prisma.question.updateMany({ where: { subjectId: sourceId }, data: { subjectId: targetId } }),
    prisma.driveSubject.updateMany({ where: { subjectId: sourceId }, data: { subjectId: targetId } }),
    prisma.subjectMatchMemory.updateMany({ where: { subjectId: sourceId }, data: { subjectId: targetId } }),
    prisma.noteTheme.updateMany({ where: { subjectId: sourceId }, data: { subjectId: targetId } }),
    // Notes are admin-authored content — combine both instead of silently
    // dropping the source's when the target already has its own.
    ...(source.notes && target.notes
      ? [
          prisma.subjectNotes.update({
            where: { id: target.notes.id },
            data: { content: `${target.notes.content}\n\n---\n\n${source.notes.content}` },
          }),
        ]
      : source.notes && !target.notes
        ? [prisma.subjectNotes.update({ where: { id: source.notes.id }, data: { subjectId: targetId } })]
        : []),
    ...(source.analysis && !target.analysis
      ? [
          prisma.subjectAnalysis.update({
            where: { id: source.analysis.id },
            data: { subjectId: targetId },
          }),
        ]
      : []),
    prisma.subject.update({
      where: { id: targetId },
      data: {
        name: mergedName || target.name,
        slug: renameSlug || target.slug,
        upc: target.upc || source.upc,
        paperType: target.paperType || source.paperType,
        aliases: [
          ...new Set([
            ...target.aliases,
            ...source.aliases,
            ...(source.name !== (mergedName || target.name) ? [source.name] : []),
          ]),
        ],
      },
    }),
    prisma.subject.delete({ where: { id: sourceId } }),
  ]);

  revalidatePath(`/admin/programs/${source.term.programId}`);
  revalidatePath("/admin/subject-issues");
  revalidatePath(`/admin/subjects/${targetId}`);
  revalidatePath(`/subjects/${targetId}`);
  redirect("/admin/subject-issues");
}

// ---------- Resources (Notes / PYQs) ----------

async function requireCanonicalSubject(subjectId: string) {
  if (!subjectId) throw new Error("A canonical subject is required.");
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true, termId: true },
  });
  if (!subject) throw new Error("The selected official subject no longer exists.");
  return subject;
}

export async function uploadResourceAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId"));
  const type = String(formData.get("type") ?? "NOTES") as "NOTES" | "PYQ";
  const title = String(formData.get("title") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const academicYear = String(formData.get("academicYear") ?? "").trim() || null;
  const file = formData.get("file") as File | null;
  const batchId = String(formData.get("batchId") ?? "").trim() || null;

  if (!title) throw new Error("Title is required.");
  if (!file || file.size === 0) throw new Error("A file is required.");
  await requireCanonicalSubject(subjectId);

  // Reject exact-duplicate content (same PDF bytes) regardless of filename,
  // so re-uploading the same paper twice (same batch or a later one) is a
  // no-op instead of creating a second copy.
  const fileHash = await hashFile(file);
  const existing = await prisma.resource.findFirst({ where: { fileHash } });
  if (existing) {
    return { status: "duplicate" as const, resourceId: existing.id };
  }

  const { fileUrl, fileName, fileSize } = await saveUploadedFile(
    file,
    type === "PYQ" ? "pyqs" : "notes",
    subjectId,
  );

  if (batchId) {
    await prisma.uploadBatch.upsert({ where: { id: batchId }, create: { id: batchId }, update: {} });
  }

  const resource = await prisma.resource.create({
    data: { subjectId, type, title, year, academicYear, fileUrl, fileName, fileSize, fileHash, batchId },
  });

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/admin/resources");
  revalidatePath("/admin/batches");

  return { status: "created" as const, resourceId: resource.id };
}

type DirectUploadMetadata = {
  subjectId: string;
  type: "NOTES" | "PYQ";
  title: string;
  year: number | null;
  academicYear: string | null;
  batchId: string | null;
  fileName: string;
  fileSize: number;
  fileHash: string;
};

function parseDirectUploadMetadata(formData: FormData): DirectUploadMetadata {
  const type = String(formData.get("type") ?? "PYQ") as "NOTES" | "PYQ";
  const yearRaw = String(formData.get("year") ?? "").trim();
  const metadata = {
    subjectId: String(formData.get("subjectId") ?? "").trim(),
    type,
    title: String(formData.get("title") ?? "").trim(),
    year: yearRaw ? Number(yearRaw) : null,
    academicYear: String(formData.get("academicYear") ?? "").trim() || null,
    batchId: String(formData.get("batchId") ?? "").trim() || null,
    fileName: String(formData.get("fileName") ?? "paper.pdf").trim(),
    fileSize: Number(formData.get("fileSize") ?? 0),
    fileHash: String(formData.get("fileHash") ?? "").trim(),
  };
  if (!metadata.subjectId) throw new Error("A subject is required.");
  if (!metadata.title) throw new Error("A title is required.");
  if (!metadata.fileHash || !/^[a-f0-9]{64}$/i.test(metadata.fileHash)) {
    throw new Error("The PDF hash is invalid.");
  }
  if (!Number.isFinite(metadata.fileSize) || metadata.fileSize <= 0) {
    throw new Error("The PDF size is invalid.");
  }
  if (metadata.year !== null && (!Number.isInteger(metadata.year) || metadata.year < 1900 || metadata.year > 2200)) {
    throw new Error("The exam year is invalid.");
  }
  return metadata;
}

// First half of the production large-file path. The PDF bytes go directly
// from the admin's browser to R2, avoiding the platform's request-body limit.
export async function prepareDirectResourceUploadAction(formData: FormData) {
  await requireAdmin();
  const metadata = parseDirectUploadMetadata(formData);
  await requireCanonicalSubject(metadata.subjectId);
  const existing = await prisma.resource.findFirst({ where: { fileHash: metadata.fileHash } });
  if (existing) return { status: "duplicate" as const, resourceId: existing.id };

  const safeName = metadata.fileName.replace(/[^\w.\-]+/g, "_");
  const subdir = metadata.type === "PYQ" ? "pyqs" : "notes";
  const key = `uploads/${subdir}/${metadata.subjectId}/${crypto.randomUUID()}-${safeName}`;
  const target = await createDirectUploadTarget(key);
  if (!target) return { status: "fallback" as const };
  return { status: "ready" as const, key, ...target };
}

// Second half of the direct path. Re-checks the object and duplicate hash
// before creating the Resource row, so the file library never points at an
// upload that did not actually reach storage.
export async function finalizeDirectResourceUploadAction(formData: FormData) {
  await requireAdmin();
  const metadata = parseDirectUploadMetadata(formData);
  await requireCanonicalSubject(metadata.subjectId);
  const key = String(formData.get("key") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();
  const expectedPrefix = `uploads/${metadata.type === "PYQ" ? "pyqs" : "notes"}/${metadata.subjectId}/`;
  if (!key.startsWith(expectedPrefix)) {
    throw new Error("The upload target is invalid.");
  }
  const expectedFileUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : "";
  if (!fileUrl || fileUrl !== expectedFileUrl) throw new Error("The uploaded file URL is invalid.");

  const storedSize = await storedObjectSize(key);
  if (storedSize === null || storedSize <= 0) throw new Error("The PDF did not reach storage.");

  const existing = await prisma.resource.findFirst({ where: { fileHash: metadata.fileHash } });
  if (existing) {
    await deleteByUrl(fileUrl);
    return { status: "duplicate" as const, resourceId: existing.id };
  }
  if (metadata.batchId) {
    await prisma.uploadBatch.upsert({
      where: { id: metadata.batchId },
      create: { id: metadata.batchId },
      update: {},
    });
  }
  const resource = await prisma.resource.create({
    data: {
      subjectId: metadata.subjectId,
      type: metadata.type,
      title: metadata.title,
      year: metadata.year,
      academicYear: metadata.academicYear,
      fileUrl,
      fileName: metadata.fileName,
      fileSize: storedSize,
      fileHash: metadata.fileHash,
      batchId: metadata.batchId,
    },
  });
  revalidatePath(`/admin/subjects/${metadata.subjectId}`);
  revalidatePath(`/subjects/${metadata.subjectId}`);
  revalidatePath("/admin/resources");
  revalidatePath("/admin/batches");
  return { status: "created" as const, resourceId: resource.id };
}

// Thin wrapper for plain <form action={...}> bindings, which require a
// void-returning action (uploadResourceAction itself returns a status object
// for programmatic callers like Bulk Upload and the Restore tool).
export async function uploadResourceFormAction(formData: FormData) {
  await uploadResourceAction(formData);
}

// ---------- Official-library catalog coverage ----------

export type CatalogPaperUploadResult = {
  ok: boolean;
  status: "created" | "duplicate" | "error";
  message: string;
};

export async function uploadCatalogPaperAction(
  formData: FormData,
): Promise<CatalogPaperUploadResult> {
  await requireAdmin();

  const course = String(formData.get("course") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const yearRange = String(formData.get("yearRange") ?? "").trim();
  const semesterGroup = String(formData.get("semesterGroup") ?? "").trim();
  const semesterRaw = String(formData.get("semester") ?? "").trim();
  const semester = semesterRaw ? Number(semesterRaw) : null;
  const file = formData.get("file");

  if (!isCatalogCourseSubject(course, subject)) {
    return { ok: false, status: "error", message: "That course and subject are not in the catalog." };
  }
  if (!getCatalogYearRanges().includes(yearRange)) {
    return { ok: false, status: "error", message: "Choose a valid source year/session." };
  }
  if (!getSemesterGroupsForYear(yearRange).includes(semesterGroup)) {
    return { ok: false, status: "error", message: "Choose a valid semester group for that session." };
  }
  if (semester !== null && (!Number.isInteger(semester) || semester < 1 || semester > 7)) {
    return { ok: false, status: "error", message: "Semester must be between 1 and 7." };
  }
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, status: "error", message: "Choose a PDF to upload." };
  }
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { ok: false, status: "error", message: "Only PDF files can be added to the archive." };
  }
  if (file.size > 25 * 1024 * 1024) {
    return { ok: false, status: "error", message: "The PDF is larger than the 25 MB upload limit." };
  }

  const fileHash = await hashFile(file);
  const duplicate = await prisma.catalogPaperUpload.findUnique({ where: { fileHash } });
  if (duplicate) {
    return {
      ok: true,
      status: "duplicate",
      message: "This exact PDF is already in the catalog.",
    };
  }

  const stored = await saveUploadedFile(file, "pyqs");
  try {
    await prisma.catalogPaperUpload.create({
      data: {
        course,
        subject,
        yearRange,
        semesterGroup,
        semester,
        fileUrl: stored.fileUrl,
        fileName: stored.fileName,
        fileSize: stored.fileSize,
        fileHash,
        note: "Admin upload",
      },
    });
  } catch (error) {
    await deleteByUrl(stored.fileUrl);
    throw error;
  }

  revalidatePath("/pyq-notes");
  revalidatePath("/admin/course-coverage");
  revalidatePath(`/admin/course-coverage/${slugify(course)}`);
  return {
    ok: true,
    status: "created",
    message: "Paper uploaded and added to the Full Archive.",
  };
}

// ---------- Term papers (one combined file for a whole Program+Semester) ----------

type DirectTermPaperMetadata = {
  termId: string;
  year: number | null;
  academicYear: string | null;
  batchId: string | null;
  fileName: string;
  fileSize: number;
  fileHash: string;
};

function parseDirectTermPaperMetadata(formData: FormData): DirectTermPaperMetadata {
  const yearRaw = String(formData.get("year") ?? "").trim();
  const metadata = {
    termId: String(formData.get("termId") ?? "").trim(),
    year: yearRaw ? Number(yearRaw) : null,
    academicYear: String(formData.get("academicYear") ?? "").trim() || null,
    batchId: String(formData.get("batchId") ?? "").trim() || null,
    fileName: String(formData.get("fileName") ?? "paper.pdf").trim(),
    fileSize: Number(formData.get("fileSize") ?? 0),
    fileHash: String(formData.get("fileHash") ?? "").trim(),
  };
  if (!metadata.termId) throw new Error("A program and semester are required.");
  if (!metadata.fileHash || !/^[a-f0-9]{64}$/i.test(metadata.fileHash)) {
    throw new Error("The PDF hash is invalid.");
  }
  if (!Number.isFinite(metadata.fileSize) || metadata.fileSize <= 0) {
    throw new Error("The PDF size is invalid.");
  }
  if (metadata.year !== null && (!Number.isInteger(metadata.year) || metadata.year < 1900 || metadata.year > 2200)) {
    throw new Error("The exam year is invalid.");
  }
  return metadata;
}

// First half of the direct-to-storage path, mirroring
// prepareDirectResourceUploadAction — these combined papers bundle every
// subject together so they tend to be large files.
export async function prepareTermPaperUploadAction(formData: FormData) {
  await requireAdmin();
  const metadata = parseDirectTermPaperMetadata(formData);
  const existing = await prisma.termPaper.findFirst({ where: { fileHash: metadata.fileHash } });
  if (existing) return { status: "duplicate" as const, termPaperId: existing.id };

  const safeName = metadata.fileName.replace(/[^\w.\-]+/g, "_");
  const key = `uploads/term-papers/${crypto.randomUUID()}-${safeName}`;
  const target = await createDirectUploadTarget(key);
  if (!target) return { status: "fallback" as const };
  return { status: "ready" as const, key, ...target };
}

// Second half of the direct path — creates the TermPaper row once the file
// has actually reached storage.
export async function finalizeTermPaperUploadAction(formData: FormData) {
  await requireAdmin();
  const metadata = parseDirectTermPaperMetadata(formData);
  const key = String(formData.get("key") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();
  if (!key.startsWith("uploads/term-papers/")) throw new Error("The upload target is invalid.");
  const expectedFileUrl = process.env.R2_PUBLIC_URL
    ? `${process.env.R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`
    : "";
  if (!fileUrl || fileUrl !== expectedFileUrl) throw new Error("The uploaded file URL is invalid.");

  const storedSize = await storedObjectSize(key);
  if (storedSize === null || storedSize <= 0) throw new Error("The PDF did not reach storage.");

  const existing = await prisma.termPaper.findFirst({ where: { fileHash: metadata.fileHash } });
  if (existing) {
    await deleteByUrl(fileUrl);
    return { status: "duplicate" as const, termPaperId: existing.id };
  }
  if (metadata.batchId) {
    await prisma.uploadBatch.upsert({ where: { id: metadata.batchId }, create: { id: metadata.batchId }, update: {} });
  }
  const term = await prisma.term.findUnique({ where: { id: metadata.termId }, select: { programId: true } });
  if (!term) throw new Error("That program/semester no longer exists.");

  const termPaper = await prisma.termPaper.create({
    data: {
      termId: metadata.termId,
      year: metadata.year,
      academicYear: metadata.academicYear,
      fileUrl,
      fileName: metadata.fileName,
      fileSize: storedSize,
      fileHash: metadata.fileHash,
      batchId: metadata.batchId,
    },
  });
  revalidatePath(`/admin/programs/${term.programId}`);
  revalidatePath(`/terms/${metadata.termId}`);
  return { status: "created" as const, termPaperId: termPaper.id };
}

// Small-file fallback for term papers, mirroring uploadResourceAction — only
// used when the R2 CORS/direct-upload path isn't available.
export async function uploadTermPaperAction(formData: FormData) {
  await requireAdmin();
  const termId = String(formData.get("termId") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const academicYear = String(formData.get("academicYear") ?? "").trim() || null;
  const file = formData.get("file") as File | null;
  const batchId = String(formData.get("batchId") ?? "").trim() || null;

  if (!termId) throw new Error("A program and semester are required.");
  if (!file || file.size === 0) throw new Error("A file is required.");

  const fileHash = await hashFile(file);
  const existing = await prisma.termPaper.findFirst({ where: { fileHash } });
  if (existing) return { status: "duplicate" as const, termPaperId: existing.id };

  const { fileUrl, fileName, fileSize } = await saveUploadedFile(file, "term-papers");
  if (batchId) {
    await prisma.uploadBatch.upsert({ where: { id: batchId }, create: { id: batchId }, update: {} });
  }
  const term = await prisma.term.findUnique({ where: { id: termId }, select: { programId: true } });
  if (!term) throw new Error("That program/semester no longer exists.");

  const termPaper = await prisma.termPaper.create({
    data: { termId, year, academicYear, fileUrl, fileName, fileSize, fileHash, batchId },
  });
  revalidatePath(`/admin/programs/${term.programId}`);
  revalidatePath(`/terms/${termId}`);
  return { status: "created" as const, termPaperId: termPaper.id };
}

// Removes a combined term paper — the underlying file is deleted from
// storage too, since (unlike a Resource) nothing else can reference it.
export async function deleteTermPaperAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const termPaper = await prisma.termPaper.findUnique({ where: { id }, include: { term: true } });
  if (!termPaper) return;
  await prisma.termPaper.delete({ where: { id } });
  await deleteByUrl(termPaper.fileUrl);
  revalidatePath(`/admin/programs/${termPaper.term.programId}`);
  revalidatePath(`/terms/${termPaper.termId}`);
}

// Keeps a copy of a PDF that couldn't be uploaded (no subject match, or a
// real upload error) so it isn't silently lost — visible for the admin to
// fix and retry from /admin/failed-uploads.
export async function saveFailedUploadAction(formData: FormData) {
  await requireAdmin();
  const type = String(formData.get("type") ?? "NOTES") as "NOTES" | "PYQ";
  const title = String(formData.get("title") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const reason = String(formData.get("reason") ?? "Unknown error").trim();
  const file = formData.get("file") as File | null;

  if (!file || file.size === 0) {
    await prisma.failedUpload.create({
      data: { fileName: title || "unknown.pdf", title: title || "Untitled", type, year, reason },
    });
    return { ok: true as const };
  }

  const fileHash = await hashFile(file);
  const { fileUrl, fileName, fileSize } = await saveUploadedFile(file, "failed");
  await prisma.failedUpload.create({
    data: { fileName, title: title || fileName, type, year, reason, fileUrl, fileSize, fileHash },
  });
  revalidatePath("/admin/failed-uploads");
  return { ok: true as const };
}

// Uploads a Failed Uploads entry now that the admin has fixed it up (picked
// a real subject), reusing the file already saved on disk — no re-upload
// needed. Removes the entry from the failed list on success.
export async function deployFailedUploadAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const subjectId = String(formData.get("subjectId"));
  const title = String(formData.get("title") ?? "").trim();
  const type = String(formData.get("type") ?? "NOTES") as "NOTES" | "PYQ";
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;

  const failed = await prisma.failedUpload.findUnique({ where: { id } });
  if (!failed) throw new Error("That entry no longer exists.");
  if (!failed.fileUrl || !failed.fileSize) {
    throw new Error("No file was saved for this entry — it can't be deployed, only dismissed.");
  }
  if (!subjectId) throw new Error("Pick a subject first.");

  if (failed.fileHash) {
    const existing = await prisma.resource.findFirst({ where: { fileHash: failed.fileHash } });
    if (existing) {
      await prisma.failedUpload.delete({ where: { id } });
      revalidatePath("/admin/failed-uploads");
      return { status: "duplicate" as const };
    }
  }

  await prisma.resource.create({
    data: {
      subjectId,
      type,
      title: title || failed.title,
      year,
      fileUrl: failed.fileUrl,
      fileName: failed.fileName,
      fileSize: failed.fileSize,
      fileHash: failed.fileHash,
    },
  });
  await prisma.failedUpload.delete({ where: { id } });

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/admin/failed-uploads");
  return { status: "deployed" as const };
}

export async function deleteFailedUploadAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const failed = await prisma.failedUpload.findUnique({ where: { id } });
  await deleteByUrl(failed?.fileUrl);
  await prisma.failedUpload.delete({ where: { id } });
  revalidatePath("/admin/failed-uploads");
}

export type CsvDeployRowResult = {
  title: string;
  status:
    | "deployed"
    | "duplicate"
    | "no-failed-upload-match"
    | "no-program-match"
    | "no-term-match"
    | "no-subject"
    | "no-title"
    | "error";
  message?: string;
};

// Bulk-deploys Failed Uploads from a CSV the admin filled in offline (title
// -> which course/semester/subject it actually belongs to). Expected
// columns (case-insensitive, any order): title, program (or course), term
// (or semester), subject, type (PYQ/NOTES, default PYQ), year (optional).
// Any subject named in the sheet that doesn't exist yet under the matched
// term is created automatically. Every row is reported back individually —
// nothing is silently dropped, so a partially-wrong sheet can just be
// trimmed to its failed rows and re-dropped.
export async function deployFailedUploadsFromCsvAction(formData: FormData): Promise<{ results: CsvDeployRowResult[] }> {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("A CSV file is required.");

  const { parseCsv } = await import("@/lib/csv");
  const text = await file.text();
  const rows = parseCsv(text);

  if (rows.length === 0) {
    throw new Error(
      "Could not read any rows from that file — check it's a real CSV (comma, semicolon, or tab-separated) with a header row."
    );
  }

  const programs = await prisma.program.findMany({
    include: { terms: { include: { subjects: { select: { id: true, name: true } } } } },
  });
  const pendingFailedUploads = await prisma.failedUpload.findMany();

  const results: CsvDeployRowResult[] = [];

  for (const row of rows) {
    const title = (row.title || row.filename || row.paper || row.name || "").trim();
    if (!title) {
      const columnsSeen = Object.keys(row).filter((k) => k).join(", ") || "(none detected)";
      results.push({
        title: "(blank)",
        status: "no-title",
        message: `No title/filename/paper/name column found — columns seen: ${columnsSeen}`,
      });
      continue;
    }

    const failedIdx = pendingFailedUploads.findIndex(
      (f) => f.title.trim().toLowerCase() === title.toLowerCase()
    );
    const failed =
      failedIdx >= 0
        ? pendingFailedUploads[failedIdx]
        : pendingFailedUploads.find((f) => normalizeLoose(f.title) === normalizeLoose(title));
    if (!failed) {
      results.push({ title, status: "no-failed-upload-match" });
      continue;
    }
    if (!failed.fileUrl || !failed.fileSize) {
      results.push({ title, status: "error", message: "No file was saved for this entry." });
      continue;
    }

    const programVal = (row.program || row.course || "").trim();
    const program = findProgramMatch(programs, programVal);
    if (!program) {
      results.push({ title, status: "no-program-match", message: `No course matched "${programVal}"` });
      continue;
    }

    const termVal = (row.term || row.semester || row.sem || "").trim();
    const term = findTermMatch(program.terms, termVal);
    if (!term) {
      results.push({
        title,
        status: "no-term-match",
        message: `No semester matched "${termVal}" in ${program.name}`,
      });
      continue;
    }

    const subjectVal = (row.subject || "").trim();
    if (!subjectVal) {
      results.push({ title, status: "no-subject", message: "No subject name given" });
      continue;
    }

    let subject = term.subjects.find((s) => s.name.trim().toLowerCase() === subjectVal.toLowerCase());
    if (!subject) {
      const slug = await uniqueSlug(subjectVal, async (s) => {
        const found = await prisma.subject.findUnique({ where: { termId_slug: { termId: term.id, slug: s } } });
        return !!found;
      });
      const created = await prisma.subject.create({ data: { termId: term.id, name: subjectVal, slug } });
      subject = { id: created.id, name: created.name };
      term.subjects.push(subject);
    }

    const typeVal = (row.type || "PYQ").trim().toUpperCase() === "NOTES" ? "NOTES" : "PYQ";
    const yearRaw = (row.year || "").trim();
    const year = yearRaw ? Number(yearRaw) : null;

    if (failed.fileHash) {
      const existing = await prisma.resource.findFirst({ where: { fileHash: failed.fileHash } });
      if (existing) {
        await prisma.failedUpload.delete({ where: { id: failed.id } });
        pendingFailedUploads.splice(pendingFailedUploads.indexOf(failed), 1);
        results.push({ title, status: "duplicate" });
        continue;
      }
    }

    await prisma.resource.create({
      data: {
        subjectId: subject.id,
        type: typeVal,
        title: failed.title,
        year,
        fileUrl: failed.fileUrl,
        fileName: failed.fileName,
        fileSize: failed.fileSize,
        fileHash: failed.fileHash,
      },
    });
    await prisma.failedUpload.delete({ where: { id: failed.id } });
    pendingFailedUploads.splice(pendingFailedUploads.indexOf(failed), 1);

    const memoryKey = normalizeMemoryKey(failed.title);
    if (memoryKey) {
      await prisma.subjectMatchMemory.upsert({
        where: { key: memoryKey },
        create: { key: memoryKey, subjectId: subject.id },
        update: { subjectId: subject.id },
      });
    }

    results.push({ title, status: "deployed" });
  }

  revalidatePath("/admin/failed-uploads");
  revalidatePath("/admin/programs");
  revalidatePath("/admin/coverage");

  return { results };
}

export type BulkUploadRowSummary = {
  id: string;
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
};

export type BulkUploadValidateResult = {
  batchId: string;
  sourceFileName: string;
  rows: BulkUploadRowSummary[];
  summary: Partial<Record<BulkUploadRowStatus, number>>;
};

export type BulkUploadStartResult = {
  batchId: string;
  // [fileHash, fileName][] — plain pairs, not a Map, so this survives the
  // client/server serialization boundary; the client turns it back into a
  // Map before handing it to classifyBulkUploadRow client-side... no,
  // actually classification happens server-side too (see
  // classifyAndPersistRowsAction) — this just gets handed back on each
  // chunk call so the dedupe check only ever costs one query for the whole
  // sheet, not one per chunk.
  existingHashes: [string, string][];
};

// Fresh Upload step 1a: one query for the whole sheet — creates the
// UploadBatch and, given every row's file URL (extracted client-side via
// extractFileUrlRaw, which is pure and safe to run in the browser), does
// the one dedupe lookup that used to happen per row. Parsing the sheet
// itself also now happens client-side (parseSpreadsheetRows has no
// server-only deps) so rows can be sent up in chunks next.
export async function startBulkUploadBatchAction(formData: FormData): Promise<BulkUploadStartResult> {
  await requireAdmin();
  const sourceFileName = String(formData.get("sourceFileName") ?? "").trim() || null;
  const fileUrls = formData.getAll("fileUrls").map(String);

  const { bulkRowFileHash } = await import("@/lib/bulk-upload");
  const candidateHashes = [...new Set(fileUrls.filter(Boolean).map(bulkRowFileHash))];
  const existingRows =
    candidateHashes.length > 0
      ? await prisma.catalogPaperUpload.findMany({
          where: { fileHash: { in: candidateHashes } },
          select: { fileHash: true, fileName: true },
        })
      : [];

  const batch = await prisma.uploadBatch.create({ data: { sourceFileName } });

  return { batchId: batch.id, existingHashes: existingRows.map((r) => [r.fileHash, r.fileName]) };
}

// Fresh Upload step 1b: classifies and persists one chunk of rows (client
// calls this repeatedly — see fresh-upload-panel.tsx — both to drive a
// progress bar and, more importantly at real scale, so a 3,000-row sheet
// is many small transactions instead of one giant one that risks the
// function's time limit or the pooler's statement/transaction limits.
export async function classifyAndPersistRowsAction(formData: FormData): Promise<{ rows: BulkUploadRowSummary[] }> {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) throw new Error("A batch id is required.");
  const startRowNumber = Number(formData.get("startRowNumber") ?? 1);
  const rowsRaw = JSON.parse(String(formData.get("rows") ?? "[]")) as Record<string, string>[];
  const existingHashesRaw = JSON.parse(String(formData.get("existingHashes") ?? "[]")) as [string, string][];

  const { classifyBulkUploadRow } = await import("@/lib/bulk-upload");
  const existingHashes = new Map(existingHashesRaw);
  const classified = rowsRaw.map((row, i) => classifyBulkUploadRow(startRowNumber + i, row, existingHashes));

  const created = await prisma.$transaction(
    classified.map((row) =>
      prisma.bulkUploadRow.create({
        data: {
          batchId,
          rowNumber: row.rowNumber,
          status: row.status,
          message: row.message,
          courseRaw: row.courseRaw,
          subjectRaw: row.subjectRaw,
          yearRangeRaw: row.yearRangeRaw,
          semesterGroupRaw: row.semesterGroupRaw,
          semesterRaw: row.semesterRaw,
          fileUrlRaw: row.fileUrlRaw,
          fileNameRaw: row.fileNameRaw,
          noteRaw: row.noteRaw,
        },
      })
    )
  );

  return {
    rows: created.map((r) => ({
      id: r.id,
      rowNumber: r.rowNumber,
      status: r.status,
      message: r.message,
      courseRaw: r.courseRaw,
      subjectRaw: r.subjectRaw,
      yearRangeRaw: r.yearRangeRaw,
      semesterGroupRaw: r.semesterGroupRaw,
      semesterRaw: r.semesterRaw,
      fileUrlRaw: r.fileUrlRaw,
      fileNameRaw: r.fileNameRaw,
      noteRaw: r.noteRaw,
    })),
  };
}

// Fresh Upload step 1c: called once after every chunk has persisted, purely
// to refresh the admin UI's cached data — no rows to process here.
export async function finalizeBulkUploadValidationAction(): Promise<void> {
  await requireAdmin();
  revalidatePath("/admin/bulk-upload");
}

export type BulkUploadRowResult = {
  id: string;
  status: BulkUploadRowStatus;
  message: string | null;
};

// Fresh Upload step 2: imports one chunk of the rows the admin approved
// (client calls this repeatedly, one chunk at a time, to drive a progress
// bar — see fresh-upload-panel.tsx). Only touches the specific rowIds
// passed in, so it's safe to call in batches; skipBulkUploadRowsAction
// handles the "left unchecked" rows separately once every chunk is done.
// Re-checks for a fileHash collision (another batch, or an earlier row in
// this same run, could have imported the same file already).
export async function commitBulkUploadRowsAction(formData: FormData): Promise<{ results: BulkUploadRowResult[] }> {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) throw new Error("A batch id is required.");
  const rowIds = formData.getAll("rowIds").map(String);
  if (rowIds.length === 0) return { results: [] };

  const { resolveRowForImport } = await import("@/lib/bulk-upload");

  const rows = await prisma.bulkUploadRow.findMany({
    where: { id: { in: rowIds }, batchId, status: "VALID" },
  });

  const results: BulkUploadRowResult[] = [];

  // Each row is wrapped in its own try/catch so one bad row (unexpected
  // data, a transient DB hiccup) can't take out the rest of the chunk —
  // previously a single throw here propagated all the way to the client
  // and aborted every chunk still queued behind it, silently leaving
  // thousands of otherwise-valid rows stuck at VALID. See the 2701-row
  // "ramanujan-pyq-catalog.csv" batch that stopped dead at 50 imported.
  for (const row of rows) {
    try {
      if (!row.fileUrlRaw || !row.yearRangeRaw || !row.semesterGroupRaw) {
        const message = "Missing required field at import time";
        await prisma.bulkUploadRow.update({ where: { id: row.id }, data: { status: "INVALID", message } });
        results.push({ id: row.id, status: "INVALID", message });
        continue;
      }

      const resolved = resolveRowForImport({
        fileUrlRaw: row.fileUrlRaw,
        fileNameRaw: row.fileNameRaw,
        semesterRaw: row.semesterRaw,
      });

      const existing = await prisma.catalogPaperUpload.findUnique({ where: { fileHash: resolved.fileHash } });
      if (existing) {
        const message = `Already in the catalog as "${existing.fileName}"`;
        await prisma.bulkUploadRow.update({ where: { id: row.id }, data: { status: "DUPLICATE", message } });
        results.push({ id: row.id, status: "DUPLICATE", message });
        continue;
      }

      const catalogPaperUpload = await prisma.catalogPaperUpload.create({
        data: {
          course: row.courseRaw,
          subject: row.subjectRaw,
          yearRange: row.yearRangeRaw,
          semesterGroup: row.semesterGroupRaw,
          semester: resolved.semester,
          fileUrl: row.fileUrlRaw,
          fileName: resolved.fileName,
          fileSize: 0,
          fileHash: resolved.fileHash,
          note: row.noteRaw,
        },
      });
      await prisma.bulkUploadRow.update({
        where: { id: row.id },
        data: { status: "IMPORTED", catalogPaperUploadId: catalogPaperUpload.id },
      });
      results.push({ id: row.id, status: "IMPORTED", message: null });
    } catch (err) {
      // Most likely cause here: two rows in this sheet resolve to the same
      // fileHash but landed in the same chunk, so the dedupe check above
      // ran before either had committed — a real race, not user error.
      // Whatever the cause, record it on the row and move on rather than
      // losing the rest of the chunk.
      const message = err instanceof Error ? err.message : "Unexpected error importing this row";
      try {
        await prisma.bulkUploadRow.update({ where: { id: row.id }, data: { status: "INVALID", message } });
      } catch {
        // Row update itself failed (e.g. the same connection issue that
        // caused the original error) — still report it to the caller below.
      }
      results.push({ id: row.id, status: "INVALID", message });
    }
  }

  return { results };
}

// Fresh Upload step 3: once every approved chunk has been committed, marks
// whatever's left VALID-but-unchecked as SKIPPED — it stays visible in
// Uploaded Data, just never became a CatalogPaperUpload. Split out from the
// commit loop so unapproved rows don't need their own progress-bar chunk.
export async function skipBulkUploadRowsAction(formData: FormData): Promise<{ skipped: number }> {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) throw new Error("A batch id is required.");
  const rowIds = formData.getAll("rowIds").map(String);

  const count =
    rowIds.length === 0
      ? 0
      : (
          await prisma.bulkUploadRow.updateMany({
            where: { id: { in: rowIds }, batchId, status: "VALID" },
            data: { status: "SKIPPED" },
          })
        ).count;

  revalidatePath("/pyq-notes");
  revalidatePath("/admin/course-coverage");
  revalidatePath("/admin/bulk-upload");

  return { skipped: count };
}

// Powers "Resume import" on an existing batch's detail page — a batch can
// end up with rows stuck at VALID (never approved/committed in Fresh
// Upload, or a commit that got interrupted before the chunk-retry
// resilience existed) with no way to finish importing them since Fresh
// Upload's review state is client-only and doesn't survive a reload.
export async function getBatchValidRowIdsAction(formData: FormData): Promise<{ rowIds: string[] }> {
  await requireAdmin();
  const batchId = String(formData.get("batchId") ?? "").trim();
  if (!batchId) throw new Error("A batch id is required.");
  const rows = await prisma.bulkUploadRow.findMany({
    where: { batchId, status: "VALID" },
    select: { id: true },
  });
  return { rowIds: rows.map((r) => r.id) };
}

export async function deleteResourceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const subjectId = String(formData.get("subjectId"));
  await prisma.resource.delete({ where: { id } });
  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/admin/resources");
  revalidatePath("/admin/batches");
}

// Fixes a mistake spotted after the fact (wrong year/type/subject/title) —
// used from the batch-upload review page, without needing to re-upload the file.
export async function updateResourceAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const subjectId = String(formData.get("subjectId"));
  const type = String(formData.get("type") ?? "NOTES") as "NOTES" | "PYQ";
  const title = String(formData.get("title") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
  const academicYear = String(formData.get("academicYear") ?? "").trim() || null;

  if (!title) throw new Error("Title is required.");
  if (!subjectId) throw new Error("A subject is required.");

  const previous = await prisma.resource.findUnique({ where: { id }, select: { subjectId: true } });
  await prisma.resource.update({ where: { id }, data: { subjectId, type, title, year, academicYear } });

  if (previous) revalidatePath(`/admin/subjects/${previous.subjectId}`);
  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/admin/batches");
  revalidatePath("/admin/resources");
}

// ---------- Full Archive customization (rename / re-semester / merge / highlight) ----------

// Renames, re-assigns the semester, and/or highlights a (course, subject)
// pairing in the public Full Archive. subjectKey is canonicalSubjectKey()
// of the subject's ORIGINAL label, computed by the admin page from the raw
// archive data — it stays stable even after the display name changes.
export async function upsertCatalogSubjectOverrideAction(formData: FormData) {
  await requireAdmin();
  const course = String(formData.get("course") ?? "").trim();
  const subjectKey = String(formData.get("subjectKey") ?? "").trim();
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const semesterRaw = String(formData.get("semester") ?? "").trim();
  const semesterOverride = semesterRaw ? Number(semesterRaw) : null;
  const highlight = formData.get("highlight") === "on";
  const courseSlug = String(formData.get("courseSlug") ?? "").trim();

  if (!course || !subjectKey) throw new Error("A course and subject are required.");

  await prisma.catalogSubjectOverride.upsert({
    where: { course_subjectKey: { course, subjectKey } },
    create: { course, subjectKey, displayName, semesterOverride, highlight },
    update: { displayName, semesterOverride, highlight },
  });

  revalidatePath("/pyq-notes");
  revalidatePath("/papers");
  revalidatePath("/notes");
  revalidatePath("/admin/subject-notes");
  if (courseSlug) revalidatePath(`/admin/archive-customize/${courseSlug}`);
}

// Makes `subjectKey` display identically to the merge target (same name +
// semester) so they collapse into one group in the archive browser, which
// groups purely by canonicalSubjectKey() of the (possibly overridden) text.
// The <select> in archive-customize/[courseSlug]/page.tsx packs
// "targetSubjectKey<SEP>targetDisplayName<SEP>targetSemester" into a single
// "mergeTarget" field (see MERGE_SEP there) since that plain form has no
// client JS to split a select's value into separate fields before submit.
export async function mergeCatalogSubjectsAction(formData: FormData) {
  await requireAdmin();
  const course = String(formData.get("course") ?? "").trim();
  const subjectKeys = formData.getAll("subjectKey").map((v) => String(v).trim()).filter(Boolean);
  const courseSlug = String(formData.get("courseSlug") ?? "").trim();

  const mergeTarget = String(formData.get("mergeTarget") ?? "");
  const [, targetDisplayName = "", targetSemesterRaw = ""] = mergeTarget.split(MERGE_TARGET_SEP);

  if (!course || subjectKeys.length === 0 || !targetDisplayName.trim()) {
    throw new Error("A merge target is required.");
  }

  const semesterOverride = targetSemesterRaw ? Number(targetSemesterRaw) : null;
  await Promise.all(
    subjectKeys.map((subjectKey) =>
      prisma.catalogSubjectOverride.upsert({
        where: { course_subjectKey: { course, subjectKey } },
        create: { course, subjectKey, displayName: targetDisplayName, semesterOverride },
        update: { displayName: targetDisplayName, semesterOverride },
      }),
    ),
  );

  revalidatePath("/pyq-notes");
  revalidatePath("/papers");
  revalidatePath("/notes");
  revalidatePath("/admin/subject-notes");
  if (courseSlug) revalidatePath(`/admin/archive-customize/${courseSlug}`);
}

// Manual variant of mergeCatalogSubjectsAction — takes an admin-typed
// heading and an arbitrary set of subjectKeys (not limited to AI-suggested
// candidate groups), so any subjects/files can be grouped under one shared
// display name regardless of how different their raw text is.
export async function manualMergeCatalogSubjectsAction(
  course: string,
  courseSlug: string,
  subjectKeys: string[],
  targetDisplayName: string,
  targetSemester: number | null,
) {
  await requireAdmin();
  const keys = subjectKeys.map((k) => k.trim()).filter(Boolean);
  const name = targetDisplayName.trim();
  if (!course || keys.length < 2 || !name) {
    throw new Error("Pick at least two subjects and a heading to merge them under.");
  }

  await Promise.all(
    keys.map((subjectKey) =>
      prisma.catalogSubjectOverride.upsert({
        where: { course_subjectKey: { course, subjectKey } },
        create: { course, subjectKey, displayName: name, semesterOverride: targetSemester },
        update: { displayName: name, semesterOverride: targetSemester },
      }),
    ),
  );

  revalidatePath("/pyq-notes");
  revalidatePath("/papers");
  revalidatePath("/notes");
  revalidatePath("/admin/subject-notes");
  if (courseSlug) revalidatePath(`/admin/archive-customize/${courseSlug}`);
}

// Backs the Subject Normalization Centre's Manual Merge tab, which
// searches Full Archive subjects (not Program/Subject-linked ones) across
// every course at once.
export async function searchArchiveSubjectsForManualMergeAction(filters: { course?: string; query?: string }) {
  await requireAdmin();
  const { searchArchiveSubjectsForManualMerge } = await import("@/lib/archive-customize-data");
  return searchArchiveSubjectsForManualMerge(filters);
}

// Reverts a subject back to its original scraped/imported name and semester.
export async function resetCatalogSubjectOverrideAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const courseSlug = String(formData.get("courseSlug") ?? "").trim();
  if (!id) throw new Error("Nothing to reset.");

  await prisma.catalogSubjectOverride.delete({ where: { id } }).catch(() => {});

  revalidatePath("/pyq-notes");
  revalidatePath("/papers");
  revalidatePath("/notes");
  revalidatePath("/admin/subject-notes");
  if (courseSlug) revalidatePath(`/admin/archive-customize/${courseSlug}`);
}

// ---------- Questions (PYQ bank / repeated questions) ----------

export async function createQuestionAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId"));
  const questionText = String(formData.get("questionText") ?? "").trim();
  const answerText = String(formData.get("answerText") ?? "").trim();
  const marksRaw = String(formData.get("marks") ?? "").trim();
  const marks = marksRaw ? Number(marksRaw) : null;
  const years = String(formData.get("years") ?? "").trim() || null;
  const isRepeated = formData.get("isRepeated") === "on";
  const repeatCountRaw = String(formData.get("repeatCount") ?? "1").trim();
  const repeatCount = Number(repeatCountRaw) || 1;

  if (!questionText || !answerText) {
    throw new Error("Question and answer are required.");
  }

  await prisma.question.create({
    data: { subjectId, questionText, answerText, marks, years, isRepeated, repeatCount },
  });

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
}

export async function deleteQuestionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const subjectId = String(formData.get("subjectId"));
  await prisma.question.delete({ where: { id } });
  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
}

// Full edit of a single question, including OCR/topic/difficulty metadata
// and its rich contentBlocks (src/lib/content/content-block-schema.ts) —
// used by the /admin/questions/[id] editor (Phase H). Previously questions
// could only be created or deleted, never edited in place.
export async function updateQuestionAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const subjectId = String(formData.get("subjectId"));
  const questionText = String(formData.get("questionText") ?? "").trim();
  const answerText = String(formData.get("answerText") ?? "").trim();
  const marksRaw = String(formData.get("marks") ?? "").trim();
  const marks = marksRaw ? Number(marksRaw) : null;
  const years = String(formData.get("years") ?? "").trim() || null;
  const isRepeated = formData.get("isRepeated") === "on";
  const repeatCountRaw = String(formData.get("repeatCount") ?? "1").trim();
  const repeatCount = Number(repeatCountRaw) || 1;
  const resourceId = String(formData.get("resourceId") ?? "").trim() || null;
  const questionNumber = String(formData.get("questionNumber") ?? "").trim() || null;
  const section = String(formData.get("section") ?? "").trim() || null;
  const rawOcrText = String(formData.get("rawOcrText") ?? "").trim() || null;
  const topicsRaw = String(formData.get("topics") ?? "").trim();
  const topics = topicsRaw ? topicsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];
  const difficultyRaw = String(formData.get("difficulty") ?? "");
  const difficulty =
    difficultyRaw === "EASY" || difficultyRaw === "MEDIUM" || difficultyRaw === "HARD" ? difficultyRaw : null;

  if (!questionText || !answerText) {
    throw new Error("Question and answer are required.");
  }

  let rawBlocks: unknown;
  try {
    rawBlocks = JSON.parse(String(formData.get("contentBlocksJson") ?? "[]"));
  } catch {
    throw new Error("Content blocks were malformed.");
  }
  const parsedBlocks = StudyContentBlockListSchema.safeParse(rawBlocks);
  if (!parsedBlocks.success) {
    throw new Error("One or more content blocks are invalid.");
  }

  await prisma.question.update({
    where: { id },
    data: {
      questionText,
      answerText,
      marks,
      years,
      isRepeated,
      repeatCount,
      resourceId,
      questionNumber,
      section,
      rawOcrText,
      topics,
      difficulty,
      contentBlocks: parsedBlocks.data,
    },
  });

  if (resourceId) revalidatePath(`/pyq-notes/${resourceId}`);

  revalidatePath(`/admin/questions/${id}`);
  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
}

// ---------- Content Blocks library ----------
// Reusable StudyContentBlocks (src/lib/content/content-block-schema.ts) an
// admin builds once and inserts by reference into any question's
// contentBlocks — a separate surface from per-question editing above.

export async function createContentBlockAction(formData: FormData) {
  await requireAdmin();
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("A label is required.");
  const category = String(formData.get("category") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "markdown") as StudyContentBlockType;

  const created = await prisma.contentBlock.create({
    data: { label, category, block: createDefaultBlock(type), tags: [] },
  });

  revalidatePath("/admin/content-blocks");
  redirect(`/admin/content-blocks/${created.id}`);
}

export async function updateContentBlockAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) throw new Error("A label is required.");
  const description = String(formData.get("description") ?? "").trim() || null;
  const category = String(formData.get("category") ?? "").trim() || null;
  const tagsRaw = String(formData.get("tags") ?? "").trim();
  const tags = tagsRaw ? tagsRaw.split(",").map((t) => t.trim()).filter(Boolean) : [];

  let rawBlock: unknown;
  try {
    rawBlock = JSON.parse(String(formData.get("blockJson") ?? "{}"));
  } catch {
    throw new Error("The block content was malformed.");
  }
  const parsed = StudyContentBlockSchema.safeParse(rawBlock);
  if (!parsed.success) {
    throw new Error("The block content is invalid.");
  }

  await prisma.contentBlock.update({
    where: { id },
    data: { label, description, category, tags, block: parsed.data },
  });

  revalidatePath("/admin/content-blocks");
  revalidatePath(`/admin/content-blocks/${id}`);
}

export async function deleteContentBlockAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  await prisma.contentBlock.delete({ where: { id } });
  revalidatePath("/admin/content-blocks");
  redirect("/admin/content-blocks");
}

// ---------- Site settings ----------

export async function uploadHeroImageAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("An image is required.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Please upload a PNG, JPEG, or WebP image.");
  }

  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  await deleteByUrl(current?.heroImageUrl);

  const ext = heroImageExtensionsFor(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  const heroImageUrl = await putBytes(`images/hero-du.${ext}`, bytes, { allowOverwrite: true });

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", heroImageUrl },
    update: { heroImageUrl },
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export async function removeHeroImageAction() {
  await requireAdmin();
  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  await deleteByUrl(current?.heroImageUrl);
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", heroImageUrl: null },
    update: { heroImageUrl: null },
  });
  revalidatePath("/");
  revalidatePath("/admin/settings");
}

export async function uploadCurrencyIconAction(formData: FormData) {
  await requireAdmin();
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("An image is required.");
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Please upload a PNG, JPEG, or WebP image.");
  }

  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  await deleteByUrl(current?.currencyIconUrl);

  const ext = currencyIconExtensionFor(file.type);
  const bytes = Buffer.from(await file.arrayBuffer());
  const currencyIconUrl = await putBytes(`images/currency-icon.${ext}`, bytes, { allowOverwrite: true });

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", currencyIconUrl },
    update: { currencyIconUrl },
  });

  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/settings");
}

export async function removeCurrencyIconAction() {
  await requireAdmin();
  const current = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  await deleteByUrl(current?.currencyIconUrl);
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", currencyIconUrl: null },
    update: { currencyIconUrl: null },
  });
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");
  revalidatePath("/admin/settings");
}

export async function updateSiteSettingsAction(formData: FormData) {
  await requireAdmin();
  const heroEyebrow = String(formData.get("heroEyebrow") ?? "").trim();
  const heroHeadline = String(formData.get("heroHeadline") ?? "").trim();
  const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim();
  const heroSearchCaption = String(formData.get("heroSearchCaption") ?? "").trim();

  const data = {
    heroEyebrow: heroEyebrow || null,
    heroHeadline: heroHeadline || null,
    heroSubtitle: heroSubtitle || null,
    heroSearchCaption: heroSearchCaption || null,
  };
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", ...data },
    update: data,
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}

// ---------- Note Designer: themes ----------
// A NoteTheme's draftJson/publishedJson holds a ThemeValues object for
// GLOBAL scope (must be complete — it's every note's ultimate fallback) or
// a Partial<ThemeValues> for SUBJECT/NOTE scope, where a top-level group key
// (colors/typography/layout/components/visuals) is present only when the
// admin has actually turned on "override this group" for that scope — see
// resolveEffectiveTheme/mergeThemeLayers in src/lib/note-theme.ts, which
// only overrides a group a layer actually sets.

function revalidateNoteTheme(theme: { scope: string; subjectId: string | null }) {
  revalidatePath("/admin/note-themes");
  if (theme.scope === "GLOBAL") {
    // A GLOBAL publish potentially changes every note's rendering.
    revalidatePath("/subjects", "layout");
  } else if (theme.subjectId) {
    revalidatePath(`/subjects/${theme.subjectId}`);
  }
}

export async function createNoteThemeAction(formData: FormData) {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const scope = String(formData.get("scope") ?? "GLOBAL") as "GLOBAL" | "SUBJECT" | "NOTE";
  const subjectId = String(formData.get("subjectId") ?? "").trim() || null;
  const subjectNotesId = String(formData.get("subjectNotesId") ?? "").trim() || null;
  const basedOnId = String(formData.get("basedOnId") ?? "").trim() || null;

  if (!name) throw new Error("A theme name is required.");
  if (scope === "SUBJECT" && !subjectId) throw new Error("A subject is required for a subject-scoped theme.");
  if (scope === "NOTE" && !subjectNotesId) throw new Error("A note is required for a note-scoped theme.");

  let draftJson: object = scope === "GLOBAL" ? DEFAULT_THEME : {};
  if (basedOnId) {
    const base = await prisma.noteTheme.findUnique({ where: { id: basedOnId } });
    if (base) draftJson = (base.publishedJson ?? base.draftJson) as object;
  }

  const theme = await prisma.noteTheme.create({
    data: {
      name,
      scope,
      subjectId: scope === "SUBJECT" ? subjectId : null,
      subjectNotesId: scope === "NOTE" ? subjectNotesId : null,
      draftJson,
      isPreset: false,
    },
  });

  revalidatePath("/admin/note-themes");
  redirect(`/admin/note-themes/${theme.id}`);
}

export async function duplicateNoteThemeAction(formData: FormData) {
  await requireAdmin();
  const sourceId = String(formData.get("themeId") ?? "");
  const source = await prisma.noteTheme.findUniqueOrThrow({ where: { id: sourceId } });

  const copy = await prisma.noteTheme.create({
    data: {
      name: `${source.name} (copy)`,
      scope: source.scope,
      subjectId: source.subjectId,
      // A NOTE-scoped theme is @unique on subjectNotesId — a duplicate of
      // one can't also target that same note, so it's created unscoped
      // (GLOBAL-shaped draft the admin can then re-home) rather than
      // silently failing the unique constraint.
      subjectNotesId: null,
      draftJson: (source.publishedJson ?? source.draftJson) as object,
      isPreset: false,
    },
  });

  revalidatePath("/admin/note-themes");
  redirect(`/admin/note-themes/${copy.id}`);
}

export async function deleteNoteThemeAction(formData: FormData) {
  await requireAdmin();
  const themeId = String(formData.get("themeId") ?? "");
  const theme = await prisma.noteTheme.findUniqueOrThrow({ where: { id: themeId } });
  if (theme.isPreset) throw new Error("Built-in presets can't be deleted — duplicate one instead.");
  if (theme.isDefaultGlobal) throw new Error("Can't delete the current global default theme.");

  await prisma.noteTheme.delete({ where: { id: themeId } });
  revalidatePath("/admin/note-themes");
}

/** Saves the in-progress editor state — does not go live until published. */
export async function saveNoteThemeDraftAction(formData: FormData) {
  await requireAdmin();
  const themeId = String(formData.get("themeId") ?? "");
  const draftRaw = String(formData.get("draftJson") ?? "{}");

  const theme = await prisma.noteTheme.findUniqueOrThrow({ where: { id: themeId } });
  let parsedDraft: unknown;
  try {
    parsedDraft = JSON.parse(draftRaw);
  } catch {
    throw new Error("The theme data isn't valid JSON.");
  }

  const schema = theme.scope === "GLOBAL" ? ThemeValuesSchema : ThemeValuesSchema.partial();
  const result = schema.safeParse(parsedDraft);
  if (!result.success) throw new Error("That theme data doesn't match the expected shape.");

  await prisma.noteTheme.update({ where: { id: themeId }, data: { draftJson: result.data } });
  revalidatePath(`/admin/note-themes/${themeId}`);
}

/** Publishes the current draft — snapshots the outgoing published value into
 * NoteThemeVersion first, so publishing can never lose the prior version. */
export async function publishNoteThemeAction(formData: FormData) {
  await requireAdmin();
  const themeId = String(formData.get("themeId") ?? "");
  const label = String(formData.get("label") ?? "").trim() || null;

  const theme = await prisma.noteTheme.findUniqueOrThrow({ where: { id: themeId } });

  await prisma.$transaction(async (tx) => {
    if (theme.publishedJson != null) {
      await tx.noteThemeVersion.create({
        data: { themeId, snapshotJson: theme.publishedJson, label },
      });
    }
    await tx.noteTheme.update({ where: { id: themeId }, data: { publishedJson: theme.draftJson as Prisma.InputJsonValue } });
  });

  revalidateNoteTheme(theme);
  revalidatePath(`/admin/note-themes/${themeId}`);
}

/** Restores a prior published version — copies its snapshot back into both
 * draftJson (so the editor reopens showing the restored state) and
 * publishedJson (so it's live immediately, matching "restore" rather than
 * "load into the editor for review first"). */
export async function restoreNoteThemeVersionAction(formData: FormData) {
  await requireAdmin();
  const versionId = String(formData.get("versionId") ?? "");
  const version = await prisma.noteThemeVersion.findUniqueOrThrow({ where: { id: versionId } });

  const theme = await prisma.noteTheme.update({
    where: { id: version.themeId },
    data: { draftJson: version.snapshotJson as object, publishedJson: version.snapshotJson as object },
  });

  revalidateNoteTheme(theme);
  revalidatePath(`/admin/note-themes/${theme.id}`);
}

/** Exactly one GLOBAL theme should be the site default at a time — enforced
 * here (not the schema) since Postgres has no native "at most one true"
 * constraint without a partial unique index, which Prisma doesn't model. */
export async function setDefaultGlobalThemeAction(formData: FormData) {
  await requireAdmin();
  const themeId = String(formData.get("themeId") ?? "");
  const theme = await prisma.noteTheme.findUniqueOrThrow({ where: { id: themeId } });
  if (theme.scope !== "GLOBAL") throw new Error("Only a global theme can be the site default.");
  if (theme.publishedJson == null) throw new Error("Publish this theme at least once before making it the default.");

  await prisma.$transaction([
    prisma.noteTheme.updateMany({ where: { scope: "GLOBAL", isDefaultGlobal: true }, data: { isDefaultGlobal: false } }),
    prisma.noteTheme.update({ where: { id: themeId }, data: { isDefaultGlobal: true } }),
  ]);

  revalidatePath("/admin/note-themes");
  revalidatePath("/subjects", "layout");
}

/** Import: validates pasted/uploaded theme JSON and stores it as the draft
 * (does not publish) — export is a client-side "download draftJson/
 * publishedJson as a file" with no server action needed. */
export async function importNoteThemeJsonAction(formData: FormData) {
  await requireAdmin();
  const themeId = String(formData.get("themeId") ?? "");
  const jsonText = String(formData.get("json") ?? "");

  const theme = await prisma.noteTheme.findUniqueOrThrow({ where: { id: themeId } });
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }

  const schema = theme.scope === "GLOBAL" ? ThemeValuesSchema : ThemeValuesSchema.partial();
  const result = schema.safeParse(parsed);
  if (!result.success) throw new Error("That theme JSON doesn't match the expected shape.");

  await prisma.noteTheme.update({ where: { id: themeId }, data: { draftJson: result.data } });
  revalidatePath(`/admin/note-themes/${themeId}`);
}

// ---------- Note Designer: AI generation ----------

/**
 * Uploads a source file (or, for images, receives text already OCR'd
 * client-side — see src/lib/note-ocr-client.ts) and runs it through the
 * chunked AI pipeline (src/lib/ai.ts's generateStructuredNote), saving the
 * result as this subject's structured note. Never partially saves: if
 * generation fails at any step, nothing about the existing note changes.
 */
export async function generateStructuredNoteAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const chapter = String(formData.get("chapter") ?? "").trim();
  const file = formData.get("file") as File | null;
  const clientExtractedText = String(formData.get("extractedText") ?? "").trim();

  if (!subjectId) throw new Error("A subject is required.");
  if (!file || file.size === 0) throw new Error("A source file is required.");

  const subject = await prisma.subject.findUniqueOrThrow({ where: { id: subjectId } });
  const kind = detectSourceKind(file.name, file.type);
  if (kind === "unsupported") {
    throw new Error("Unsupported file type — use PDF, DOCX, PPTX, Markdown/text, or JPG/PNG.");
  }

  const { fileUrl, fileName, bytes } = await saveSourceFile(file, "note-sources");

  let sourceText: string;
  if (kind === "image") {
    if (!clientExtractedText) throw new Error("No OCR text was provided for this image.");
    sourceText = clientExtractedText;
  } else {
    sourceText = await extractSourceTextFromUpload(fileUrl, bytes, kind);
  }

  if (sourceText.length < 80) {
    throw new Error("Couldn't extract enough text from this file to generate a note.");
  }

  const result = await generateStructuredNote(sourceText, { subjectName: subject.name, chapter: chapter || undefined });
  if (!result.ok) throw new Error(result.error);

  await prisma.subjectNotes.upsert({
    where: { subjectId },
    create: {
      subjectId,
      content: result.data.summary,
      format: "STRUCTURED",
      structuredJson: result.data,
      sourceFileUrl: fileUrl,
      sourceFileName: fileName,
    },
    update: {
      format: "STRUCTURED",
      structuredJson: result.data,
      sourceFileUrl: fileUrl,
      sourceFileName: fileName,
    },
  });

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  return { ok: true as const, title: result.data.metadata.title };
}

// Hand-editing counterpart to generateStructuredNoteAction above — lets an
// admin fix up the AI's output (typos, a wrong fact, a section that needs
// rewording) without burning another AI call and losing every other field
// to regeneration. Only content changes; `visual` isn't editable here (no
// form for it yet) so it's passed through unchanged from the existing row.
export async function updateStructuredNoteAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId") ?? "").trim();
  const noteJson = String(formData.get("noteJson") ?? "");
  if (!subjectId) throw new Error("A subject is required.");

  const existing = await prisma.subjectNotes.findUnique({ where: { subjectId } });
  if (!existing || existing.format !== "STRUCTURED" || !existing.structuredJson) {
    throw new Error("This subject doesn't have a structured note to edit.");
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(noteJson);
  } catch {
    throw new Error("Malformed note content.");
  }

  const existingVisual = (existing.structuredJson as { visual?: unknown }).visual;
  const parsed = StructuredNoteSchema.safeParse({ ...(candidate as object), visual: existingVisual });
  if (!parsed.success) {
    throw new Error(`Invalid note content: ${parsed.error.issues[0]?.message ?? "validation failed"}`);
  }

  await prisma.subjectNotes.update({
    where: { subjectId },
    data: { structuredJson: parsed.data, content: parsed.data.summary },
  });

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  return { ok: true as const };
}

// ---------- Feedback ----------
export async function submitFeedbackAction(formData: FormData) {
  const message = String(formData.get("message") ?? "").trim();
  if (!message) throw new Error("Feedback can't be empty.");
  if (message.length > 5000) throw new Error("That's a bit long — keep it under 5000 characters.");

  const screenshot = formData.get("screenshot") as File | null;
  let screenshotUrl: string | null = null;
  let screenshotName: string | null = null;
  if (screenshot && screenshot.size > 0) {
    if (!screenshot.type.startsWith("image/")) throw new Error("Screenshot must be an image file.");
    const saved = await saveUploadedFile(screenshot, "feedback");
    screenshotUrl = saved.fileUrl;
    screenshotName = saved.fileName;
  }

  await prisma.feedback.create({ data: { message, screenshotUrl, screenshotName } });
  revalidatePath("/admin/feedback");
  return { ok: true as const };
}

export async function markFeedbackReadAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const read = formData.get("read") === "true";
  await prisma.feedback.update({ where: { id }, data: { read } });
  revalidatePath("/admin/feedback");
}

export async function deleteFeedbackAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  const feedback = await prisma.feedback.findUnique({ where: { id } });
  if (feedback?.screenshotUrl) await deleteByUrl(feedback.screenshotUrl);
  await prisma.feedback.delete({ where: { id } });
  revalidatePath("/admin/feedback");
}

// One-click import of the full DU Question Paper Bank scrape into its own
// standalone table (DuQuestionBankPaper) — deliberately not CatalogPaperUpload,
// so it never mixes into the Full Archive (/pyq-notes). Reads the source
// JSON (src/data/du-question-bank-full-mapped.json, ~15k rows, 18MB) via
// fs.readFileSync at runtime rather than a static/dynamic `import`: this
// file (actions.ts) is imported by nearly every route, and a JS import of
// an 18MB JSON gets inlined into every function that pulls it in — on
// Netlify specifically, the whole app collapses into one function, so that
// single function blew past the 250MB deploy limit. Same fix as
// canonical-subject-notes-data.ts (see its comment) — the matching
// outputFileTracingIncludes entry in next.config.ts is what makes the file
// actually present on disk for readFileSync to find at runtime.
// Then bulk-inserts everything with createMany in large chunks: no per-row
// existence/duplicate lookups, by design — every row from the scrape lands
// here as-is, including duplicates, since the point is to hold the complete
// raw output. This makes it fast (a handful of round trips instead of
// thousands) at the cost of not deduping; re-running this action will
// insert the whole file again as new rows.
export async function importDuQuestionBankPapersAction(): Promise<{
  ok: true;
  imported: number;
} | { ok: false; message: string }> {
  await requireAdmin();

  const { readFileSync } = await import("node:fs");
  const path = await import("node:path");
  const filePath = path.join(process.cwd(), "src/data/du-question-bank-full-mapped.json");
  const rows: Prisma.DuQuestionBankPaperCreateManyInput[] = JSON.parse(readFileSync(filePath, "utf-8"));
  const CHUNK_SIZE = 2000;
  let imported = 0;

  try {
    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const result = await prisma.duQuestionBankPaper.createMany({ data: chunk });
      imported += result.count;
    }
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Unexpected error during import" };
  }

  revalidatePath("/admin/du-question-bank");
  revalidatePath("/pyp");
  return { ok: true, imported };
}

export async function getDuQuestionBankImportStatusAction(): Promise<{ count: number }> {
  await requireAdmin();
  const count = await prisma.duQuestionBankPaper.count();
  return { count };
}
