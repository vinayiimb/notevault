import { prisma } from "@/lib/prisma";
import type { Prisma, SuggestionStatus } from "@prisma/client";

// Read-side queries for the Subject Normalization Centre admin page —
// mirrors the shape of src/lib/data.ts's other admin data-fetching helpers.

export type NormalizationStats = {
  totalRawSubjects: number;
  suggestedGroups: number;
  alreadyNormalized: number;
  unreviewedSuggestions: number;
  lowConfidenceSuggestions: number;
  recentlyMerged: number;
};

export async function getNormalizationStats(): Promise<NormalizationStats> {
  const [totalRawSubjects, suggestedGroups, alreadyNormalized, unreviewedSuggestions, lowConfidenceSuggestions, recentlyMerged] =
    await Promise.all([
      prisma.subject.count({ where: { mergedIntoId: null } }),
      prisma.subjectMergeSuggestion.count({ where: { status: "PENDING" } }),
      prisma.subjectAlias.groupBy({ by: ["canonicalSubjectId"] }).then((rows) => rows.length),
      prisma.subjectMergeSuggestion.count({ where: { status: "PENDING" } }),
      prisma.subjectMergeSuggestion.count({ where: { status: "PENDING", confidenceScore: { lt: 60 } } }),
      prisma.subjectMergeLog.count({
        where: { undoneAt: null, createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      }),
    ]);

  return {
    totalRawSubjects,
    suggestedGroups,
    alreadyNormalized,
    unreviewedSuggestions,
    lowConfidenceSuggestions,
    recentlyMerged,
  };
}

export type SuggestionFilters = {
  programId?: string;
  termId?: string;
  subjectType?: string;
  status?: SuggestionStatus;
  minConfidence?: number;
  maxConfidence?: number;
};

export async function getSuggestions(filters: SuggestionFilters = {}) {
  const where: Prisma.SubjectMergeSuggestionWhereInput = {
    status: filters.status ?? undefined,
    termId: filters.termId,
    term: filters.programId ? { programId: filters.programId } : undefined,
    confidenceScore:
      filters.minConfidence !== undefined || filters.maxConfidence !== undefined
        ? { gte: filters.minConfidence, lte: filters.maxConfidence }
        : undefined,
  };

  const suggestions = await prisma.subjectMergeSuggestion.findMany({
    where,
    include: { term: { include: { program: true } } },
    orderBy: [{ status: "asc" }, { confidenceScore: "asc" }, { createdAt: "desc" }],
    take: 200,
  });

  // Hydrate member subjects for each suggestion (subjectIds is a plain
  // string[] column, not a relation, so this is a manual join).
  const allSubjectIds = [...new Set(suggestions.flatMap((s) => s.subjectIds))];
  const subjects = await prisma.subject.findMany({
    where: { id: { in: allSubjectIds } },
    include: {
      _count: { select: { resources: true, questions: true } },
    },
  });
  const subjectsById = new Map(subjects.map((s) => [s.id, s]));

  return suggestions
    .filter((s) => filters.subjectType === undefined || s.subjectIds.some((id) => subjectsById.get(id)?.paperType === filters.subjectType))
    .map((s) => ({
      ...s,
      members: s.subjectIds.map((id) => subjectsById.get(id)).filter((s): s is NonNullable<typeof s> => Boolean(s)),
    }));
}

export async function getRecentMergeLogs(limit = 20) {
  return prisma.subjectMergeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getProgramsWithTerms() {
  return prisma.program.findMany({
    include: { terms: { orderBy: { order: "asc" } } },
    orderBy: { name: "asc" },
  });
}

export async function getScanRuns(limit = 10) {
  return prisma.scanRun.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export type ManualMergeSubjectFilters = {
  programId?: string;
  termId?: string;
  query?: string;
  limit?: number; // capped below regardless of what's passed
};

const MANUAL_MERGE_MAX_LIMIT = 100;

/**
 * Scoped, bounded subject listing for the Manual Merge tab — never an
 * unrestricted findMany over all 7,650+ subjects. Requires at least a
 * programId or a non-trivial search query; an empty/unscoped call returns
 * nothing rather than the whole catalogue.
 */
export async function searchSubjectsForManualMerge(filters: ManualMergeSubjectFilters) {
  const query = filters.query?.trim() ?? "";
  if (!filters.programId && !filters.termId && query.length < 2) return [];

  const where: Prisma.SubjectWhereInput = {
    mergedIntoId: null,
    termId: filters.termId,
    term: filters.termId ? undefined : filters.programId ? { programId: filters.programId } : undefined,
    name: query ? { contains: query, mode: "insensitive" } : undefined,
  };

  const subjects = await prisma.subject.findMany({
    where,
    select: {
      id: true,
      name: true,
      slug: true,
      upc: true,
      mergedIntoId: true,
      term: { select: { id: true, name: true, program: { select: { id: true, name: true } } } },
      _count: { select: { questions: true, subjectAliases: true } },
    },
    orderBy: { name: "asc" },
    take: Math.min(filters.limit ?? MANUAL_MERGE_MAX_LIMIT, MANUAL_MERGE_MAX_LIMIT),
  });
  if (subjects.length === 0) return [];

  // PYQ vs NOTES resource counts, split out separately (the manual-merge
  // table shows them as distinct columns) — one bounded groupBy over the
  // already-limited subject id list, not a scan of the Resource table.
  const subjectIds = subjects.map((s) => s.id);
  const resourceCounts = await prisma.resource.groupBy({
    by: ["subjectId", "type"],
    where: { subjectId: { in: subjectIds } },
    _count: { _all: true },
  });
  const pyqCountBySubject = new Map<string, number>();
  const notesCountBySubject = new Map<string, number>();
  for (const row of resourceCounts) {
    const target = row.type === "PYQ" ? pyqCountBySubject : notesCountBySubject;
    target.set(row.subjectId, row._count._all);
  }

  return subjects.map((s) => ({
    ...s,
    pyqCount: pyqCountBySubject.get(s.id) ?? 0,
    notesCount: notesCountBySubject.get(s.id) ?? 0,
  }));
}
