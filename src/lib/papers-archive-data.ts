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

// One row in the admin = one subject heading as students see it on /papers.
// /papers groups papers by canonicalSubjectKey(displayed name), so subjects
// combined under the same name collapse into a single group here too, and
// every edit to the group is applied to all of its member subjects.
export type PapersArchiveSubject = {
  groupKey: string;
  members: { subjectKey: string; originalName: string; paperCount: number }[];
  displayName: string;
  paperCount: number;
  editedPapers: number;
  semesters: string[];
  upcs: string[];
  semesterOverride: number | null;
  courseOverride: string | null;
  hidden: boolean;
  hasOverride: boolean;
};

async function loadCourseSubjects(course: string) {
  const papers = loadCatalog().filter((p) => p.course === course);
  const overrides = await prisma.catalogSubjectOverride.findMany({ where: { course } });
  const overrideByKey = new Map(overrides.map((o) => [o.subjectKey, o]));
  const groupKeyOf = (p: CatalogPaper) => {
    const subjectKey = canonicalSubjectKey(p.subject);
    const name = overrideByKey.get(subjectKey)?.displayName || p.subject;
    return { subjectKey, groupKey: canonicalSubjectKey(name) };
  };
  return { papers, overrideByKey, groupKeyOf };
}

export async function getPapersArchiveSubjects(course: string): Promise<PapersArchiveSubject[]> {
  const { papers, overrideByKey, groupKeyOf } = await loadCourseSubjects(course);
  const paperOverrides = await prisma.catalogPaperOverride.findMany({
    where: { paperId: { in: papers.map((p) => p.id) } },
    select: { paperId: true },
  });
  const editedPaperIds = new Set(paperOverrides.map((o) => o.paperId));

  type Group = {
    members: Map<string, { subjectKey: string; originalName: string; paperCount: number }>;
    count: number;
    edited: number;
    semesters: Set<string>;
    upcs: Set<string>;
  };
  const groups = new Map<string, Group>();
  for (const p of papers) {
    const { subjectKey, groupKey } = groupKeyOf(p);
    const group = groups.get(groupKey) ?? {
      members: new Map(),
      count: 0,
      edited: 0,
      semesters: new Set<string>(),
      upcs: new Set<string>(),
    };
    const member = group.members.get(subjectKey) ?? { subjectKey, originalName: p.subject, paperCount: 0 };
    member.paperCount += 1;
    group.members.set(subjectKey, member);
    group.count += 1;
    if (editedPaperIds.has(p.id)) group.edited += 1;
    if (p.semester) group.semesters.add(String(p.semester));
    if (p.upc) group.upcs.add(p.upc);
    groups.set(groupKey, group);
  }

  return [...groups.entries()]
    .map(([groupKey, g]) => {
      const members = [...g.members.values()].sort((a, b) => a.originalName.localeCompare(b.originalName));
      const memberOverrides = members.map((m) => overrideByKey.get(m.subjectKey));
      const first = memberOverrides.find(Boolean);
      return {
        groupKey,
        members,
        displayName: first?.displayName || members[0].originalName,
        paperCount: g.count,
        editedPapers: g.edited,
        semesters: [...g.semesters].sort((a, b) => Number(a) - Number(b)),
        upcs: [...g.upcs].sort(),
        semesterOverride: first?.semesterOverride ?? null,
        courseOverride: first?.courseOverride ?? null,
        hidden: memberOverrides.every((o) => o?.hidden),
        hasOverride: Boolean(first),
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
  originalSubject: string;
  hidden: boolean;
  edited: boolean;
};

export async function getPapersArchiveSubjectPapers(course: string, groupKey: string) {
  const { papers: coursePapers, overrideByKey, groupKeyOf } = await loadCourseSubjects(course);
  const papers = coursePapers.filter((p) => groupKeyOf(p).groupKey === groupKey);
  if (papers.length === 0) return null;

  const paperOverrides = await prisma.catalogPaperOverride.findMany({
    where: { paperId: { in: papers.map((p) => p.id) } },
  });
  const overrideById = new Map(paperOverrides.map((o) => [o.paperId, o]));
  const subjectOverrides = [...new Set(papers.map((p) => canonicalSubjectKey(p.subject)))].map((k) =>
    overrideByKey.get(k),
  );

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
        originalSubject: p.subject,
        hidden: o?.hidden ?? false,
        edited: Boolean(o),
      };
    })
    .sort((a, b) => b.yearRange.localeCompare(a.yearRange));

  return {
    subjectName: subjectOverrides.find(Boolean)?.displayName || papers[0].subject,
    subjectHidden: subjectOverrides.every((o) => o?.hidden),
    combined: subjectOverrides.length > 1,
    papers: rows,
  };
}
