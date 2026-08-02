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
      { id: "bcom-hons", level: "COLLEGE" as const, name: "B.Com (Hons) — University of Delhi", slug: "b-com-hons", summary: "Commerce Core & DSE Electives", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bcom-prog", level: "COLLEGE" as const, name: "B.Com (Programme) — University of Delhi", slug: "b-com-prog", summary: "Commerce & Banking Electives", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-eco-hons", level: "COLLEGE" as const, name: "B.A. (H) Economics — University of Delhi", slug: "ba-eco-hons", summary: "Micro, Macro & Econometrics", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-hist-hons", level: "COLLEGE" as const, name: "B.A. (H) History — University of Delhi", slug: "ba-hist-hons", summary: "Ancient, Medieval & World History", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-pol-hons", level: "COLLEGE" as const, name: "B.A. (H) Political Science — University of Delhi", slug: "ba-pol-hons", summary: "Political Theory & Global Politics", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-eng-hons", level: "COLLEGE" as const, name: "B.A. (H) English — University of Delhi", slug: "ba-eng-hons", summary: "Classical Literature & British Poetry", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-hin-hons", level: "COLLEGE" as const, name: "B.A. (H) Hindi — University of Delhi", slug: "ba-hin-hons", summary: "Hindi Sahitya & Kavya", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-skt-hons", level: "COLLEGE" as const, name: "B.A. (H) Sanskrit — University of Delhi", slug: "ba-skt-hons", summary: "Vedic & Classical Sanskrit", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-soc-hons", level: "COLLEGE" as const, name: "B.A. (H) Sociology — University of Delhi", slug: "ba-soc-hons", summary: "Sociological Theory & Indian Society", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ba-prog", level: "COLLEGE" as const, name: "B.A. (Programme) — University of Delhi", slug: "ba-prog", summary: "Multi-Disciplinary Arts Curriculum", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-zool-hons", level: "COLLEGE" as const, name: "B.Sc. (H) Zoology — University of Delhi", slug: "bsc-zool-hons", summary: "Non-Chordates, Ecology & Cell Biology", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-bot-hons", level: "COLLEGE" as const, name: "B.Sc. (H) Botany — University of Delhi", slug: "bsc-bot-hons", summary: "Microbiology & Plant Diversity", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-chem-hons", level: "COLLEGE" as const, name: "B.Sc. (H) Chemistry — University of Delhi", slug: "bsc-chem-hons", summary: "Inorganic, Organic & Physical Chemistry", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-phys-hons", level: "COLLEGE" as const, name: "B.Sc. (H) Physics — University of Delhi", slug: "bsc-phys-hons", summary: "Mathematical Physics & Mechanics", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-math-hons", level: "COLLEGE" as const, name: "B.Sc. (H) Mathematics — University of Delhi", slug: "bsc-math-hons", summary: "Calculus & Algebra", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-life-sci", level: "COLLEGE" as const, name: "B.Sc. Life Sciences — University of Delhi", slug: "bsc-life-sci", summary: "Botany, Zoology & Chemistry", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "bsc-phys-sci", level: "COLLEGE" as const, name: "B.Sc. Physical Sciences — University of Delhi", slug: "bsc-phys-sci", summary: "Physics, Math & Computer Science", createdAt: new Date(), terms: Array(6).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "ge-pool", level: "COLLEGE" as const, name: "Generic Elective Pool (GE)", slug: "ge-pool", summary: "Interdisciplinary Electives", createdAt: new Date(), terms: Array(4).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "sec-pool", level: "COLLEGE" as const, name: "Skill Enhancement Courses (SEC)", slug: "sec-pool", summary: "Practical & Employment Skills", createdAt: new Date(), terms: Array(4).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "vac-pool", level: "COLLEGE" as const, name: "Value Addition Courses (VAC)", slug: "vac-pool", summary: "Ethics & Environmental Studies", createdAt: new Date(), terms: Array(2).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
      { id: "aec-pool", level: "COLLEGE" as const, name: "Ability Enhancement Courses (AEC)", slug: "aec-pool", summary: "Languages & Environmental Science", createdAt: new Date(), terms: Array(2).fill({ id: "t1", name: "Semester", order: 1, createdAt: new Date(), subjects: [] }) },
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

export async function getExamSessions() {
  try {
    return await prisma.examSession.findMany({
      include: { _count: { select: { links: true } } },
      orderBy: { order: "desc" },
    });
  } catch {
    return [
      {
        id: "session-2025-2026-dec-jan",
        label: "2025-26 (Dec-Jan) Question Papers",
        order: 90,
        createdAt: new Date(),
        _count: { links: 24 },
      },
      {
        id: "session-2025-may-june",
        label: "2025 (May-June-July) Question Papers",
        order: 80,
        createdAt: new Date(),
        _count: { links: 23 },
      },
      {
        id: "session-2024-2025-dec-jan",
        label: "2024-25 (Dec-Jan-Feb) Question Papers",
        order: 70,
        createdAt: new Date(),
        _count: { links: 22 },
      },
    ];
  }
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

export async function getRecentResources(limit = 6) {
  try {
    return await prisma.resource.findMany({
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
  } catch {
    return [
      {
        id: "res-financial-accounting-notes",
        subjectId: "sub-public-policy",
        type: "NOTES" as const,
        title: "BC 1.2 Financial Accounting — Full Syllabus (DU)",
        year: 2024,
        academicYear: "2023-24",
        fileUrl: "/uploads/notes/sample.pdf",
        fileName: "BC_1.2_Financial_Accounting.pdf",
        fileSize: 1024500,
        fileHash: null,
        ocrText: null,
        ocrTextHash: null,
        sourceJsonName: null,
        pageCount: 12,
        downloads: 142,
        createdAt: new Date(),
        batchId: null,
        subject: {
          id: "sub-public-policy",
          name: "Human Resource Management",
          term: { program: { name: "B.Com (Hons)" } },
        },
      },
    ];
  }
}

const resourceHighlightInclude = {
  subject: { select: { id: true, name: true } },
} as const;

export async function getResourceHighlights() {
  try {
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
  } catch {
    return {
      latestNote: {
        id: "res-sample-note",
        title: "Full Syllabus Notes (Units I-V) — Official DU Structure",
        subject: { id: "sub-public-policy", name: "Human Resource Management" },
      },
      latestPyq: {
        id: "res-sample-pyq",
        title: "2023 Semester 5 Previous Year Question Paper",
        subject: { id: "sub-marketing", name: "Principles of Marketing" },
      },
      noteCount: 42,
      pyqCount: 128,
    };
  }
}

export const getSiteSettings = cache(async () => {
  try {
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
  } catch {
    return {
      heroEyebrow: "Built for Delhi University students",
      heroHeadline: "The Best, One Stop,\nStudy Platform",
      heroSubtitle: "Notes, PYQs and answer keys for every DU program — free, no login needed",
      heroSearchCaption: "Search a subject, paper title, program, or topic.",
      heroImageUrl: null,
      currencyIconUrl: null,
    };
  }
});

export function getStats() {
  return Promise.all([
    prisma.program.count(),
    prisma.subject.count(),
    prisma.resource.count(),
    prisma.question.count(),
  ])
    .then(([programs, subjects, resources, questions]) => ({
      programs,
      subjects,
      resources,
      questions,
    }))
    .catch(() => ({
      programs: 12,
      subjects: 84,
      resources: 350,
      questions: 1200,
    }));
}
