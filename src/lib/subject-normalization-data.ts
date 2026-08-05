import { prisma } from "@/lib/prisma";
import type { Prisma, SuggestionStatus } from "@/generated/prisma";

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
