import "server-only";
import { prisma } from "@/lib/prisma";
import { getFullPyqCatalog, getCatalogCourses, getRawUnifiedPyqArchive } from "@/lib/pyq-catalog";
import { canonicalSubjectKey } from "@/lib/subject-normalization";
import { computeCandidateGroups, type GroupableSubject } from "@/lib/subject-grouping";
import { slugify } from "@/lib/utils";

// Read-side queries for the "Customize Full Archive" admin page — the
// string-keyed sibling of the Subject Normalization Centre. The Full
// Archive (/pyq-notes) is a union of a bundled static catalog +
// CatalogPaperUpload + Resource/DriveFileMatch (Subject-linked, already
// covered by Subject Normalization). This file only covers the two tables
// that have NO subjectId FK at all — CatalogPaperUpload and
// CatalogSubjectOverride — matched purely by canonicalSubjectKey() of the
// free-text `subject` string, per CatalogSubjectOverride's own schema
// comment: "'Merging' two subjects is just giving both the same
// displayName + semesterOverride."

export type ArchiveCourseOverview = {
  course: string;
  courseSlug: string;
  paperCount: number;
  distinctSubjectCount: number;
  candidateGroupCount: number;
};

export async function getArchiveCourseOverview(): Promise<ArchiveCourseOverview[]> {
  const [papers, courses] = await Promise.all([getFullPyqCatalog(), Promise.resolve(getCatalogCourses())]);
  const slugByCourse = new Map(courses.map((c) => [c.name, c.slug]));

  const byCourse = new Map<string, { paperCount: number; subjectKeys: Map<string, string> }>();
  for (const paper of papers) {
    const entry = byCourse.get(paper.course) ?? { paperCount: 0, subjectKeys: new Map<string, string>() };
    entry.paperCount += 1;
    const key = canonicalSubjectKey(paper.originalSubject ?? paper.subject);
    if (key && !entry.subjectKeys.has(key)) entry.subjectKeys.set(key, paper.subject);
    byCourse.set(paper.course, entry);
  }

  const overview: ArchiveCourseOverview[] = [];
  for (const [course, entry] of byCourse) {
    const groupable: GroupableSubject[] = [...entry.subjectKeys.entries()].map(([key, name]) => ({ id: key, name }));
    const { exactGroups, fuzzyGroups } = computeCandidateGroups(groupable);
    overview.push({
      course,
      courseSlug: slugByCourse.get(course) ?? canonicalSubjectKey(course).replace(/\s+/g, "-"),
      paperCount: entry.paperCount,
      distinctSubjectCount: entry.subjectKeys.size,
      candidateGroupCount: exactGroups.length + fuzzyGroups.length,
    });
  }

  return overview.sort((a, b) => b.candidateGroupCount - a.candidateGroupCount || a.course.localeCompare(b.course));
}

export type ArchiveSubjectGroupMember = {
  subjectKey: string;
  /** Current effective display — override's displayName if one exists, else the most common raw spelling seen. */
  displayName: string;
  /** The raw spelling variants observed in source data for this key (pre-override). */
  rawVariants: string[];
  paperCount: number;
  semesterOverride: number | null;
  hasOverride: boolean;
  overrideId: string | null;
};

export type ArchiveCandidateGroup = {
  members: ArchiveSubjectGroupMember[];
  exact: boolean;
  score: number;
};

export type ArchiveCourseDetail = {
  course: string;
  courseSlug: string;
  allSubjects: ArchiveSubjectGroupMember[];
  candidateGroups: ArchiveCandidateGroup[];
};

