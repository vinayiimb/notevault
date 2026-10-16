"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { extractPaperQuestions } from "@/lib/ai";
import { findDuplicates, findRepeat, isBundle, parseYears } from "@/lib/pyq-analyser";
import { slugify } from "@/lib/utils";

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Unauthorized");
}

// Production hides the message of anything a server action throws (the admin
// only sees "React error #441"), so the save path returns its errors instead.
type Failure = { ok: false; error: string };
function readableError(e: unknown): string {
  if (e instanceof z.ZodError)
    return e.issues
      .slice(0, 4)
      .map((i) => {
        const [, n, field] = i.path;
        return typeof n === "number" ? `Question ${n + 1}${field ? ` (${String(field)})` : ""}: ${i.message}` : `${i.path.join(".") || "Input"}: ${i.message}`;
      })
      .join(" · ");
  if (e instanceof Error) {
    if (e.message === "Unauthorized") return "Your admin login has expired. Sign in again in a new tab, then click Save again.";
    return e.message.split("\n").map((l) => l.trim()).filter(Boolean).at(-1) ?? e.message;
  }
  return String(e);
}

const CatalogSubjectSchema = z.object({
  courseSlug: z.string().regex(/^[a-z0-9-]{1,80}$/),
  course: z.string().trim().min(1).max(120),
  semester: z.number().int().min(1).max(8),
  subject: z.string().trim().min(1).max(200),
  upc: z.string().trim().max(20).nullable(),
  paperType: z.string().trim().max(20).nullable(),
});

/**
 * The admin picks from the /papers catalog (every course and semester), but
 * questions hang off a DB Subject. Reuse the Subject with the same UPC, else
 * create Program → Term → Subject the first time a paper is saved for it.
 */
async function findCatalogSubject(c: z.infer<typeof CatalogSubjectSchema>) {
  if (c.upc) {
    const byUpc = await prisma.subject.findFirst({ where: { upc: c.upc, mergedIntoId: null }, select: { id: true } });
    if (byUpc) return byUpc.id;
  }
  const bySlug = await prisma.subject.findFirst({
    where: { slug: slugify(c.subject) || "subject", term: { order: c.semester, program: { slug: c.courseSlug } } },
    select: { id: true },
  });
  return bySlug?.id ?? null;
}

export async function ensureCatalogSubjectAction(input: z.infer<typeof CatalogSubjectSchema>): Promise<{ ok: true; id: string } | Failure> {
  try {
    return { ok: true, id: await ensureCatalogSubject(input) };
  } catch (e) {
    console.error("[pyq-analyser] ensureCatalogSubject failed", e);
    return { ok: false, error: readableError(e) };
  }
}

async function ensureCatalogSubject(input: z.infer<typeof CatalogSubjectSchema>) {
  await requireAdmin();
  const c = CatalogSubjectSchema.parse(input);
  const found = await findCatalogSubject(c);
  if (found) return found;
  const program = await prisma.program.upsert({
    where: { slug: c.courseSlug },
    create: { slug: c.courseSlug, name: c.course, level: "COLLEGE" },
    update: {},
  });
  const term = await prisma.term.upsert({
    where: { programId_order: { programId: program.id, order: c.semester } },
    create: { programId: program.id, order: c.semester, name: `Semester ${c.semester}` },
    update: {},
  });
  const slug = slugify(c.subject) || "subject";
  const subject = await prisma.subject.upsert({
    where: { termId_slug: { termId: term.id, slug } },
    create: { termId: term.id, name: c.subject, slug, upc: c.upc, paperType: c.paperType },
    update: {},
    select: { id: true },
  });
  return subject.id;
}

export async function extractQuestionsChunkAction(subjectId: string, text: string) {
  await requireAdmin();
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
  if (!subject) return { ok: false as const, error: "Subject not found." };
  const known = await prisma.question.findMany({ where: { subjectId }, select: { topics: true } });
  const topics = [...new Set(known.flatMap((q) => q.topics))];
  return extractPaperQuestions(text.slice(0, 7000), subject.name, topics);
}

