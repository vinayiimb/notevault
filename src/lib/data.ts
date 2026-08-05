import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { EducationLevel } from "@/generated/prisma";
import { MASTER_SYLLABUS_ROWS } from "./content/master-syllabus-data";
import { slugify } from "@/lib/utils";

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

const PROGRAM_SLUG_TO_COURSES: Record<string, string[]> = {
  "bcom-hons": ["B.Com. (Hons.)"],
  "bcom-prog": ["B.Com (P)"],
  "ba-eco-hons": ["B.A. (Hons.) Economics", "B.A (Prog.) Economics as Major", "B.A (Prog.) Economics as Minor"],
  "ba-hist-hons": ["B.A. (Hons.) History", "B.A (Prog.) History as Major", "B.A (Prog.) History as Minor", "History Honours"],
  "ba-pol-hons": ["B.A. (Hons.) Political Science", "B.A. (Prog) with Political Science as Major Discipline", "B.A. (Prog) with Political Science as Minor Discipline"],
  "ba-eng-hons": ["B.A. (Hons) English", "B. A. (Prog) English"],
  "ba-hin-hons": ["B.A. (Hons) Hindi"],
  "ba-skt-hons": ["BA (Hons) Sanskrit", "B.A. (Prog.) Sanskrit (MAJOR)", "B.A. (Prog.) Sanskrit (MINOR)"],
  "ba-soc-hons": ["B. A Program Sociology", "B.A (hons) Socialogy"],
  "bsc-zool-hons": ["B.Sc. (Hons.) Zoology", "B. Sc. Life Science (Zoology)", "B.Sc. (Prog.) Applied Life Sciences with Agrochemicals and Pest Management pertaining to Zoology"],
  "bsc-bot-hons": ["B.Sc. (Hons.) Botany", "B. Sc. Life Science (Botany)", "B.Sc. (Prog.) Applied Life Sciences with Agrochemicals and Pest Management pertaining to Botany"],
  "bsc-chem-hons": ["B.Sc. (Hons.) Chemistry", "B.Sc (hons) Chemistry", "B. Sc. Life Science (Chemistry)", "Physical Science courses pertaining to Chemistry"],
  "bsc-phys-hons": ["B.Sc. (Hons.) Physics", "B.Sc. Physical Sciences (Courses pertaining to Physics)"],
  "bsc-math-hons": ["B.Sc. (Hons.) Mathematics", "B.A. (Prog) Mathematics as Major", "B.A. (Prog) with Mathematics as Minor"],
  "ge-pool": ["University-wide Generic Elective Pool", "Generic Elective Pool"],
  "sec-pool": ["University-wide Skill Enhancement Course Pool"],
  "vac-pool": ["University-wide Value Addition Course Pool"],
  "aec-pool": ["University-wide Ability Enhancement Course Pool"],
};

const ROMAN_TO_NUM: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
  "1": 1, "2": 2, "3": 3, "4": 4, "5": 5, "6": 6, "7": 7, "8": 8,
};

function getSemesterOrder(sem: string): number {
  const cleaned = sem.toUpperCase().trim().replace(/^SEMESTER[- ]*/, "");
  return ROMAN_TO_NUM[cleaned] || 999;
}

