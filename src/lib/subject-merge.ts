import { prisma } from "@/lib/prisma";
import { canonicalSubjectKey } from "@/lib/subject-normalization";

// Transactional merge/undo core for the Subject Normalization Centre (aka
// "Master Mapping"). Nothing here runs automatically — every call is
// triggered by an explicit admin action (see the server actions in
// src/app/admin/(dashboard)/subject-normalization/actions.ts). Files are
// never touched: a "merge" only repoints foreign keys and records history,
// it never moves or duplicates PDFs in storage.
//
// Every table with a subjectId FK (inspected directly against
// prisma/schema.prisma, not assumed) is handled here:
//   Resource, Question, DriveSubject, StudentExamDate, NoteTheme,
//   SubjectMatchMemory — plain reassignment, no uniqueness risk.
//   SubjectNotes, SubjectAnalysis — 1:1 per subject (subjectId @unique).
//     If more than one row exists across {canonical, ...members} for either
//     of these, a merge would violate the unique constraint by silently
//     dropping one — previewMerge detects this as a blocking conflict and
//     applyMerge refuses to proceed rather than lose data.
//   Subject.parentSubjectId — children of a merged-away subject are
//     re-pointed to the canonical subject so the hierarchy survives too.

export type RelationCounts = {
  resources: number;
  questions: number;
  driveSubjects: number;
  examDates: number;
  noteThemes: number;
  matchMemories: number;
  subjectNotes: number;
  subjectAnalysis: number;
  childSubjects: number;
};

function sumCounts(c: RelationCounts): number {
  return (
    c.resources + c.questions + c.driveSubjects + c.examDates + c.noteThemes + c.matchMemories + c.subjectNotes + c.subjectAnalysis + c.childSubjects
  );
}

export type MergePreview = {
  canonicalSubjectId: string;
  canonicalName: string;
  memberSubjectIds: string[];
  before: RelationCounts;
  totalLinkedRecordsBefore: number;
  totalLinkedRecordsAfterExpected: number;
  expectedDataLoss: number;
  urlsAffected: string[]; // /subjects/[id] paths that will start redirecting
  aliasesToCreate: { rawName: string; normalizedName: string }[];
  slugConflict: boolean;
  conflicts: string[];
  blocked: boolean;
};

/**
 * Computes what a merge would do without changing anything — powers the
 * admin review UI's "preview before applying changes" step. Never partial:
 * if a 1:1 relation (SubjectNotes/SubjectAnalysis) would collide, this
 * reports it as a blocking conflict rather than silently picking a winner.
 */
