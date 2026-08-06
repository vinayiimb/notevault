// Phase 2D verify-mode checks — read-only, run after apply.
import type { PrismaClient } from "@/generated/prisma";

export type VerifyReport = {
  counts: Record<string, number>;
  excludedModelCounts: Record<string, number>;
  orphanTerms: number;
  orphanSubjects: number;
  orphanSessionLinks: number;
  duplicateProgramSlugs: number;
  duplicateTermKeys: number;
  duplicateSubjectKeysWithinTerm: number;
  duplicateExamSessionLabels: number;
  duplicateSessionLinkKeys: number;
  ok: boolean;
  issues: string[];
};

export async function runVerification(prisma: PrismaClient): Promise<VerifyReport> {
  const issues: string[] = [];

  const [programCount, termCount, subjectCount, examSessionCount, linkCount] = await Promise.all([
    prisma.program.count(),
    prisma.term.count(),
    prisma.subject.count(),
    prisma.examSession.count(),
    prisma.sessionProgramLink.count(),
  ]);

  const excludedModels = [
    "resource", "question", "contentBlock", "subjectAnalysis", "subjectAlias", "subjectNotes",
    "noteTheme", "catalogPaperUpload", "catalogSubjectOverride", "driveSubject", "driveFileMatch",
    "admin", "student", "studentExamDate", "orangeEvent", "feedback", "failedUpload", "scanRun",
    "subjectMergeSuggestion", "subjectMergeLog",
  ] as const;
  const excludedModelCounts: Record<string, number> = {};
  for (const model of excludedModels) {
    // @ts-expect-error - dynamic model access, count() exists on every one of these delegates
    excludedModelCounts[model] = await prisma[model].count();
    if (excludedModelCounts[model] > 0) issues.push(`Excluded model "${model}" has ${excludedModelCounts[model]} unexpected row(s).`);
  }

  // Orphan checks: rely on Postgres FK constraints for structural integrity
  // (ON DELETE CASCADE means an orphan is actually impossible while the
  // constraint is enforced) — these queries confirm that assumption holds
  // rather than merely trusting it. Prisma doesn't expose a `relation: null`
  // filter for a required (non-nullable) relation, so these are raw
  // left-join existence checks instead.
  const orphanTermRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM "Term" t LEFT JOIN "Program" p ON p.id = t."programId" WHERE p.id IS NULL`,
  );
  const orphanSubjectRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM "Subject" s LEFT JOIN "Term" t ON t.id = s."termId" WHERE t.id IS NULL`,
  );
  const orphanLinkRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM "SessionProgramLink" l
       LEFT JOIN "ExamSession" es ON es.id = l."sessionId"
       LEFT JOIN "Program" p ON p.id = l."programId"
     WHERE es.id IS NULL OR p.id IS NULL`,
  );
  const orphanTermsReal = Number(orphanTermRows[0].n);
  const orphanSubjectsReal = Number(orphanSubjectRows[0].n);
  const orphanLinksReal = Number(orphanLinkRows[0].n);
  if (orphanTermsReal > 0) issues.push(`${orphanTermsReal} orphan Term row(s) found.`);
  if (orphanSubjectsReal > 0) issues.push(`${orphanSubjectsReal} orphan Subject row(s) found.`);
  if (orphanLinksReal > 0) issues.push(`${orphanLinksReal} orphan SessionProgramLink row(s) found.`);

  // Duplicate/unique-constraint checks — these should be structurally
  // impossible given the schema's @@unique constraints, but verified
  // directly rather than assumed.
  const dupProgramSlug = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM (SELECT slug FROM "Program" GROUP BY slug HAVING count(*) > 1) x`,
  );
  const dupTermKey = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM (SELECT "programId", "order" FROM "Term" GROUP BY "programId", "order" HAVING count(*) > 1) x`,
  );
  const dupSubjectKey = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM (SELECT "termId", slug FROM "Subject" GROUP BY "termId", slug HAVING count(*) > 1) x`,
  );
  const dupSessionLabel = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM (SELECT label FROM "ExamSession" GROUP BY label HAVING count(*) > 1) x`,
  );
  const dupLinkKey = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM (SELECT "sessionId", "programId", "variantLabel" FROM "SessionProgramLink" GROUP BY "sessionId", "programId", "variantLabel" HAVING count(*) > 1) x`,
  );

  const duplicateProgramSlugs = Number(dupProgramSlug[0].n);
  const duplicateTermKeys = Number(dupTermKey[0].n);
  const duplicateSubjectKeysWithinTerm = Number(dupSubjectKey[0].n);
  const duplicateExamSessionLabels = Number(dupSessionLabel[0].n);
  const duplicateSessionLinkKeys = Number(dupLinkKey[0].n);

  if (duplicateProgramSlugs > 0) issues.push(`${duplicateProgramSlugs} duplicate Program slug group(s).`);
  if (duplicateTermKeys > 0) issues.push(`${duplicateTermKeys} duplicate Term (programId, order) group(s).`);
  if (duplicateSubjectKeysWithinTerm > 0) issues.push(`${duplicateSubjectKeysWithinTerm} duplicate Subject (termId, slug) group(s).`);
  if (duplicateExamSessionLabels > 0) issues.push(`${duplicateExamSessionLabels} duplicate ExamSession label group(s).`);
  if (duplicateSessionLinkKeys > 0) issues.push(`${duplicateSessionLinkKeys} duplicate SessionProgramLink group(s).`);

  return {
    counts: { Program: programCount, Term: termCount, Subject: subjectCount, ExamSession: examSessionCount, SessionProgramLink: linkCount },
    excludedModelCounts,
    orphanTerms: orphanTermsReal,
    orphanSubjects: orphanSubjectsReal,
    orphanSessionLinks: orphanLinksReal,
    duplicateProgramSlugs,
    duplicateTermKeys,
    duplicateSubjectKeysWithinTerm,
    duplicateExamSessionLabels,
    duplicateSessionLinkKeys,
    ok: issues.length === 0,
    issues,
  };
}
