import { prisma } from "@/lib/prisma";
import { canonicalSubjectKey } from "@/lib/subject-normalization";

// Transactional merge/undo core for the Subject Normalization Centre.
// Nothing here runs automatically — every call is triggered by an explicit
// admin action (see the server actions in
// src/app/admin/(dashboard)/subject-normalization/actions.ts). Files are
// never touched: a "merge" only repoints Resource/Question.subjectId and
// records history, it never moves or duplicates PDFs in storage.

export type MergePreview = {
  canonicalSubjectId: string;
  canonicalName: string;
  memberSubjectIds: string[];
  affectedResourceCount: number;
  affectedQuestionCount: number;
  urlsAffected: string[]; // /subjects/[id] paths that will start redirecting
  aliasesToCreate: { rawName: string; normalizedName: string }[];
  slugConflict: boolean;
};

/**
 * Computes what a merge would do without changing anything — powers the
 * admin review UI's "preview before applying changes" step.
 */
export async function previewMerge(
  canonicalSubjectId: string,
  memberSubjectIds: string[]
): Promise<MergePreview> {
  const otherIds = memberSubjectIds.filter((id) => id !== canonicalSubjectId);

  const [canonical, members] = await Promise.all([
    prisma.subject.findUniqueOrThrow({ where: { id: canonicalSubjectId } }),
    prisma.subject.findMany({ where: { id: { in: otherIds } } }),
  ]);

  const [resourceCount, questionCount] = await Promise.all([
    prisma.resource.count({ where: { subjectId: { in: otherIds } } }),
    prisma.question.count({ where: { subjectId: { in: otherIds } } }),
  ]);

  const canonicalKey = canonicalSubjectKey(canonical.name);
  const slugConflict = members.some(
    (m) => m.termId === canonical.termId && canonicalSubjectKey(m.name) !== canonicalKey && m.slug === canonical.slug
  );

  return {
    canonicalSubjectId,
    canonicalName: canonical.name,
    memberSubjectIds: otherIds,
    affectedResourceCount: resourceCount,
    affectedQuestionCount: questionCount,
    urlsAffected: otherIds.map((id) => `/subjects/${id}`),
    aliasesToCreate: members.map((m) => ({ rawName: m.name, normalizedName: canonicalSubjectKey(m.name) })),
    slugConflict,
  };
}

export type ApplyMergeInput = {
  canonicalSubjectId: string;
  memberSubjectIds: string[];
  administrator: string;
  confidenceScore?: number | null;
  reason?: string | null;
  isAiAssisted?: boolean;
  suggestionId?: string | null;
};

/**
 * Applies a merge: every member subject's resources/questions are
 * reassigned to the canonical subject, the member's original name is kept
 * as an approved SubjectAlias, the member row itself is marked
 * mergedIntoId (never deleted), and a SubjectMergeLog row is written with
 * enough detail (exact per-row prior subjectId) to undo precisely later.
 * All of this happens in one transaction — a failure partway through
 * leaves nothing changed.
 */
