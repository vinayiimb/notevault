import "server-only";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canonicalSubjectKey } from "@/lib/subject-normalization";
import { slugify } from "@/lib/utils";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";

// Admin-side reads for the /papers archive (public/data/papers-catalog.json,
// ~29k papers). The file is read once per process and only ever sliced per
// programme/subject before reaching a page — never shipped to the browser
// whole (loading all of it into one page is what OOM-crashed production).
let catalog: CatalogPaper[] | null = null;
function loadCatalog(): CatalogPaper[] {
  if (!catalog) {
    const file = path.join(process.cwd(), "public", "data", "papers-catalog.json");
    catalog = JSON.parse(fs.readFileSync(file, "utf8")) as CatalogPaper[];
  }
  return catalog;
}

export type PapersArchiveCourse = {
  course: string;
  slug: string;
  paperCount: number;
  subjectCount: number;
  editedSubjects: number;
};

export async function getPapersArchiveCourses(): Promise<PapersArchiveCourse[]> {
  const overrides = await prisma.catalogSubjectOverride.findMany({ select: { course: true } });
  const editedByCourse = new Map<string, number>();
  for (const o of overrides) editedByCourse.set(o.course, (editedByCourse.get(o.course) ?? 0) + 1);

  const byCourse = new Map<string, { papers: number; subjects: Set<string> }>();
  for (const p of loadCatalog()) {
    const entry = byCourse.get(p.course) ?? { papers: 0, subjects: new Set<string>() };
    entry.papers += 1;
    entry.subjects.add(canonicalSubjectKey(p.subject));
    byCourse.set(p.course, entry);
  }

  return [...byCourse.entries()]
    .map(([course, e]) => ({
      course,
      slug: slugify(course),
      paperCount: e.papers,
      subjectCount: e.subjects.size,
      editedSubjects: editedByCourse.get(course) ?? 0,
    }))
    .sort((a, b) => a.course.localeCompare(b.course));
}

export async function getAllPapersArchiveCourseNames(): Promise<string[]> {
  return [...new Set(loadCatalog().map((p) => p.course))].sort((a, b) => a.localeCompare(b));
}

export async function findPapersArchiveCourse(slug: string): Promise<string | null> {
  for (const p of loadCatalog()) if (slugify(p.course) === slug) return p.course;
  return null;
}

export type PapersArchiveSubject = {
  subjectKey: string;
  originalName: string;
  displayName: string;
  paperCount: number;
  editedPapers: number;
  semesters: string[];
  semesterOverride: number | null;
  courseOverride: string | null;
  hidden: boolean;
  hasOverride: boolean;
};

export async function getPapersArchiveSubjects(course: string): Promise<PapersArchiveSubject[]> {
  const papers = loadCatalog().filter((p) => p.course === course);
  const [overrides, paperOverrides] = await Promise.all([
    prisma.catalogSubjectOverride.findMany({ where: { course } }),
    prisma.catalogPaperOverride.findMany({
      where: { paperId: { in: papers.map((p) => p.id) } },
      select: { paperId: true },
    }),
  ]);
  const overrideByKey = new Map(overrides.map((o) => [o.subjectKey, o]));
  const editedPaperIds = new Set(paperOverrides.map((o) => o.paperId));

  const bySubject = new Map<string, { name: string; count: number; edited: number; semesters: Set<string> }>();
  for (const p of papers) {
    const key = canonicalSubjectKey(p.subject);
    const entry = bySubject.get(key) ?? { name: p.subject, count: 0, edited: 0, semesters: new Set<string>() };
    entry.count += 1;
    if (editedPaperIds.has(p.id)) entry.edited += 1;
    if (p.semester) entry.semesters.add(String(p.semester));
    bySubject.set(key, entry);
  }

  return [...bySubject.entries()]
    .map(([subjectKey, e]) => {
      const o = overrideByKey.get(subjectKey);
      return {
        subjectKey,
        originalName: e.name,
        displayName: o?.displayName || e.name,
        paperCount: e.count,
        editedPapers: e.edited,
        semesters: [...e.semesters].sort(),
        semesterOverride: o?.semesterOverride ?? null,
        courseOverride: o?.courseOverride ?? null,
        hidden: o?.hidden ?? false,
        hasOverride: Boolean(o),
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export type PapersArchivePaper = {
  id: string;
  yearRange: string;
  semester: string | null;
  originalUrl: string;
  pdfUrl: string;
  note: string | null;
  college: string | null;
  hidden: boolean;
  edited: boolean;
};

export async function getPapersArchiveSubjectPapers(course: string, subjectKey: string) {
  const papers = loadCatalog().filter((p) => p.course === course && canonicalSubjectKey(p.subject) === subjectKey);
  if (papers.length === 0) return null;

  const [subjectOverride, paperOverrides] = await Promise.all([
    prisma.catalogSubjectOverride.findUnique({ where: { course_subjectKey: { course, subjectKey } } }),
    prisma.catalogPaperOverride.findMany({ where: { paperId: { in: papers.map((p) => p.id) } } }),
  ]);
  const overrideById = new Map(paperOverrides.map((o) => [o.paperId, o]));

  const rows: PapersArchivePaper[] = papers
    .map((p) => {
      const o = overrideById.get(p.id);
      return {
        id: p.id,
        yearRange: p.yearRange,
        semester: p.semester ?? null,
        originalUrl: p.pdfUrl,
        pdfUrl: o?.pdfUrl || p.pdfUrl,
        note: p.note ?? null,
        college: p.college ?? null,
        hidden: o?.hidden ?? false,
        edited: Boolean(o),
      };
    })
    .sort((a, b) => b.yearRange.localeCompare(a.yearRange));

  return {
    subjectName: subjectOverride?.displayName || papers[0].subject,
    subjectHidden: subjectOverride?.hidden ?? false,
    papers: rows,
  };
}
