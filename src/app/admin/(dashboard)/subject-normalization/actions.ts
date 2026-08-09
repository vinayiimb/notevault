"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { computeCandidateGroups, type GroupableSubject } from "@/lib/subject-grouping";
import { suggestSubjectGrouping } from "@/lib/ai";
import { applyMerge, previewMerge, undoMerge } from "@/lib/subject-merge";
import { searchSubjectsForManualMerge, type ManualMergeSubjectFilters } from "@/lib/subject-normalization-data";
import { slugify } from "@/lib/utils";

async function requireAdmin() {
  const session = await getSession();
  if (!session) throw new Error("Unauthorized");
  return session;
}

const PATH = "/admin/subject-normalization";

// ---------- Batch scan ----------

export type ScanScopeInput =
  | { scope: "ALL" }
  | { scope: "PROGRAM"; programId: string }
  | { scope: "TERM"; termId: string }
  | { scope: "UNMAPPED" }
  | { scope: "SELECTED"; subjectIds: string[] };

/**
 * "Scan Archive with AI" — Stage A runs over every subject in scope for
 * free; only uncertain fuzzy clusters are sent to Stage B (one small
 * cluster per AI call, per src/lib/ai.ts's token-budget notes). Processes
 * one Term at a time so a failure partway through only loses that term's
 * batch, not the whole run — and re-running is safe: existing PENDING
 * suggestions for an unchanged group are left alone rather than duplicated.
 */
export async function scanArchiveAction(input: ScanScopeInput) {
  await requireAdmin();

  const termWhere =
    input.scope === "TERM"
      ? { id: input.termId }
      : input.scope === "PROGRAM"
        ? { programId: input.programId }
        : {};

  const terms =
    input.scope === "SELECTED"
      ? await prisma.term.findMany({
          where: { subjects: { some: { id: { in: input.subjectIds } } } },
        })
      : await prisma.term.findMany({ where: termWhere });

  const run = await prisma.scanRun.create({
    data: {
      scope: input.scope,
      programId: input.scope === "PROGRAM" ? input.programId : null,
      termId: input.scope === "TERM" ? input.termId : null,
      status: "RUNNING",
      startedAt: new Date(),
    },
  });

  let processedSubjects = 0;
  let groupsFound = 0;
  let suggestionsCreated = 0;
  let failedCount = 0;

  try {
    for (const term of terms) {
      const subjectWhere =
        input.scope === "SELECTED"
          ? { termId: term.id, id: { in: input.subjectIds }, mergedIntoId: null }
          : input.scope === "UNMAPPED"
            ? { termId: term.id, mergedIntoId: null, upc: null }
            : { termId: term.id, mergedIntoId: null };

      const subjects = await prisma.subject.findMany({ where: subjectWhere });
      processedSubjects += subjects.length;
      if (subjects.length < 2) continue;

      const program = await prisma.program.findUnique({ where: { id: term.programId } });

      const groupable: GroupableSubject[] = subjects.map((s) => ({ id: s.id, name: s.name, upc: s.upc, aliases: s.aliases }));
      const { exactGroups, fuzzyGroups } = computeCandidateGroups(groupable);
      groupsFound += exactGroups.length + fuzzyGroups.length;

      const subjectsById = new Map(subjects.map((s) => [s.id, s]));

      for (const group of exactGroups) {
        const created = await createSuggestionIfNew({
          termId: term.id,
          subjectIds: group.subjectIds,
          suggestedName: pickBestName(group.subjectIds.map((id) => subjectsById.get(id)!.name)),
          confidenceScore: group.score,
          explanation: "Exact match after normalizing case, spacing, punctuation, and numbering style.",
          relationship: "SPELLING_VARIATION",
          safeToMerge: true,
          warnings: [],
          source: "IMPORT",
        });
        if (created) suggestionsCreated += 1;
      }

      // Only the uncertain clusters go to the AI, one cluster per call.
      for (const group of fuzzyGroups) {
        try {
          const candidates = group.subjectIds.map((id) => {
            const s = subjectsById.get(id)!;
            return {
              id: s.id,
              name: s.name,
              upc: s.upc,
              paperType: s.paperType,
              programName: program?.name ?? "Unknown",
              termName: term.name,
            };
          });
          const result = await suggestSubjectGrouping(candidates);
          if (!result.ok) {
            failedCount += 1;
            continue;
          }
          if (result.data.memberSubjectIds.length < 2) continue; // AI decided these are separate

          const created = await createSuggestionIfNew({
            termId: term.id,
            subjectIds: result.data.memberSubjectIds,
            suggestedName: result.data.suggestedCanonicalName,
            confidenceScore: result.data.confidenceScore,
            explanation: result.data.explanation,
            relationship: result.data.relationship,
            safeToMerge: result.data.safeToMerge,
            warnings: result.data.warnings,
            source: "AI",
          });
          if (created) suggestionsCreated += 1;
        } catch {
          failedCount += 1;
        }
      }

      await prisma.scanRun.update({
        where: { id: run.id },
        data: { processedSubjects, groupsFound, suggestionsCreated, failedCount },
      });
    }

    await prisma.scanRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        totalSubjects: processedSubjects,
        processedSubjects,
        groupsFound,
        suggestionsCreated,
        failedCount,
      },
    });
  } catch (err) {
    await prisma.scanRun.update({
      where: { id: run.id },
      data: { status: "FAILED", errorMessage: err instanceof Error ? err.message : "Unknown error" },
    });
    throw err;
  }

  revalidatePath(PATH);
  return { runId: run.id, processedSubjects, groupsFound, suggestionsCreated, failedCount };
}

