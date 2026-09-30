"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { invalidateArchiveCache } from "@/lib/pyq-catalog";

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Unauthorized");
}

function str(formData: FormData, name: string) {
  return String(formData.get(name) ?? "").trim();
}

function parseSemester(raw: string): number | null {
  const n = Number(raw);
  return raw && Number.isInteger(n) && n >= 1 && n <= 8 ? n : null;
}

function revalidateArchive(courseSlug: string) {
  // /papers applies these overrides client-side from /api/catalog-overrides,
  // so only the admin views need revalidating — plus the /pyq-notes archive,
  // which shares CatalogSubjectOverride.
  invalidateArchiveCache();
  revalidatePath("/admin/papers-archive");
  if (courseSlug) revalidatePath(`/admin/papers-archive/${courseSlug}`, "layout");
}

export async function updatePapersSubjectAction(formData: FormData) {
  await requireAdmin();
  const course = str(formData, "course");
  const courseSlug = str(formData, "courseSlug");
  const subjectKey = str(formData, "subjectKey");
  if (!course || !subjectKey) throw new Error("Missing subject.");

  const originalName = str(formData, "originalName");
  const displayNameRaw = str(formData, "displayName");
  const courseOverrideRaw = str(formData, "courseOverride");
  const data = {
    displayName: displayNameRaw && displayNameRaw !== originalName ? displayNameRaw : null,
    semesterOverride: parseSemester(str(formData, "semester")),
    courseOverride: courseOverrideRaw && courseOverrideRaw !== course ? courseOverrideRaw : null,
    hidden: formData.get("hidden") === "on",
  };

  const isNoop = !data.displayName && data.semesterOverride == null && !data.courseOverride && !data.hidden;
  if (isNoop) {
    await prisma.catalogSubjectOverride.deleteMany({ where: { course, subjectKey } });
  } else {
    await prisma.catalogSubjectOverride.upsert({
      where: { course_subjectKey: { course, subjectKey } },
      create: { course, subjectKey, ...data },
      update: data,
    });
  }
  revalidateArchive(courseSlug);
}

export async function resetPapersSubjectAction(formData: FormData) {
  await requireAdmin();
  const course = str(formData, "course");
  const subjectKey = str(formData, "subjectKey");
  await prisma.catalogSubjectOverride.deleteMany({ where: { course, subjectKey } });
  revalidateArchive(str(formData, "courseSlug"));
}

// Combine: every selected subject shows under one name (and semester).
// The papers stay where they are — they're just grouped together.
export async function mergePapersSubjectsAction(formData: FormData) {
  await requireAdmin();
  const course = str(formData, "course");
  const subjectKeys = formData.getAll("subjectKey").map(String).filter(Boolean);
  const targetName = str(formData, "targetName");
  const semesterOverride = parseSemester(str(formData, "semester"));
  if (!course || subjectKeys.length < 2) throw new Error("Pick at least two subjects to combine.");
  if (!targetName) throw new Error("Enter the combined subject name.");

  await prisma.$transaction(
    subjectKeys.map((subjectKey) =>
      prisma.catalogSubjectOverride.upsert({
        where: { course_subjectKey: { course, subjectKey } },
        create: { course, subjectKey, displayName: targetName, semesterOverride },
        update: { displayName: targetName, semesterOverride },
      }),
    ),
  );
  revalidateArchive(str(formData, "courseSlug"));
}

export async function updatePaperAction(formData: FormData) {
  await requireAdmin();
  const paperId = str(formData, "paperId");
  if (!paperId) throw new Error("Missing paper.");
  const originalUrl = str(formData, "originalUrl");
  const pdfUrlRaw = str(formData, "pdfUrl");

  let pdfUrl: string | null = null;
  if (pdfUrlRaw && pdfUrlRaw !== originalUrl) {
    let parsed: URL;
    try {
      parsed = new URL(pdfUrlRaw);
    } catch {
      throw new Error("That link isn't a valid URL.");
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("Links must start with http:// or https://");
    }
    pdfUrl = parsed.toString();
  }
  const hidden = formData.get("hidden") === "on";

  if (!pdfUrl && !hidden) {
    await prisma.catalogPaperOverride.deleteMany({ where: { paperId } });
  } else {
    await prisma.catalogPaperOverride.upsert({
      where: { paperId },
      create: { paperId, pdfUrl, hidden },
      update: { pdfUrl, hidden },
    });
  }
  revalidateArchive(str(formData, "courseSlug"));
}

export async function resetPaperAction(formData: FormData) {
  await requireAdmin();
  await prisma.catalogPaperOverride.deleteMany({ where: { paperId: str(formData, "paperId") } });
  revalidateArchive(str(formData, "courseSlug"));
}
