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

function parseUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

// The full set of fields a paper shows with, from the edit / add forms.
function paperFields(formData: FormData) {
  const course = str(formData, "course").slice(0, 200);
  const subject = str(formData, "subject").slice(0, 300);
  const semester = parseSemester(str(formData, "semester"));
  const upc = str(formData, "upc").replace(/\s/g, "");
  if (!course) finish(formData, "Programme can't be empty.", true);
  if (!subject) finish(formData, "Subject can't be empty.", true);
  if (upc && !/^\d{4,12}$/.test(upc)) finish(formData, "Paper code (UPC) should be 4–12 digits.", true);
  return {
    course,
    subject,
    semester: semester ? String(semester) : null,
    yearRange: str(formData, "yearRange").slice(0, 60) || null,
    upc: upc || null,
    paperType: str(formData, "paperType").slice(0, 20) || null,
    verified: str(formData, "dataset") !== "noncore",
    hidden: formData.get("hidden") === "on",
  };
}

// Edit every field of one paper. Saves a complete snapshot, so the paper can
// move to another subject, semester, programme or between /papers and
// /papers/noncore.
export async function savePaperAction(formData: FormData) {
  await requireAdmin();
  const paperId = str(formData, "paperId");
  if (!paperId) finish(formData, "Missing paper.", true);
  const fields = paperFields(formData);
  const added = formData.get("added") === "1";
  // Always stored: a paper moved to another programme is rebuilt from this
  // row alone on pages that don't load its original catalog file.
  const pdfUrl = parseUrl(str(formData, "pdfUrl") || str(formData, "originalUrl"));
  if (!pdfUrl) finish(formData, "That link isn't valid — it must start with http:// or https://", true);

  const data = { ...fields, pdfUrl };
  await prisma.catalogPaperOverride.upsert({
    where: { paperId },
    create: { paperId, added, ...data },
    update: data,
  });
  finish(formData, fields.hidden ? "Paper saved and hidden from students." : `Paper saved — now under “${fields.subject}”.`);
}

// Add a paper that isn't in the Drive catalog (any PDF link; Drive links
// get the inline viewer).
export async function addPaperAction(formData: FormData) {
  await requireAdmin();
  const fields = paperFields(formData);
  const pdfUrl = parseUrl(str(formData, "pdfUrl"));
  if (!pdfUrl) finish(formData, "Paste the paper's PDF or Google Drive link (http:// or https://).", true);
  await prisma.catalogPaperOverride.create({
    data: { paperId: `added-${crypto.randomUUID()}`, added: true, pdfUrl, ...fields },
  });
  finish(formData, `Paper added to “${fields.subject}” (${fields.verified ? "/papers" : "/papers/noncore"}).`);
}

export async function resetPaperAction(formData: FormData) {
  await requireAdmin();
  await prisma.catalogPaperOverride.deleteMany({ where: { paperId: str(formData, "paperId") } });
  finish(formData, formData.get("added") === "1" ? "Added paper deleted." : "Paper reset to original.");
}
