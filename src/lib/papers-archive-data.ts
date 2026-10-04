import "server-only";
import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { canonicalSubjectKey } from "@/lib/subject-normalization";
import { slugify } from "@/lib/utils";
import type { CatalogPaper } from "@/lib/pyq-catalog-types";
import { applyPaperEdits, type EditedPaper } from "@/lib/paper-edits";

// Admin-side reads for the /papers archive (public/data/papers-catalog.json,
// ~29k papers). The file is read once per process and only ever sliced per
// programme/subject before reaching a page — never shipped to the browser
// whole (loading all of it into one page is what OOM-crashed production).
// Both datasets are edited here: papers-catalog.json (/papers) and
// papers-noncore-catalog.json (/papers/noncore). Edits are keyed by course +
// subject name, so a course in both shows as one programme and an edit
// applies on both pages.
let catalog: CatalogPaper[] | null = null;
function loadCatalog(): CatalogPaper[] {
  if (!catalog) {
    catalog = ["papers-catalog.json", "papers-noncore-catalog.json"].flatMap((name) => {
      const file = path.join(process.cwd(), "public", "data", name);
      return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, "utf8")) as CatalogPaper[]) : [];
    });
  }
  return catalog;
}

// The catalog with every per-paper admin edit applied (added papers
// included, hidden ones kept but flagged) — what the admin pages show.
async function editedCatalog(): Promise<EditedPaper[]> {
  const edits = await prisma.catalogPaperOverride.findMany();
  return applyPaperEdits(loadCatalog(), edits, { keepHidden: true });
}

export type PapersArchiveCourse = {
  course: string;
  slug: string;
  paperCount: number;
  matchedCount: number;
  noncoreCount: number;
  subjectCount: number;
  editedSubjects: number;
};

export async function getPapersArchiveCourses(): Promise<PapersArchiveCourse[]> {
  const overrides = await prisma.catalogSubjectOverride.findMany({ select: { course: true } });
  const editedByCourse = new Map<string, number>();
  for (const o of overrides) editedByCourse.set(o.course, (editedByCourse.get(o.course) ?? 0) + 1);

  const byCourse = new Map<string, { papers: number; matched: number; subjects: Set<string> }>();
  for (const p of await editedCatalog()) {
    const entry = byCourse.get(p.course) ?? { papers: 0, matched: 0, subjects: new Set<string>() };
    entry.papers += 1;
    if (p.verified) entry.matched += 1;
    entry.subjects.add(canonicalSubjectKey(p.subject));
    byCourse.set(p.course, entry);
  }

  return [...byCourse.entries()]
    .map(([course, e]) => ({
      course,
      slug: slugify(course),
      paperCount: e.papers,
      matchedCount: e.matched,
      noncoreCount: e.papers - e.matched,
      subjectCount: e.subjects.size,
      editedSubjects: editedByCourse.get(course) ?? 0,
    }))
    .sort((a, b) => a.course.localeCompare(b.course));
}

export async function getAllPapersArchiveCourseNames(): Promise<string[]> {
  return [...new Set((await editedCatalog()).map((p) => p.course))].sort((a, b) => a.localeCompare(b));
}

export async function findPapersArchiveCourse(slug: string): Promise<string | null> {
  for (const p of await editedCatalog()) if (slugify(p.course) === slug) return p.course;
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
  matchedCount: number;
  editedPapers: number;
  semesters: string[];
  upcs: string[];
  semesterOverride: number | null;
  courseOverride: string | null;
  hidden: boolean;
  hasOverride: boolean;
};

async function loadCourseSubjects(course: string) {
  const papers = (await editedCatalog()).filter((p) => p.course === course);
  const overrides = await prisma.catalogSubjectOverride.findMany({ where: { course } });
  const overrideByKey = new Map(overrides.map((o) => [o.subjectKey, o]));
  const groupKeyOf = (p: EditedPaper) => {
    const subjectKey = canonicalSubjectKey(p.subject);
    const name = overrideByKey.get(subjectKey)?.displayName || p.subject;
    return { subjectKey, groupKey: canonicalSubjectKey(name) };
  };
  return { papers, overrideByKey, groupKeyOf };
}

export async function getPapersArchiveSubjects(course: string): Promise<PapersArchiveSubject[]> {
  const { papers, overrideByKey, groupKeyOf } = await loadCourseSubjects(course);

  type Group = {
    members: Map<string, { subjectKey: string; originalName: string; paperCount: number }>;
    count: number;
    matched: number;
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
      matched: 0,
      edited: 0,
      semesters: new Set<string>(),
      upcs: new Set<string>(),
    };
    const member = group.members.get(subjectKey) ?? { subjectKey, originalName: p.subject, paperCount: 0 };
    member.paperCount += 1;
    group.members.set(subjectKey, member);
    group.count += 1;
    if (p.verified) group.matched += 1;
    if (p.edited) group.edited += 1;
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
        matchedCount: g.matched,
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
  subject: string;
  course: string;
  upc: string | null;
  paperType: string | null;
  fileName: string | null;
  verified: boolean;
  hidden: boolean;
  edited: boolean;
  added: boolean;
};

export async function getPapersArchiveSubjectPapers(course: string, groupKey: string) {
  const { papers: coursePapers, overrideByKey, groupKeyOf } = await loadCourseSubjects(course);
  const papers = coursePapers.filter((p) => groupKeyOf(p).groupKey === groupKey);
  if (papers.length === 0) return null;

  const subjectOverrides = [...new Set(papers.map((p) => canonicalSubjectKey(p.subject)))].map((k) =>
    overrideByKey.get(k),
  );

  const rows: PapersArchivePaper[] = papers
    .map((p) => ({
      id: p.id,
      yearRange: p.yearRange,
      semester: p.semester ?? null,
      originalUrl: p.originalUrl ?? p.pdfUrl,
      pdfUrl: p.pdfUrl,
      note: p.note ?? null,
      college: p.college ?? null,
      subject: p.subject,
      course: p.course,
      upc: p.upc ?? null,
      paperType: p.paperType ?? null,
      fileName: p.fileName ?? null,
      verified: Boolean(p.verified),
      hidden: Boolean(p.hidden),
      edited: Boolean(p.edited),
      added: Boolean(p.added),
    }))
    .sort((a, b) => b.yearRange.localeCompare(a.yearRange));

  return {
    subjectName: subjectOverrides.find(Boolean)?.displayName || papers[0].subject,
    subjectHidden: subjectOverrides.every((o) => o?.hidden),
    combined: subjectOverrides.length > 1,
    papers: rows,
  };
}
