"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { extractPaperQuestions } from "@/lib/ai";
import { findRepeat, parseYears } from "@/lib/pyq-analyser";
import { slugify } from "@/lib/utils";

async function requireAdmin() {
  if (!(await getSession())) throw new Error("Unauthorized");
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
export async function ensureCatalogSubjectAction(input: z.infer<typeof CatalogSubjectSchema>) {
  await requireAdmin();
  const c = CatalogSubjectSchema.parse(input);
  if (c.upc) {
    const byUpc = await prisma.subject.findFirst({ where: { upc: c.upc, mergedIntoId: null }, select: { id: true } });
    if (byUpc) return byUpc.id;
  }
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
  year: z.string().regex(/^(19|20)\d{2}$/),
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
      }),
    )
    .min(1)
    .max(200),
});

/**
 * Saves one paper's questions. A question that matches one already stored for
 * the subject (re-asked in another year) is merged: the year is added and the
 * repeat count goes up, which is what drives "most repeated" on the analyser.
 */
export async function savePaperQuestionsAction(input: z.infer<typeof SaveSchema>) {
  await requireAdmin();
  const { subjectId, year, questions } = SaveSchema.parse(input);
  const existing = await prisma.question.findMany({
    where: { subjectId },
    select: { id: true, questionText: true, answerText: true, years: true, topics: true },
  });

  let created = 0;
  let merged = 0;
  for (const q of questions) {
    const match = findRepeat(q.questionText, existing);
    if (match) {
      const years = parseYears(`${match.years ?? ""},${year}`);
      const topics = [...new Set([...match.topics, ...q.topics])];
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
      merged++;
    } else {
      // Not added to `existing`: an "OR" alternative in the same paper must
      // stay its own question. Re-saving the same paper merges as a no-op.
      await prisma.question.create({
        data: {
          subjectId,
          questionText: q.questionText,
          answerText: q.answerText,
          marks: q.marks || null,
          years: year,
          questionNumber: q.questionNumber || null,
          section: q.section || null,
          topics: q.topics,
          difficulty: q.difficulty,
        },
      });
      created++;
    }
  }

  revalidatePath("/papers/analyser");
  return { created, merged };
}