export async function getArchiveSubjectGroupsForCourse(course: string, courseSlug: string): Promise<ArchiveCourseDetail> {
  const [papers, overrides] = await Promise.all([
    getFullPyqCatalog(),
    prisma.catalogSubjectOverride.findMany({ where: { course } }),
  ]);
  const overrideByKey = new Map(overrides.map((o) => [o.subjectKey, o]));

  const bySubjectKey = new Map<string, { rawVariants: Set<string>; paperCount: number }>();
  for (const paper of papers) {
    if (paper.course !== course) continue;
    const rawName = paper.originalSubject ?? paper.subject;
    const key = canonicalSubjectKey(rawName);
    if (!key) continue;
    const entry = bySubjectKey.get(key) ?? { rawVariants: new Set<string>(), paperCount: 0 };
    entry.rawVariants.add(rawName);
    entry.paperCount += 1;
    bySubjectKey.set(key, entry);
  }

  const allSubjects: ArchiveSubjectGroupMember[] = [...bySubjectKey.entries()]
    .map(([subjectKey, { rawVariants, paperCount }]) => {
      const override = overrideByKey.get(subjectKey);
      const variants = [...rawVariants];
      return {
        subjectKey,
        displayName: override?.displayName || variants[0],
        rawVariants: variants,
        paperCount,
        semesterOverride: override?.semesterOverride ?? null,
        hasOverride: Boolean(override),
        overrideId: override?.id ?? null,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  const groupable: GroupableSubject[] = allSubjects.map((s) => ({ id: s.subjectKey, name: s.displayName }));
  const { exactGroups, fuzzyGroups } = computeCandidateGroups(groupable);
  const byKey = new Map(allSubjects.map((s) => [s.subjectKey, s]));

  const candidateGroups: ArchiveCandidateGroup[] = [...exactGroups, ...fuzzyGroups]
    .map((g) => ({
      members: g.subjectIds.map((id) => byKey.get(id)).filter((m): m is ArchiveSubjectGroupMember => Boolean(m)),
      exact: g.exact,
      score: g.score,
    }))
    .filter((g) => g.members.length >= 2);

  return { course, courseSlug, allSubjects, candidateGroups };
}

// Cross-course search backing the Subject Normalization Centre's Manual
// Merge tab. Unlike getArchiveSubjectGroupsForCourse (one course at a
// time, catalog+uploads only), this spans every course and every source —
// including Drive/NoteVault-derived papers — since a subject an admin
// wants to merge may only exist in one of those.
export type ArchiveManualMergeRow = {
  course: string;
  courseSlug: string;
  subjectKey: string;
  displayName: string;
  rawVariants: string[];
  paperCount: number;
  semesterOverride: number | null;
  hasOverride: boolean;
  overrideId: string | null;
};

export type ArchiveManualMergeFilters = {
  course?: string;
  query?: string;
};

const ARCHIVE_MANUAL_MERGE_MAX_ROWS = 150;

export async function getAllArchiveCourseNames(): Promise<string[]> {
  const papers = await getRawUnifiedPyqArchive();
  return [...new Set(papers.map((p) => p.course))].sort((a, b) => a.localeCompare(b));
}

export async function searchArchiveSubjectsForManualMerge(filters: ArchiveManualMergeFilters): Promise<ArchiveManualMergeRow[]> {
  const query = (filters.query ?? "").trim().toLowerCase();
  const course = filters.course?.trim();
  if (!course && query.length < 2) return [];

  const overrideWhere = course ? { course } : {};
  const [papers, overrides, courses] = await Promise.all([
    getRawUnifiedPyqArchive(),
    prisma.catalogSubjectOverride.findMany({ where: overrideWhere }),
    getCatalogCourses(),
  ]);
  const slugByCourse = new Map(courses.map((c) => [c.name, c.slug]));
  const overrideByKey = new Map(overrides.map((o) => [`${o.course}\u0000${o.subjectKey}`, o]));

  const bySubjectKey = new Map<string, { course: string; subjectKey: string; rawVariants: Set<string>; paperCount: number }>();
  for (const paper of papers) {
    if (course && paper.course !== course) continue;
    if (query && !paper.subject.toLowerCase().includes(query)) continue;
    const key = canonicalSubjectKey(paper.subject);
    if (!key) continue;
    const mapKey = `${paper.course}\u0000${key}`;
    const entry = bySubjectKey.get(mapKey) ?? { course: paper.course, subjectKey: key, rawVariants: new Set<string>(), paperCount: 0 };
    entry.rawVariants.add(paper.subject);
    entry.paperCount += 1;
    bySubjectKey.set(mapKey, entry);
  }

  const rows: ArchiveManualMergeRow[] = [...bySubjectKey.values()].map((entry) => {
    const override = overrideByKey.get(`${entry.course}\u0000${entry.subjectKey}`);
    const variants = [...entry.rawVariants];
    return {
      course: entry.course,
      courseSlug: slugByCourse.get(entry.course) ?? slugify(entry.course),
      subjectKey: entry.subjectKey,
      displayName: override?.displayName || variants[0],
      rawVariants: variants,
      paperCount: entry.paperCount,
      semesterOverride: override?.semesterOverride ?? null,
      hasOverride: Boolean(override),
      overrideId: override?.id ?? null,
    };
  });

  return rows
    .sort((a, b) => a.course.localeCompare(b.course) || a.displayName.localeCompare(b.displayName))
    .slice(0, ARCHIVE_MANUAL_MERGE_MAX_ROWS);
}