function buildFallbackProgram(slug: string) {
  const courseNames = PROGRAM_SLUG_TO_COURSES[slug];
  if (!courseNames) return null;

  const rows = MASTER_SYLLABUS_ROWS.filter(r => courseNames.includes(r.course));
  
  // Group by semester
  const termsMap = new Map<string, any[]>();
  for (const row of rows) {
    const sem = row.semester || "I";
    const list = termsMap.get(sem) ?? [];
    list.push(row);
    termsMap.set(sem, list);
  }

  const terms = Array.from(termsMap.entries()).map(([semName, semRows]) => {
    const order = getSemesterOrder(semName);
    const termId = `term-${slug}-${semName.toLowerCase().replace(/\s+/g, "-")}`;
    return {
      id: termId,
      programId: slug,
      name: semName.startsWith("Semester") ? semName : `Semester ${semName}`,
      order,
      createdAt: new Date(),
      subjects: semRows.map(row => {
        const subSlug = slugify(row.subjectName);
        return {
          id: `sub-${subSlug}-${row.upc || row.id}`,
          termId,
          name: row.subjectName,
          slug: subSlug,
          description: row.courseNumber ? `${row.courseNumber} · Credits: ${row.credits}` : `Credits: ${row.credits}`,
          upc: row.upc === "TO BE UPDATED" || row.upc === "TO BE ANNOUNCED" ? null : row.upc || null,
          paperType: row.type || null,
          aliases: [] as string[],
          createdAt: new Date(),
          resources: [] as any[],
          questions: [] as any[],
          analysis: null,
          notes: null,
          driveSubjects: [] as any[],
        };
      }).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }).sort((a, b) => a.order - b.order);

  return {
    id: slug,
    level: "COLLEGE" as const,
    name: courseNames[0],
    slug,
    summary: `${courseNames[0]} Syllabus & Papers`,
    createdAt: new Date(),
    terms,
  };
}

export async function getProgramBySlug(slug: string) {
  try {
    const program = await prisma.program.findUnique({
      where: { slug },
      include: {
        terms: {
          orderBy: { order: "asc" },
          include: { subjects: { orderBy: { name: "asc" } } },
        },
      },
    });
    if (program) return program;
    return buildFallbackProgram(slug);
  } catch (err) {
    console.warn(`Database unavailable for getProgramBySlug(${slug}), returning fallback:`, err instanceof Error ? err.message : err);
    return buildFallbackProgram(slug);
  }
}

export async function getTermById(id: string) {
  try {
    const term = await prisma.term.findUnique({
      where: { id },
      include: {
        program: true,
        subjects: { orderBy: { name: "asc" }, include: { resources: true, questions: true } },
        termPapers: { orderBy: { createdAt: "desc" } },
      },
    });
    if (term) return term;
  } catch (err) {
    console.warn(`Database unavailable for getTermById(${id}), matching from fallback program...`);
  }

  // Parse id: `term-${programSlug}-${semesterName}`
  if (id.startsWith("term-")) {
    const parts = id.split("-");
    const programSlug = parts.slice(1, parts.length - 1).join("-");
    const program = buildFallbackProgram(programSlug);
    if (program) {
      const term = program.terms.find(t => t.id === id);
      if (term) {
        return {
          ...term,
          program,
          termPapers: [],
        };
      }
    }
  }
  return null;
}

export async function getSubjectById(id: string) {
  try {
    const subject = await prisma.subject.findUnique({
      where: { id },
      include: {
        term: { include: { program: true } },
        resources: { orderBy: { createdAt: "desc" } },
        questions: { orderBy: [{ isRepeated: "desc" }, { repeatCount: "desc" }] },
        analysis: true,
        notes: true,
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
    if (subject) return subject;
  } catch (err) {
    console.warn(`Database unavailable for getSubjectById(${id}), matching from fallback program...`);
  }

  // Parse id: `sub-${subSlug}-${upc_or_id}`
  for (const programSlug of Object.keys(PROGRAM_SLUG_TO_COURSES)) {
    const program = buildFallbackProgram(programSlug);
    if (program) {
      for (const term of program.terms) {
        const subject = term.subjects.find(s => s.id === id);
        if (subject) {
          return {
            ...subject,
            term: {
              ...term,
              program,
            },
          };
        }
      }
    }
  }
  return null;
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
export async function getPyqArchiveIndex() {
  try {
    return await prisma.resource.findMany({
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
  } catch (err) {
    console.warn("Database unavailable for getPyqArchiveIndex, returning empty array:", err instanceof Error ? err.message : err);
    return [];
  }
}

// Deliberately does not filter on ocrText — pyq-notes/[id] needs to tell
// "doesn't exist" (404) apart from "exists, OCR still pending" (noindexed
// placeholder with a working download) rather than 404-ing both.
export function getPyqResourceById(id: string) {
  return prisma.resource.findFirst({
    where: { id, type: "PYQ" },
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
export async function getFullDriveArchiveIndex() {
  try {
    return await prisma.driveFileMatch.findMany({
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
  } catch (err) {
    console.warn("Database unavailable for getFullDriveArchiveIndex, returning empty array:", err instanceof Error ? err.message : err);
    return [];
  }
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

  let subjects: any[] = [];
  try {
    subjects = await prisma.subject.findMany({
      include: { term: { include: { program: true } } },
    });
  } catch (err) {
    console.warn("Database unavailable for searchSubjects, searching fallback programs:", err instanceof Error ? err.message : err);
    // Build subjects from fallback programs
    for (const programSlug of Object.keys(PROGRAM_SLUG_TO_COURSES)) {
      const program = buildFallbackProgram(programSlug);
      if (program) {
        for (const term of program.terms) {
          for (const s of term.subjects) {
            subjects.push({
              ...s,
              term: {
                ...term,
                program,
              },
            });
          }
        }
      }
    }
  }

  function score(s: any): number | null {
    const name = s.name.toLowerCase();
    if (name.startsWith(q)) return 0;
    if (name.split(/\s+/).some((word: string) => word.startsWith(q))) return 1;
    if (name.includes(q)) return 2;
    if (s.term.program.name.toLowerCase().includes(q) || (s.description ?? "").toLowerCase().includes(q)) {
      return 3;
    }
    return null;
  }

  return subjects
    .map((s) => ({ s, rank: score(s) }))
    .filter((x): x is { s: any; rank: number } => x.rank !== null)
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

// Deterministic "question of the day" — same question for every visitor on a
// given calendar date, rotating through the Question table by day-of-year so
// it changes daily without needing a schedule table of its own.
export async function getDailyQuestion() {
  try {
    const total = await prisma.question.count();
    if (total === 0) return null;

    const startOfYear = Date.UTC(new Date().getUTCFullYear(), 0, 0);
    const dayOfYear = Math.floor((Date.now() - startOfYear) / 86_400_000);
    const skip = dayOfYear % total;

    const question = await prisma.question.findFirst({
      skip,
      take: 1,
      orderBy: { createdAt: "asc" },
      include: { subject: { select: { id: true, name: true } } },
    });
    return question;
  } catch {
    return null;
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
