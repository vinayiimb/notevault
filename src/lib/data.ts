import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { EducationLevel } from "@/generated/prisma";

export async function getProgramsByLevel(level: EducationLevel) {
  try {
    return await prisma.program.findMany({
      where: { level },
      include: { terms: { include: { subjects: true } } },
      orderBy: { name: "asc" },
    });
  } catch (err) {
    console.warn("Database unavailable for getProgramsByLevel, returning DU fallback syllabus:", err instanceof Error ? err.message : err);
    return [
      {
        id: "du-bcom-hons",
        level: "COLLEGE" as const,
        name: "B.Com (Hons) — DU Official Syllabus",
        slug: "b-com-hons-du-syllabus",
        summary: "Full semester-wise syllabus approved by University of Delhi",
        createdAt: new Date(),
        terms: [
          {
            id: "du-sem-5",
            programId: "du-bcom-hons",
            name: "Semester 5",
            order: 5,
            createdAt: new Date(),
            subjects: [
              {
                id: "sub-public-policy",
                termId: "du-sem-5",
                name: "BC 5.1(a) — Human Resource Management",
                slug: "human-resource-management",
                description: "Discipline Specific Elective",
                createdAt: new Date(),
              },
              {
                id: "sub-marketing",
                termId: "du-sem-5",
                name: "BC 5.1(b) — Principles of Marketing",
                slug: "principles-of-marketing",
                description: "Discipline Specific Elective",
                createdAt: new Date(),
              },
              {
                id: "sub-auditing",
                termId: "du-sem-5",
                name: "BC 5.1(c) — Auditing and Corporate Governance",
                slug: "auditing-and-corporate-governance",
                description: "Discipline Specific Elective",
                createdAt: new Date(),
              },
              {
                id: "sub-financial-mgmt",
                termId: "du-sem-5",
                name: "BC 5.2(a) — Fundamentals of Financial Management",
                slug: "financial-management",
                description: "Discipline Specific Elective",
                createdAt: new Date(),
              },
              {
                id: "sub-gst",
                termId: "du-sem-5",
                name: "BC 5.2(b) — Goods & Services Tax (GST) Laws",
                slug: "gst-laws",
                description: "Discipline Specific Elective",
                createdAt: new Date(),
              },
              {
                id: "sub-entrepreneurship",
                termId: "du-sem-5",
                name: "BC 5.3(a) — Entrepreneurship Development",
                slug: "entrepreneurship-development",
                description: "Skill Enhancement Course",
                createdAt: new Date(),
              },
            ],
          },
        ],
      },
    ];
  }
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
      termPapers: { orderBy: { createdAt: "desc" } },
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
      notes: true,
      // Papers matched off Google Drive folders (see the Drive-sync flow in
      // src/lib/actions.ts) — kept separate from `resources` above (which are
      // PDFs we actually store) since these stay on Drive: no bytes copied,
      // no storage cost, just a direct link. isCourseBooklet excludes a
      // whole-course combined paper not yet split into per-subject files.
      driveSubjects: {
        select: {
          files: {
            where: { isCourseBooklet: false },
            select: {
              id: true,
              fileName: true,
              webViewLink: true,
              link: { select: { session: { select: { label: true } } } },
            },
          },
        },
      },
    },
  });
}

export function getExamSessions() {
  return prisma.examSession.findMany({
    include: { _count: { select: { links: true } } },
    orderBy: { order: "desc" },
  });
}

export function getExamSessionById(id: string) {
  return prisma.examSession.findUnique({
    where: { id },
    include: {
      links: {
        include: { program: true },
        orderBy: [{ program: { name: "asc" } }, { variantLabel: "asc" }],
      },
    },
  });
}

export function getSessionLinkWithSubjects(linkId: string) {
  return prisma.sessionProgramLink.findUnique({
    where: { id: linkId },
    include: {
      session: true,
      program: true,
      driveFiles: { include: { driveSubject: true }, orderBy: { fileName: "asc" } },
    },
  });
}

/** Lightweight index for the complete OCR archive. The text itself stays out
 * of this query; individual paper pages load it only when opened. */
export function getPyqArchiveIndex() {
  return prisma.resource.findMany({
    where: { type: "PYQ", ocrText: { not: null } },
    select: {
      id: true,
      title: true,
      year: true,
      academicYear: true,
      pageCount: true,
      subject: {
        select: {
          id: true,
          name: true,
          term: {
            select: {
              id: true,
              name: true,
              order: true,
              program: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
    orderBy: [{ academicYear: "desc" }, { year: "desc" }, { title: "asc" }],
  });
}

export function getPyqResourceById(id: string) {
  return prisma.resource.findFirst({
    where: { id, type: "PYQ", ocrText: { not: null } },
    include: {
      subject: {
        include: {
          term: { include: { program: true } },
          analysis: true,
          resources: { where: { type: "PYQ" }, select: { id: true } },
        },
      },
      // Solutions/Practice tabs on the reading page — only questions an
      // admin has explicitly linked to this specific paper via the
      // resourceId picker in /admin/questions/[id].
      questions: { orderBy: [{ questionNumber: "asc" }, { createdAt: "asc" }] },
    },
  });
}

// Flat index of every Drive-linked paper across every exam session — the
// actual bulk of "Full archive" content now that papers are synced from
// Google Drive folders rather than uploaded+OCR'd one at a time (see
// ExamSession/SessionProgramLink/DriveSubject/DriveFileMatch in the schema).
// Unmatched files (driveSubjectId null — the sync couldn't derive a subject
// name) are excluded since the browser groups by subject.
export function getFullDriveArchiveIndex() {
  return prisma.driveFileMatch.findMany({
    where: { driveSubjectId: { not: null } },
    select: {
      id: true,
      fileName: true,
      year: true,
      webViewLink: true,
      driveSubject: {
        select: { id: true, name: true, program: { select: { name: true, slug: true } } },
      },
      link: {
        select: {
          variantLabel: true,
          session: { select: { id: true, label: true, order: true } },
        },
      },
    },
    orderBy: [{ link: { session: { order: "desc" } } }, { fileName: "asc" }],
  });
}

// SQLite's `contains` is case-sensitive, so filter in JS for a case-insensitive match.
//
// Ranked, not just filtered — a short query like "ma" or "international"
// substring-matches dozens of subjects (it's inside "Drama", "Format",
// etc.), and the one the user actually wants ("Management Accounting",
// "International Relations") could get pushed past the result cap by
// unrelated matches if we didn't prioritize by how the query matches:
// whole-name prefix, then any-word prefix, then substring anywhere.
export async function searchSubjects(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const subjects = await prisma.subject.findMany({
    include: { term: { include: { program: true } } },
  });

  function score(s: (typeof subjects)[number]): number | null {
    const name = s.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((word) => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (s.term.program.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)) {
      return 3;
    }
    return null;
  }

  return subjects
    .map((s) => ({ s, rank: score(s) }))
    .filter((x): x is { s: (typeof subjects)[number]; rank: number } => x.rank !== null)
    .sort((a, b) => a.rank - b.rank || a.s.name.localeCompare(b.s.name))
    .slice(0, 20)
    .map((x) => x.s);
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
    heroEyebrow: settings?.heroEyebrow || "Built for Delhi University students",
    heroHeadline: settings?.heroHeadline || "The Best, One Stop,\nStudy Platform",
    heroSubtitle:
      settings?.heroSubtitle || "Notes, PYQs and answer keys for every DU program — free, no login needed",
    heroSearchCaption: settings?.heroSearchCaption || "Search a subject, paper title, program, or topic.",
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
