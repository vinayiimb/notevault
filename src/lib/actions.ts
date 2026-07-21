"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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
import {
  createSessionCookie,
  destroySessionCookie,
  getSession,
  verifyPassword,
} from "@/lib/auth";

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

  const admin = await prisma.admin.findUnique({ where: { email } });
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSessionCookie({ adminId: admin.id, email: admin.email, name: admin.name });
  redirect("/admin");
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
  const { deriveSubjectNameFromFilename, matchDriveSubjectName } = await import("@/lib/subject-quality");

  let driveSubjects = await prisma.driveSubject.findMany({ where: { programId: link.programId } });

  const results: DriveSyncRowResult[] = [];

  for (const file of files) {
    const rawName = deriveSubjectNameFromFilename(file.name) || file.name.replace(/\.pdf$/i, "");
    const year = guessYear(file.name);

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

  await prisma.subject.create({ data: { termId, name, description, slug } });
  revalidatePath(`/admin/programs/${programId}`);
  revalidatePath("/admin/subject-issues");
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
    include: { terms: { include: { subjects: { select: { name: true, slug: true } } } } },
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

    const baseSlug = slugify(name) || "subject";
    if (term.subjects.some((s) => s.slug === baseSlug || s.name.trim().toLowerCase() === name.toLowerCase())) {
      results.push({ name, status: "duplicate", message: `Already exists in ${program.name} · ${term.name}` });
      continue;
    }

    const takenSlugs = new Set(term.subjects.map((s) => s.slug));
    const slug = await uniqueSlug(name, async (s) => takenSlugs.has(s));

    const code = (row.code || "").trim();
    const descRaw = (row.description || "").trim();
    const description = code ? (descRaw ? `Code: ${code} | ${descRaw}` : `Code: ${code}`) : descRaw || null;

    await prisma.subject.create({ data: { termId: term.id, name, slug, description } });
    term.subjects.push({ name, slug });
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
    ...(renameSlug ? [prisma.subject.update({ where: { id: targetId }, data: { name: mergedName, slug: renameSlug } })] : []),
    prisma.subject.delete({ where: { id: sourceId } }),
  ]);

  revalidatePath(`/admin/programs/${source.term.programId}`);
  revalidatePath("/admin/subject-issues");
  revalidatePath(`/admin/subjects/${targetId}`);
  revalidatePath(`/subjects/${targetId}`);
  redirect("/admin/subject-issues");
}

// ---------- Resources (Notes / PYQs) ----------

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
    type === "PYQ" ? "pyqs" : "notes"
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
  const existing = await prisma.resource.findFirst({ where: { fileHash: metadata.fileHash } });
  if (existing) return { status: "duplicate" as const, resourceId: existing.id };

  const safeName = metadata.fileName.replace(/[^\w.\-]+/g, "_");
  const subdir = metadata.type === "PYQ" ? "pyqs" : "notes";
  const key = `uploads/${subdir}/${crypto.randomUUID()}-${safeName}`;
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
  const key = String(formData.get("key") ?? "").trim();
  const fileUrl = String(formData.get("fileUrl") ?? "").trim();
  if (!key.startsWith("uploads/pyqs/") && !key.startsWith("uploads/notes/")) {
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

function normalizeLoose(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function findProgramMatch<T extends { name: string }>(programs: T[], value: string): T | null {
  const v = normalizeLoose(value);
  if (!v) return null;

  // DU elective-pool shorthand: GSEC/SEC/VAC/VEC/AEC all live under the
  // "Common Pool" programme; a bare "GE" means the separate GE Pool.
  if (/^(gsec|sec|vac|vec|aec)$/.test(v) || v.includes("sec") || v.includes("vac") || v.includes("vec") || v.includes("aec")) {
    const pool = programs.find((p) => normalizeLoose(p.name).includes("commonpool"));
    if (pool) return pool;
  }
  if (v === "ge" || v.includes("genericelective")) {
    const pool = programs.find((p) => normalizeLoose(p.name).includes("gepool"));
    if (pool) return pool;
  }

  const exact = programs.find((p) => normalizeLoose(p.name) === v);
  if (exact) return exact;
  return programs.find((p) => normalizeLoose(p.name).includes(v) || v.includes(normalizeLoose(p.name))) ?? null;
}

function findTermMatch<T extends { name: string }>(terms: T[], value: string): T | null {
  const v = normalizeLoose(value);
  if (!v) return null;

  if (v === "all" || v.includes("allsemester")) {
    return terms.find((t) => normalizeLoose(t.name).includes("allsemester")) ?? null;
  }
  const num = v.match(/\d+/)?.[0];
  if (num) {
    const found = terms.find((t) => normalizeLoose(t.name) === `semester${num}`);
    if (found) return found;
  }
  const exact = terms.find((t) => normalizeLoose(t.name) === v);
  if (exact) return exact;
  return terms.find((t) => normalizeLoose(t.name).includes(v) || v.includes(normalizeLoose(t.name))) ?? null;
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
  const heroHeadline = String(formData.get("heroHeadline") ?? "").trim();
  const heroSubtitle = String(formData.get("heroSubtitle") ?? "").trim();

  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton", heroHeadline: heroHeadline || null, heroSubtitle: heroSubtitle || null },
    update: { heroHeadline: heroHeadline || null, heroSubtitle: heroSubtitle || null },
  });

  revalidatePath("/");
  revalidatePath("/admin/settings");
}