const SaveSchema = z.object({
  subjectId: z.string().min(1),
  // Fallback for questions with no year tag of their own.
  year: z.string().regex(/^((19|20)\d{2})?$/),
  questions: z
    .array(
      z.object({
        questionNumber: z.string(),
        section: z.string(),
        questionText: z.string().trim().min(5),
        // HTML bundles carry their own CSS/JS, so allow up to ~1.5 MB each.
        answerText: z.string().max(1_500_000).default(""),
        marks: z.number().int().min(0).max(100),
        topics: z.array(z.string().trim().min(1)).max(6),
        difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(),
        // The question's own year tag(s), e.g. ["2022", "2024"]; empty = use `year`.
        years: z.array(z.string().regex(/^(19|20)\d{2}$/)).max(20).default([]),
      }),
    )
    .min(1)
    .max(300),
});

/**
 * Saves questions of one or more papers (each tagged with its own year). A
 * question that matches one already stored for the subject (re-asked in
 * another year) is merged: the year is added and the repeat count goes up,
 * which is what drives "most repeated" on the analyser.
 */
export async function savePaperQuestionsAction(input: z.infer<typeof SaveSchema>): Promise<{ ok: true; created: number; merged: number } | Failure> {
  try {
    return { ok: true, ...(await savePaperQuestions(input)) };
  } catch (e) {
    console.error("[pyq-analyser] save failed", e);
    return { ok: false, error: readableError(e) };
  }
}

async function savePaperQuestions(input: z.infer<typeof SaveSchema>) {
  await requireAdmin();
  const { subjectId, year, questions } = SaveSchema.parse(input);
  const missing = questions.filter((q) => !q.years.length).length;
  if (missing && !year) throw new Error(`${missing} question(s) have no year tag: enter the paper year, or add a year to each.`);
  const existing: { id: string; questionText: string; answerText: string; years: string | null; topics: string[]; fresh?: boolean }[] =
    await prisma.question.findMany({
      where: { subjectId },
      select: { id: true, questionText: true, answerText: true, years: true, topics: true },
    });

  let created = 0;
  let merged = 0;
  // The same question twice in one upload, same year, is saved once.
  const seen = new Set<string>();
  for (const q of questions) {
    const qYears = q.years.length ? parseYears(q.years.join(",")) : [year];
    const sig = `${q.questionNumber}|${q.questionText}|${qYears}`.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(sig)) continue;
    seen.add(sig);
    let match = findRepeat(q.questionText, existing);
    // A match saved earlier in this same upload for the same year is the same
    // paper (e.g. an "OR" alternative), so it stays its own question; one from
    // another year's paper in the upload is a repeat and merges.
    if (match?.fresh && parseYears(match.years).some((y) => qYears.includes(y))) match = null;
    if (match) {
      const years = parseYears(`${match.years ?? ""},${qYears}`);
      const topics = [...new Set([...match.topics, ...q.topics])].slice(0, 6);
      await prisma.question.update({
        where: { id: match.id },
        data: {
          years: years.join(","),
          repeatCount: Math.max(years.length, 1),
          isRepeated: years.length > 1,
          topics,
          ...(!match.answerText && q.answerText ? { answerText: q.answerText } : {}),
        },
      });
      match.years = years.join(",");
      match.topics = topics;
      if (!match.answerText) match.answerText = q.answerText;
      merged++;
    } else {
      const row = await prisma.question.create({
        data: {
          subjectId,
          questionText: q.questionText,
          answerText: q.answerText,
          marks: q.marks || null,
          years: qYears.join(","),
          repeatCount: qYears.length,
          isRepeated: qYears.length > 1,
          questionNumber: q.questionNumber || null,
          section: q.section || null,
          topics: q.topics,
          difficulty: q.difficulty,
        },
        select: { id: true },
      });
      existing.push({ id: row.id, questionText: q.questionText, answerText: q.answerText, years: qYears.join(","), topics: q.topics, fresh: true });
      created++;
    }
  }

  revalidatePath("/papers/analyser");
  return { created, merged };
}

