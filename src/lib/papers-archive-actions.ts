"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
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

// Where to send the admin back to after a save. Built from the slug (never a
// free-form URL) so it can't be turned into an open redirect.
function backTo(formData: FormData) {
  const courseSlug = str(formData, "courseSlug").replace(/[^\w-]/g, "");
  const groupKey = str(formData, "groupKey");
  let path = "/admin/papers-archive";
  if (courseSlug) path += `/${courseSlug}`;
  if (courseSlug && groupKey && formData.get("fromPapersPage")) path += `/${encodeURIComponent(groupKey)}`;
  return path;
}

// Every button shows a message on the page it came from, instead of silently
// reloading (or crashing to the error page on a bad input).
function finish(formData: FormData, message: string, isError = false): never {
  const path = backTo(formData);
  if (!isError) {
    // /papers applies these overrides client-side from /api/catalog-overrides,
    // so only the admin views need revalidating — plus the /pyq-notes archive,
    // which shares CatalogSubjectOverride.
    invalidateArchiveCache();
    revalidatePath("/admin/papers-archive", "layout");
  }
  redirect(`${path}?${isError ? "err" : "ok"}=${encodeURIComponent(message)}`);
}

// A row in the admin can stand for several source subjects that were
// combined; their keys and original names arrive as parallel lists.
function members(formData: FormData) {
  const keys = formData.getAll("subjectKey").map(String);
  const names = formData.getAll("originalName").map(String);
  return keys.map((subjectKey, i) => ({ subjectKey, originalName: names[i] ?? "" })).filter((m) => m.subjectKey);
}

export async function updatePapersSubjectAction(formData: FormData) {
  await requireAdmin();
  const course = str(formData, "course");
  const group = members(formData);
  if (!course || group.length === 0) finish(formData, "Missing subject.", true);

  const displayNameRaw = str(formData, "displayName") || str(formData, "currentName");
  const courseOverrideRaw = str(formData, "courseOverride");
  const semesterOverride = parseSemester(str(formData, "semester"));
  const courseOverride = courseOverrideRaw && courseOverrideRaw !== course ? courseOverrideRaw : null;
  const hidden = formData.get("hidden") === "on";
  const combined = group.length > 1;

  await prisma.$transaction(
    group.map(({ subjectKey, originalName }) => {
      // Combined subjects must all keep the shared name to stay together.
      const displayName = combined || displayNameRaw !== originalName ? displayNameRaw : null;
      const data = { displayName, semesterOverride, courseOverride, hidden };
      if (!displayName && semesterOverride == null && !courseOverride && !hidden) {
        return prisma.catalogSubjectOverride.deleteMany({ where: { course, subjectKey } });
      }
      return prisma.catalogSubjectOverride.upsert({
        where: { course_subjectKey: { course, subjectKey } },
        create: { course, subjectKey, ...data },
        update: data,
      });
    }),
  );

  const what = hidden ? "saved and hidden from students" : "saved";
  finish(formData, `“${displayNameRaw}” ${what}.`);
}

// Reset undoes every edit on the row — for a combined subject that also
// splits it back into its original subjects.
export async function resetPapersSubjectAction(formData: FormData) {
  await requireAdmin();
  const course = str(formData, "course");
  const keys = members(formData).map((m) => m.subjectKey);
  await prisma.catalogSubjectOverride.deleteMany({ where: { course, subjectKey: { in: keys } } });
  finish(formData, keys.length > 1 ? `Split back into ${keys.length} original subjects.` : "Subject reset to original.");
}

// Combine: every selected subject shows under one name (and semester).
// The papers stay where they are — they're just grouped together.
export async function mergePapersSubjectsAction(formData: FormData) {
  await requireAdmin();
  const course = str(formData, "course");
  // Each ticked row may itself be a combined group (keys joined by newlines).
  const subjectKeys = [
    ...new Set(
      formData
        .getAll("mergeKeys")
        .flatMap((v) => String(v).split("\n"))
        .map((k) => k.trim())
        .filter(Boolean),
    ),
  ];
  const targetName = str(formData, "targetName");
  const semesterOverride = parseSemester(str(formData, "semester"));
  if (!course || formData.getAll("mergeKeys").length < 2) {
    finish(formData, "Tick at least two subjects in the table to combine.", true);
  }
  if (!targetName) finish(formData, "Enter a name for the combined subject.", true);

  await prisma.$transaction(
    subjectKeys.map((subjectKey) =>
      prisma.catalogSubjectOverride.upsert({
        where: { course_subjectKey: { course, subjectKey } },
        create: { course, subjectKey, displayName: targetName, semesterOverride },
        // Keep an existing semester unless a new one was given.
        update: { displayName: targetName, ...(semesterOverride != null ? { semesterOverride } : {}) },
      }),
    ),
  );
  finish(formData, `Combined ${subjectKeys.length} subjects into “${targetName}”.`);
}

export async function updatePaperAction(formData: FormData) {
  await requireAdmin();
  const paperId = str(formData, "paperId");
  if (!paperId) finish(formData, "Missing paper.", true);
  const originalUrl = str(formData, "originalUrl");
  const pdfUrlRaw = str(formData, "pdfUrl");

  let pdfUrl: string | null = null;
  if (pdfUrlRaw && pdfUrlRaw !== originalUrl) {
    let parsed: URL | null = null;
    try {
      parsed = new URL(pdfUrlRaw);
    } catch {}
    if (!parsed || (parsed.protocol !== "https:" && parsed.protocol !== "http:")) {
      finish(formData, "That link isn't valid — it must start with http:// or https://", true);
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
  finish(formData, hidden ? "Paper saved and hidden from students." : "Paper saved.");
}

export async function resetPaperAction(formData: FormData) {
  await requireAdmin();
  await prisma.catalogPaperOverride.deleteMany({ where: { paperId: str(formData, "paperId") } });
  finish(formData, "Paper reset to original.");
}
