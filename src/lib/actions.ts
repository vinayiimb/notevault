"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { saveUploadedFile, hashFile, putBytes, deleteByUrl } from "@/lib/storage";
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

  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.subject.findUnique({
      where: { termId_slug: { termId, slug: s } },
    });
    return !!found;
  });

  await prisma.subject.create({ data: { termId, name, description, slug } });
  revalidatePath(`/admin/programs/${programId}`);
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

  const slug = await uniqueSlug(name, async (s) => {
    const found = await prisma.subject.findUnique({
      where: { termId_slug: { termId, slug: s } },
    });
    return !!found;
  });

  const subject = await prisma.subject.create({ data: { termId, name, slug } });
  const term = await prisma.term.findUnique({ where: { id: termId } });
  if (term) revalidatePath(`/admin/programs/${term.programId}`);

  return { id: subject.id, name: subject.name, termId: subject.termId };
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

export async function deleteSubjectAction(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const programId = String(formData.get("programId"));
  await prisma.subject.delete({ where: { id } });
  revalidatePath(`/admin/programs/${programId}`);
}

// ---------- Resources (Notes / PYQs) ----------

export async function uploadResourceAction(formData: FormData) {
  await requireAdmin();
  const subjectId = String(formData.get("subjectId"));
  const type = String(formData.get("type") ?? "NOTES") as "NOTES" | "PYQ";
  const title = String(formData.get("title") ?? "").trim();
  const yearRaw = String(formData.get("year") ?? "").trim();
  const year = yearRaw ? Number(yearRaw) : null;
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
    data: { subjectId, type, title, year, fileUrl, fileName, fileSize, fileHash, batchId },
  });

  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);

  return { status: "created" as const, resourceId: resource.id };
}

// Thin wrapper for plain <form action={...}> bindings, which require a
// void-returning action (uploadResourceAction itself returns a status object
// for programmatic callers like Bulk Upload and the Restore tool).
export async function uploadResourceFormAction(formData: FormData) {
  await uploadResourceAction(formData);
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
  status: "deployed" | "duplicate" | "no-failed-upload-match" | "no-program-match" | "no-term-match" | "no-subject" | "error";
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

  const programs = await prisma.program.findMany({
    include: { terms: { include: { subjects: { select: { id: true, name: true } } } } },
  });
  const pendingFailedUploads = await prisma.failedUpload.findMany();

  const results: CsvDeployRowResult[] = [];

  for (const row of rows) {
    const title = (row.title || row.filename || row.paper || row.name || "").trim();
    if (!title) continue;

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

  if (!title) throw new Error("Title is required.");
  if (!subjectId) throw new Error("A subject is required.");

  const previous = await prisma.resource.findUnique({ where: { id }, select: { subjectId: true } });
  await prisma.resource.update({ where: { id }, data: { subjectId, type, title, year } });

  if (previous) revalidatePath(`/admin/subjects/${previous.subjectId}`);
  revalidatePath(`/admin/subjects/${subjectId}`);
  revalidatePath(`/subjects/${subjectId}`);
  revalidatePath("/admin/batches");
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