function pickBestName(names: string[]): string {
  // Prefer the least-shouty, most normally-capitalized variant.
  const sorted = [...names].sort((a, b) => {
    const aScore = a === a.toUpperCase() ? 1 : 0;
    const bScore = b === b.toUpperCase() ? 1 : 0;
    return aScore - bScore || a.length - b.length;
  });
  return sorted[0];
}

async function createSuggestionIfNew(input: {
  termId: string;
  subjectIds: string[];
  suggestedName: string;
  confidenceScore: number;
  explanation: string;
  relationship: "EXACT_DUPLICATE" | "SPELLING_VARIATION" | "ABBREVIATION" | "RENAMED_SYLLABUS" | "RELATED_BUT_SEPARATE";
  safeToMerge: boolean;
  warnings: string[];
  source: "IMPORT" | "ADMIN" | "AI";
}) {
  const sortedIds = [...input.subjectIds].sort();

  // Cheap de-dupe: skip creating a near-identical pending suggestion for the
  // same set of subjects (re-scans are meant to be safe to re-run).
  const existingPending = await prisma.subjectMergeSuggestion.findMany({
    where: { termId: input.termId, status: "PENDING" },
    select: { id: true, subjectIds: true },
  });
  if (existingPending.some((d) => sameIds(d.subjectIds, sortedIds))) return false;

  await prisma.subjectMergeSuggestion.create({
    data: {
      termId: input.termId,
      suggestedName: input.suggestedName,
      subjectIds: sortedIds,
      confidenceScore: input.confidenceScore,
      explanation: input.explanation,
      relationship: input.relationship,
      safeToMerge: input.safeToMerge,
      warnings: input.warnings,
      source: input.source,
    },
  });
  return true;
}

function sameIds(a: string[], b: string[]) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].sort();
  const sortedB = [...b].sort();
  return sortedA.every((id, i) => id === sortedB[i]);
}

// ---------- Review actions ----------

export async function approveSuggestionAction(suggestionId: string) {
  const admin = await requireAdmin();
  await prisma.subjectMergeSuggestion.update({
    where: { id: suggestionId },
    data: { status: "APPROVED", reviewedBy: admin.adminId, reviewedAt: new Date() },
  });
  revalidatePath(PATH);
}

export async function ignoreSuggestionAction(suggestionId: string) {
  const admin = await requireAdmin();
  await prisma.subjectMergeSuggestion.update({
    where: { id: suggestionId },
    data: { status: "IGNORED", reviewedBy: admin.adminId, reviewedAt: new Date() },
  });
  revalidatePath(PATH);
}

