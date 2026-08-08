// Phase 3 resource verify-mode checks — read-only, run after a resource
// apply (which has not happened yet — see docs/PHASE_3_RESOURCE_IMPORT_PLAN.md).
// Mirrors verify.ts's shape for the Resource model specifically.
import type { PrismaClient } from "@/generated/prisma";

export type ResourceVerifyReport = {
  resourceCount: number;
  orphanResources: number;
  duplicateSourceJsonNames: number;
  resourcesMissingFileUrl: number;
  ok: boolean;
  issues: string[];
};

export async function runResourceVerification(prisma: PrismaClient): Promise<ResourceVerifyReport> {
  const issues: string[] = [];

  const resourceCount = await prisma.resource.count();

  const orphanRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM "Resource" r LEFT JOIN "Subject" s ON s.id = r."subjectId" WHERE s.id IS NULL`,
  );
  const orphanResources = Number(orphanRows[0]?.n ?? 0);
  if (orphanResources > 0) issues.push(`${orphanResources} Resource row(s) reference a Subject that no longer exists.`);

  const dupRows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
    `SELECT count(*)::bigint as n FROM (
       SELECT "sourceJsonName" FROM "Resource" WHERE "sourceJsonName" IS NOT NULL
       GROUP BY "sourceJsonName" HAVING count(*) > 1
     ) d`,
  );
  const duplicateSourceJsonNames = Number(dupRows[0]?.n ?? 0);
  if (duplicateSourceJsonNames > 0) issues.push(`${duplicateSourceJsonNames} duplicate sourceJsonName group(s) — should be impossible given the @unique constraint.`);

  const missingUrlCount = await prisma.resource.count({ where: { fileUrl: "" } });
  if (missingUrlCount > 0) issues.push(`${missingUrlCount} Resource row(s) have an empty fileUrl.`);

  return {
    resourceCount,
    orphanResources,
    duplicateSourceJsonNames,
    resourcesMissingFileUrl: missingUrlCount,
    ok: issues.length === 0,
    issues,
  };
}
