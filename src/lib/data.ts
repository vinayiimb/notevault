import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { EducationLevel } from "@/generated/prisma";

export function getProgramsByLevel(level: EducationLevel) {
  return prisma.program.findMany({
    where: { level },
    include: { terms: { include: { subjects: true } } },
    orderBy: { name: "asc" },
  });
}

export function getProgramBySlug(slug: string) {
  return prisma.program.findUnique({
    where: { slug },
    include: {
      terms: {
        orderBy: { order: "asc" },
        include: { subjects: { orderBy: { name: "asc" } } },
      },
    },
  });
}

export function getTermById(id: string) {
  return prisma.term.findUnique({
    where: { id },
    include: {
      program: true,
      subjects: { orderBy: { name: "asc" }, include: { resources: true, questions: true } },
    },
  });
}

export function getSubjectById(id: string) {
  return prisma.subject.findUnique({
    where: { id },
    include: {
      term: { include: { program: true } },
      resources: { orderBy: { createdAt: "desc" } },
      questions: { orderBy: [{ isRepeated: "desc" }, { repeatCount: "desc" }] },
      analysis: true,
    },
  });
}

// SQLite's `contains` is case-sensitive, so filter in JS for a case-insensitive match.
export async function searchSubjects(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const subjects = await prisma.subject.findMany({
    include: { term: { include: { program: true } } },
  });
  return subjects
    .filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.term.program.name.toLowerCase().includes(q) ||
        (s.description ?? "").toLowerCase().includes(q)
    )
    .slice(0, 20);
}

export function getRecentResources(limit = 6) {
  return prisma.resource.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      subject: {
        select: {
          id: true,
          name: true,
          term: { select: { program: { select: { name: true } } } },
        },
      },
    },
  });
}

const resourceHighlightInclude = {
  subject: { select: { id: true, name: true } },
} as const;

export async function getResourceHighlights() {
  const [latestNote, latestPyq, noteCount, pyqCount] = await Promise.all([
    prisma.resource.findFirst({
      where: { type: "NOTES" },
      orderBy: { createdAt: "desc" },
      include: resourceHighlightInclude,
    }),
    prisma.resource.findFirst({
      where: { type: "PYQ" },
      orderBy: { createdAt: "desc" },
      include: resourceHighlightInclude,
    }),
    prisma.resource.count({ where: { type: "NOTES" } }),
    prisma.resource.count({ where: { type: "PYQ" } }),
  ]);
  return { latestNote, latestPyq, noteCount, pyqCount };
}

// Cached per-request: this is called once per page render plus once per
// <CurrencyIcon> instance (which can appear many times, e.g. once per
// leaderboard row) — without this, that'd be an extra DB round-trip per row.
export const getSiteSettings = cache(async () => {
  const settings = await prisma.siteSettings.findUnique({ where: { id: "singleton" } });
  return {
    heroHeadline: settings?.heroHeadline || "The Best, One Stop,\nStudy Platform",
    heroSubtitle:
      settings?.heroSubtitle || "Notes, PYQs and answer keys for every DU program — free, no login needed",
    heroImageUrl: settings?.heroImageUrl || null,
    currencyIconUrl: settings?.currencyIconUrl || null,
  };
});

export function getStats() {
  return Promise.all([
    prisma.program.count(),
    prisma.subject.count(),
    prisma.resource.count(),
    prisma.question.count(),
  ]).then(([programs, subjects, resources, questions]) => ({
    programs,
    subjects,
    resources,
    questions,
  }));
}