export async function markSeparateAction(suggestionId: string) {
  const admin = await requireAdmin();
  await prisma.subjectMergeSuggestion.update({
    where: { id: suggestionId },
    data: { status: "REJECTED", reviewedBy: admin.adminId, reviewedAt: new Date() },
  });
  revalidatePath(PATH);
}

export async function editSuggestionNameAction(suggestionId: string, newName: string) {
  await requireAdmin();
  const name = newName.trim();
  if (!name) throw new Error("Canonical name can't be empty.");
  await prisma.subjectMergeSuggestion.update({ where: { id: suggestionId }, data: { suggestedName: name } });
  revalidatePath(PATH);
}

export async function removeItemFromSuggestionAction(suggestionId: string, subjectId: string) {
  await requireAdmin();
  const suggestion = await prisma.subjectMergeSuggestion.findUniqueOrThrow({ where: { id: suggestionId } });
  const remaining = suggestion.subjectIds.filter((id) => id !== subjectId);
  if (remaining.length < 2) {
    await prisma.subjectMergeSuggestion.update({ where: { id: suggestionId }, data: { status: "IGNORED" } });
  } else {
    await prisma.subjectMergeSuggestion.update({ where: { id: suggestionId }, data: { subjectIds: remaining } });
  }
  revalidatePath(PATH);
}

// ---------- Preview / merge / undo ----------

export async function previewMergeAction(canonicalSubjectId: string, memberSubjectIds: string[]) {
  await requireAdmin();
  return previewMerge(canonicalSubjectId, memberSubjectIds);
}

export async function mergeSuggestionAction(
  suggestionId: string,
  canonicalSubjectId: string,
  memberSubjectIds: string[]
) {
  const admin = await requireAdmin();
  const suggestion = await prisma.subjectMergeSuggestion.findUnique({ where: { id: suggestionId } });
  const log = await applyMerge({
    canonicalSubjectId,
    memberSubjectIds,
    administrator: admin.adminId,
    confidenceScore: suggestion?.confidenceScore ?? null,
    reason: suggestion?.explanation ?? null,
    isAiAssisted: suggestion?.source === "AI",
    suggestionId,
  });
  revalidatePath(PATH);
  return log;
}

export async function undoMergeAction(logId: string) {
  const admin = await requireAdmin();
  const log = await undoMerge(logId, admin.adminId);
  revalidatePath(PATH);
  return log;
}

// ---------- Manual Merge tab ----------

export async function searchSubjectsForManualMergeAction(filters: ManualMergeSubjectFilters) {
  await requireAdmin();
  return searchSubjectsForManualMerge(filters);
}

/**
 * Applies a merge picked manually (search + checkbox select), not from an
 * AI/deterministic suggestion — same underlying applyMerge, just no
 * suggestionId/confidence/AI-source metadata to carry over.
 */
export async function manualMergeAction(canonicalSubjectId: string, memberSubjectIds: string[]) {
  const admin = await requireAdmin();
  const log = await applyMerge({
    canonicalSubjectId,
    memberSubjectIds,
    administrator: admin.adminId,
    reason: "Manual merge (admin-selected, not AI/deterministic-suggested).",
    isAiAssisted: false,
  });
  revalidatePath(PATH);
  return log;
}

// ---------- Parent/child grouping ----------

/**
 * "Create parent subject" — for cases like Financial Accounting I/II that
 * must stay separate but share a browsing umbrella. Unlike a merge, no
 * resources move and no alias is created; the children remain independent,
 * fully real subjects, just linked under a new parent row.
 */
export async function createParentSubjectAction(termId: string, parentName: string, childSubjectIds: string[]) {
  await requireAdmin();
  const name = parentName.trim();
  if (!name) throw new Error("Parent subject name can't be empty.");

  const baseSlug = slugify(name) || "subject";
  let slug = baseSlug;
  let i = 1;
  while (await prisma.subject.findUnique({ where: { termId_slug: { termId, slug } } })) {
    i += 1;
    slug = `${baseSlug}-${i}`;
  }

  const parent = await prisma.subject.create({
    data: { termId, name, slug },
  });

  await prisma.subject.updateMany({
    where: { id: { in: childSubjectIds } },
    data: { parentSubjectId: parent.id },
  });

  revalidatePath(PATH);
  return parent;
}