export async function applyMerge(input: ApplyMergeInput) {
  const otherIds = input.memberSubjectIds.filter((id) => id !== input.canonicalSubjectId);
  if (otherIds.length === 0) {
    throw new Error("Nothing to merge: no member subjects other than the canonical one.");
  }

  return prisma.$transaction(async (tx) => {
    const members = await tx.subject.findMany({ where: { id: { in: otherIds } } });
    if (members.length !== otherIds.length) {
      throw new Error("One or more subjects in this merge no longer exist.");
    }
    if (members.some((m) => m.mergedIntoId)) {
      throw new Error("One or more subjects in this merge have already been merged elsewhere.");
    }

    const [resources, questions, driveSubjects, examDates] = await Promise.all([
      tx.resource.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
      tx.question.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
      tx.driveSubject.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
      tx.studentExamDate.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
    ]);

    await tx.resource.updateMany({
      where: { subjectId: { in: otherIds } },
      data: { subjectId: input.canonicalSubjectId },
    });
    await tx.question.updateMany({
      where: { subjectId: { in: otherIds } },
      data: { subjectId: input.canonicalSubjectId },
    });
    // Non-cascading references — repoint these too so nothing still points
    // at a deprecated subject id.
    await tx.driveSubject.updateMany({
      where: { subjectId: { in: otherIds } },
      data: { subjectId: input.canonicalSubjectId },
    });
    await tx.studentExamDate.updateMany({
      where: { subjectId: { in: otherIds } },
      data: { subjectId: input.canonicalSubjectId },
    });

    for (const member of members) {
      const normalizedName = canonicalSubjectKey(member.name);
      await tx.subjectAlias.upsert({
        where: { canonicalSubjectId_normalizedName: { canonicalSubjectId: input.canonicalSubjectId, normalizedName } },
        create: {
          canonicalSubjectId: input.canonicalSubjectId,
          rawName: member.name,
          normalizedName,
          source: input.isAiAssisted ? "AI" : "ADMIN",
          confidenceScore: input.confidenceScore ?? null,
          approvedBy: input.administrator,
          approvedAt: new Date(),
        },
        update: {},
      });
      // Carry forward any aliases the member itself already had.
      for (const alias of member.aliases) {
        const aliasKey = canonicalSubjectKey(alias);
        if (!aliasKey) continue;
        await tx.subjectAlias.upsert({
          where: { canonicalSubjectId_normalizedName: { canonicalSubjectId: input.canonicalSubjectId, normalizedName: aliasKey } },
          create: {
            canonicalSubjectId: input.canonicalSubjectId,
            rawName: alias,
            normalizedName: aliasKey,
            source: "IMPORT",
            approvedBy: input.administrator,
            approvedAt: new Date(),
          },
          update: {},
        });
      }
    }

    await tx.subject.updateMany({
      where: { id: { in: otherIds } },
      data: { mergedIntoId: input.canonicalSubjectId },
    });

    const log = await tx.subjectMergeLog.create({
      data: {
        previousCanonicalSubjectId: otherIds[0],
        newCanonicalSubjectId: input.canonicalSubjectId,
        affectedResourceIds: resources.map((r) => r.id),
        affectedQuestionIds: questions.map((q) => q.id),
        reassignments: {
          resources: resources.map((r) => ({ id: r.id, prevSubjectId: r.subjectId })),
          questions: questions.map((q) => ({ id: q.id, prevSubjectId: q.subjectId })),
          driveSubjects: driveSubjects.map((d) => ({ id: d.id, prevSubjectId: d.subjectId })),
          examDates: examDates.map((e) => ({ id: e.id, prevSubjectId: e.subjectId })),
          mergedSubjectIds: otherIds,
        },
        administrator: input.administrator,
        confidenceScore: input.confidenceScore ?? null,
        reason: input.reason ?? null,
        isAiAssisted: input.isAiAssisted ?? false,
      },
    });

    if (input.suggestionId) {
      await tx.subjectMergeSuggestion.update({
        where: { id: input.suggestionId },
        data: { status: "MERGED", reviewedBy: input.administrator, reviewedAt: new Date() },
      });
    }

    return log;
  });
}

/**
 * Reverses a merge: every resource/question is moved back to its exact
 * prior subjectId (from the snapshot taken at merge time, not a guess),
 * merged subjects are un-flagged, and their aliases created by this merge
 * are removed. Marks the log undone rather than deleting it — the merge
 * itself stays in the audit trail either way.
 */
export async function undoMerge(logId: string, administrator: string) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.subjectMergeLog.findUniqueOrThrow({ where: { id: logId } });
    if (log.undoneAt) {
      throw new Error("This merge has already been undone.");
    }

    const snapshot = log.reassignments as {
      resources: { id: string; prevSubjectId: string }[];
      questions: { id: string; prevSubjectId: string }[];
      driveSubjects: { id: string; prevSubjectId: string }[];
      examDates: { id: string; prevSubjectId: string }[];
      mergedSubjectIds: string[];
    };

    for (const r of snapshot.resources) {
      await tx.resource.update({ where: { id: r.id }, data: { subjectId: r.prevSubjectId } });
    }
    for (const q of snapshot.questions) {
      await tx.question.update({ where: { id: q.id }, data: { subjectId: q.prevSubjectId } });
    }
    for (const d of snapshot.driveSubjects ?? []) {
      await tx.driveSubject.update({ where: { id: d.id }, data: { subjectId: d.prevSubjectId } });
    }
    for (const e of snapshot.examDates ?? []) {
      await tx.studentExamDate.update({ where: { id: e.id }, data: { subjectId: e.prevSubjectId } });
    }

    await tx.subject.updateMany({
      where: { id: { in: snapshot.mergedSubjectIds } },
      data: { mergedIntoId: null },
    });

    const members = await tx.subject.findMany({ where: { id: { in: snapshot.mergedSubjectIds } } });
    for (const member of members) {
      const normalizedName = canonicalSubjectKey(member.name);
      await tx.subjectAlias.deleteMany({
        where: { canonicalSubjectId: log.newCanonicalSubjectId, normalizedName },
      });
    }

    await tx.subjectMergeLog.update({
      where: { id: logId },
      data: { undoneAt: new Date(), undoneBy: administrator },
    });

    return log;
  });
}
