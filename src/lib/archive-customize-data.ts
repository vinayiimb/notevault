import "server-only";
import { prisma } from "@/lib/prisma";
import { getFullPyqCatalog, getCatalogCourses } from "@/lib/pyq-catalog";
import { canonicalSubjectKey } from "@/lib/subject-normalization";
import { computeCandidateGroups, type GroupableSubject } from "@/lib/subject-grouping";

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