export async function previewMerge(
  canonicalSubjectId: string,
  memberSubjectIds: string[]
): Promise<MergePreview> {
  const otherIds = memberSubjectIds.filter((id) => id !== canonicalSubjectId);
  const allIds = [canonicalSubjectId, ...otherIds];

  const [canonical, members] = await Promise.all([
    prisma.subject.findUniqueOrThrow({ where: { id: canonicalSubjectId } }),
    prisma.subject.findMany({ where: { id: { in: otherIds } } }),
  ]);

  const [
    resourceCount,
    questionCount,
    driveSubjectCount,
    examDateCount,
    noteThemeCount,
    matchMemoryCount,
    childSubjectCount,
    memberNotesCount,
    memberAnalysisCount,
    subjectNotesAll,
    subjectAnalysisAll,
  ] = await Promise.all([
    prisma.resource.count({ where: { subjectId: { in: otherIds } } }),
    prisma.question.count({ where: { subjectId: { in: otherIds } } }),
    prisma.driveSubject.count({ where: { subjectId: { in: otherIds } } }),
    prisma.studentExamDate.count({ where: { subjectId: { in: otherIds } } }),
    prisma.noteTheme.count({ where: { subjectId: { in: otherIds } } }),
    prisma.subjectMatchMemory.count({ where: { subjectId: { in: otherIds } } }),
    prisma.subject.count({ where: { parentSubjectId: { in: otherIds } } }),
    // "before" counts for the two 1:1 relations reflect only what's moving
    // from members (for the record-count display) — separate from the
    // group-wide totals below, which is what actually decides conflicts.
    prisma.subjectNotes.count({ where: { subjectId: { in: otherIds } } }),
    prisma.subjectAnalysis.count({ where: { subjectId: { in: otherIds } } }),
    // 1:1 relations checked across the WHOLE group (canonical + members) —
    // a collision is possible even if the canonical itself already has one.
    prisma.subjectNotes.count({ where: { subjectId: { in: allIds } } }),
    prisma.subjectAnalysis.count({ where: { subjectId: { in: allIds } } }),
  ]);

  const before: RelationCounts = {
    resources: resourceCount,
    questions: questionCount,
    driveSubjects: driveSubjectCount,
    examDates: examDateCount,
    noteThemes: noteThemeCount,
    matchMemories: matchMemoryCount,
    subjectNotes: memberNotesCount,
    subjectAnalysis: memberAnalysisCount,
    childSubjects: childSubjectCount,
  };

  const conflicts: string[] = [];
  if (subjectNotesAll > 1) {
    conflicts.push(
      `${subjectNotesAll} of the subjects in this group each have their own compiled notes (SubjectNotes) — merging would violate the one-notes-per-subject rule. Remove or consolidate notes manually before merging.`,
    );
  }
  if (subjectAnalysisAll > 1) {
    conflicts.push(
      `${subjectAnalysisAll} of the subjects in this group each have their own AI subject analysis — merging would violate the one-analysis-per-subject rule. Regenerate analysis for the canonical subject after merging instead.`,
    );
  }

  const canonicalKey = canonicalSubjectKey(canonical.name);
  const slugConflict = members.some(
    (m) => m.termId === canonical.termId && canonicalSubjectKey(m.name) !== canonicalKey && m.slug === canonical.slug
  );

  const totalLinkedRecordsBefore = sumCounts(before);

  return {
    canonicalSubjectId,
    canonicalName: canonical.name,
    memberSubjectIds: otherIds,
    before,
    totalLinkedRecordsBefore,
    // Nothing is ever deleted by this merge — every moved record still
    // exists, just repointed. Expected-after equals expected-before unless
    // blocked (in which case the merge cannot run at all).
    totalLinkedRecordsAfterExpected: totalLinkedRecordsBefore,
    expectedDataLoss: 0,
    urlsAffected: otherIds.map((id) => `/subjects/${id}`),
    aliasesToCreate: members.map((m) => ({ rawName: m.name, normalizedName: canonicalSubjectKey(m.name) })),
    slugConflict,
    conflicts,
    blocked: conflicts.length > 0,
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
 * Applies a merge: every member subject's resources/questions/etc. are
 * reassigned to the canonical subject, the member's original name is kept
 * as an approved SubjectAlias, the member row itself is marked
 * mergedIntoId (never deleted), and a SubjectMergeLog row is written with
 * enough detail (exact per-row prior subjectId, for every affected table)
 * to undo precisely later. All of this happens in one transaction — a
 * failure partway through leaves nothing changed.
 *
 * Idempotent: re-applying the exact same (canonical, members) merge that
 * already succeeded is a safe no-op that returns the original log, not an
 * error and not a duplicate. A member merged into a *different* canonical
 * is a genuine conflict and still throws.
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

    // Idempotency: if every member is already merged into this exact
    // canonical, return the prior log instead of erroring or redoing work.
    if (members.every((m) => m.mergedIntoId === input.canonicalSubjectId)) {
      const priorLog = await tx.subjectMergeLog.findFirst({
        where: { newCanonicalSubjectId: input.canonicalSubjectId, undoneAt: null },
        orderBy: { createdAt: "desc" },
      });
      if (priorLog) return priorLog;
      // Fallthrough (no log found — e.g. merged by some other path):
      // nothing left to move, but no log to return either. Treat as a
      // conflict rather than silently fabricating a log.
      throw new Error("These subjects are already merged into the canonical subject, but no merge log was found to confirm it. Investigate before retrying.");
    }
    if (members.some((m) => m.mergedIntoId && m.mergedIntoId !== input.canonicalSubjectId)) {
      throw new Error("One or more subjects in this merge have already been merged into a different canonical subject.");
    }

    // Re-check the 1:1-relation collision guard inside the transaction too
    // — previewMerge's check is advisory (read-only, can go stale between
    // preview and confirm); this is the one that actually blocks a write.
    const allIds = [input.canonicalSubjectId, ...otherIds];
    const [subjectNotesAll, subjectAnalysisAll] = await Promise.all([
      tx.subjectNotes.count({ where: { subjectId: { in: allIds } } }),
      tx.subjectAnalysis.count({ where: { subjectId: { in: allIds } } }),
    ]);
    if (subjectNotesAll > 1 || subjectAnalysisAll > 1) {
      throw new Error(
        "Merge blocked: multiple subjects in this group each have their own compiled notes or AI analysis. Resolve that conflict before merging — nothing was changed.",
      );
    }

    const [resources, questions, driveSubjects, examDates, noteThemes, matchMemories, subjectNotes, subjectAnalysis, childSubjects] =
      await Promise.all([
        tx.resource.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.question.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.driveSubject.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.studentExamDate.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.noteTheme.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.subjectMatchMemory.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.subjectNotes.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.subjectAnalysis.findMany({ where: { subjectId: { in: otherIds } }, select: { id: true, subjectId: true } }),
        tx.subject.findMany({ where: { parentSubjectId: { in: otherIds } }, select: { id: true, parentSubjectId: true } }),
      ]);

    await tx.resource.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    await tx.question.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    await tx.driveSubject.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    await tx.studentExamDate.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    await tx.noteTheme.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    await tx.subjectMatchMemory.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    // Safe to blanket-update: the pre-transaction count guard above already
    // guarantees at most one SubjectNotes/SubjectAnalysis row exists across
    // the whole group, so at most one row is touched by each of these.
    await tx.subjectNotes.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    await tx.subjectAnalysis.updateMany({ where: { subjectId: { in: otherIds } }, data: { subjectId: input.canonicalSubjectId } });
    // Children of a merged-away subject follow it to the new canonical
    // parent — the hierarchy survives the merge too.
    await tx.subject.updateMany({ where: { parentSubjectId: { in: otherIds } }, data: { parentSubjectId: input.canonicalSubjectId } });

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
          noteThemes: noteThemes.map((n) => ({ id: n.id, prevSubjectId: n.subjectId })),
          matchMemories: matchMemories.map((m) => ({ id: m.id, prevSubjectId: m.subjectId })),
          subjectNotes: subjectNotes.map((n) => ({ id: n.id, prevSubjectId: n.subjectId })),
          subjectAnalysis: subjectAnalysis.map((a) => ({ id: a.id, prevSubjectId: a.subjectId })),
          childSubjects: childSubjects.map((c) => ({ id: c.id, prevParentSubjectId: c.parentSubjectId })),
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

type ReassignmentSnapshot = {
  resources: { id: string; prevSubjectId: string }[];
  questions: { id: string; prevSubjectId: string }[];
  driveSubjects: { id: string; prevSubjectId: string }[];
  examDates: { id: string; prevSubjectId: string }[];
  noteThemes?: { id: string; prevSubjectId: string }[];
  matchMemories?: { id: string; prevSubjectId: string }[];
  subjectNotes?: { id: string; prevSubjectId: string }[];
  subjectAnalysis?: { id: string; prevSubjectId: string }[];
  childSubjects?: { id: string; prevParentSubjectId: string }[];
  mergedSubjectIds: string[];
};

/**
 * Reverses a merge: every relation is moved back to its exact prior
 * subjectId/parentSubjectId (from the snapshot taken at merge time, not a
 * guess), merged subjects are un-flagged, and the aliases created by this
 * merge are removed. Marks the log undone rather than deleting it — the
 * merge itself stays in the audit trail either way.
 *
 * Snapshots written before the noteThemes/matchMemories/subjectNotes/
 * subjectAnalysis/childSubjects fields existed simply won't have them
 * (optional fields, `?? []` below) — undoing an old merge still correctly
 * restores everything that snapshot actually captured.
 */
export async function undoMerge(logId: string, administrator: string) {
  return prisma.$transaction(async (tx) => {
    const log = await tx.subjectMergeLog.findUniqueOrThrow({ where: { id: logId } });
    if (log.undoneAt) {
      throw new Error("This merge has already been undone.");
    }

    const snapshot = log.reassignments as ReassignmentSnapshot;

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
    for (const n of snapshot.noteThemes ?? []) {
      await tx.noteTheme.update({ where: { id: n.id }, data: { subjectId: n.prevSubjectId } });
    }
    for (const m of snapshot.matchMemories ?? []) {
      await tx.subjectMatchMemory.update({ where: { id: m.id }, data: { subjectId: m.prevSubjectId } });
    }
    for (const n of snapshot.subjectNotes ?? []) {
      await tx.subjectNotes.update({ where: { id: n.id }, data: { subjectId: n.prevSubjectId } });
    }
    for (const a of snapshot.subjectAnalysis ?? []) {
      await tx.subjectAnalysis.update({ where: { id: a.id }, data: { subjectId: a.prevSubjectId } });
    }
    for (const c of snapshot.childSubjects ?? []) {
      await tx.subject.update({ where: { id: c.id }, data: { parentSubjectId: c.prevParentSubjectId } });
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