// ---------- Saved questions: list, edit, delete (Admin → PYQ Analyser) ----------

export async function savedQuestionsAction(input: z.infer<typeof CatalogSubjectSchema>) {
  await requireAdmin();
  const subjectId = await findCatalogSubject(CatalogSubjectSchema.parse(input));
  if (!subjectId) return { subjectId: null, questions: [] };
  const rows = await prisma.question.findMany({
    where: { subjectId },
    orderBy: { createdAt: "asc" },
    select: { id: true, questionNumber: true, section: true, questionText: true, answerText: true, marks: true, topics: true, difficulty: true, years: true, repeatCount: true, createdAt: true },
  });
  // Answers can be ~1.5 MB bundles: send only their size; the editor loads one on demand.
  const questions = rows.map(({ answerText, ...q }) => ({ ...q, answerLength: answerText.length, bundle: isBundle(answerText) }));
  const dupOf = findDuplicates(questions);
  return { subjectId, questions: questions.map((q) => ({ ...q, duplicateOf: dupOf.get(q.id) ?? null })) };
}

export async function questionAnswerAction(id: string) {
  await requireAdmin();
  const q = await prisma.question.findUnique({ where: { id }, select: { answerText: true } });
  return q?.answerText ?? "";
}

const UpdateSchema = z.object({
  id: z.string().min(1),
  questionNumber: z.string().trim().max(30),
  section: z.string().trim().max(60),
  questionText: z.string().trim().min(5),
  answerText: z.string().max(1_500_000),
  marks: z.number().int().min(0).max(100),
  topics: z.array(z.string().trim().min(1)).max(6),
  difficulty: z.enum(["EASY", "MEDIUM", "HARD"]).nullable(),
  years: z.string().max(200),
});

export async function updateSavedQuestionAction(input: z.infer<typeof UpdateSchema>) {
  await requireAdmin();
  const q = UpdateSchema.parse(input);
  const years = parseYears(q.years);
  await prisma.question.update({
    where: { id: q.id },
    data: {
      questionNumber: q.questionNumber || null,
      section: q.section || null,
      questionText: q.questionText,
      answerText: q.answerText,
      marks: q.marks || null,
      topics: q.topics,
      difficulty: q.difficulty,
      years: years.join(",") || null,
      repeatCount: Math.max(years.length, 1),
      isRepeated: years.length > 1,
    },
  });
  revalidatePath("/papers/analyser");
}

export async function deleteSavedQuestionsAction(ids: string[]) {
  await requireAdmin();
  const list = z.array(z.string().min(1)).min(1).max(500).parse(ids);
  const { count } = await prisma.question.deleteMany({ where: { id: { in: list } } });
  revalidatePath("/papers/analyser");
  return count;
}

/** Deletes every duplicate of the subject; the kept question gets their years. */
export async function removeDuplicatesAction(subjectId: string) {
  await requireAdmin();
  const rows = await prisma.question.findMany({
    where: { subjectId: z.string().min(1).parse(subjectId) },
    select: { id: true, questionNumber: true, questionText: true, answerText: true, years: true, createdAt: true },
  });
  const dupOf = findDuplicates(rows.map((r) => ({ ...r, answerLength: r.answerText.length })));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const yearsOf = new Map<string, string>();
  for (const [dup, keep] of dupOf) yearsOf.set(keep, `${yearsOf.get(keep) ?? byId.get(keep)?.years ?? ""},${byId.get(dup)?.years ?? ""}`);
  await prisma.$transaction([
    ...[...yearsOf].map(([id, raw]) => {
      const years = parseYears(raw);
      return prisma.question.update({ where: { id }, data: { years: years.join(",") || null, repeatCount: Math.max(years.length, 1), isRepeated: years.length > 1 } });
    }),
    prisma.question.deleteMany({ where: { id: { in: [...dupOf.keys()] } } }),
  ]);
  revalidatePath("/papers/analyser");
  return dupOf.size;
}
