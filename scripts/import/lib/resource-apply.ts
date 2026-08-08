// Phase 3 resource apply-mode execution — mirrors apply.ts's shape
// (chunked transactions, insert-status outcomes only). NOT executed as
// part of the Phase 3 preview pass — see docs/PHASE_3_RESOURCE_IMPORT_PLAN.md,
// which stops at preview/validate. Requires --confirm at the CLI layer,
// same as the catalogue wave's apply mode.
import type { PrismaClient } from "@/generated/prisma";
import type { ResourceImportPlan } from "./resource-plan";

const CHUNK_SIZE = 50;

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type ResourceApplyResult = {
  inserted: number;
  skippedExisting: number;
  rejected: number;
  unresolvedSubject: number;
  missingStorageReference: number;
};

export async function applyResourceImportPlan(prisma: PrismaClient, plan: ResourceImportPlan): Promise<ResourceApplyResult> {
  const inserts = plan.outcomes.filter((o) => o.status === "insert");

  for (const batch of chunk(inserts, CHUNK_SIZE)) {
    await prisma.$transaction(
      batch.map((o) => {
        if (o.status !== "insert") throw new Error("unreachable");
        return prisma.resource.create({
          data: {
            subjectId: o.resolvedSubjectId,
            type: o.record.data.type as "PYQ" | "NOTES",
            title: o.record.data.title,
            year: o.record.data.year,
            academicYear: o.record.data.academicYear,
            fileUrl: o.record.data.fileUrl,
            fileName: o.record.data.fileName,
            fileSize: o.record.data.fileSize,
            fileHash: o.record.data.fileHash,
            downloads: o.record.data.downloads,
            sourceJsonName: o.record.naturalKey,
          },
        });
      }),
    );
  }

  return {
    inserted: inserts.length,
    skippedExisting: plan.outcomes.filter((o) => o.status === "skip_existing").length,
    rejected: plan.outcomes.filter((o) => o.status === "rejected").length,
    unresolvedSubject: plan.outcomes.filter((o) => o.status === "unresolved_subject").length,
    missingStorageReference: plan.outcomes.filter((o) => o.status === "missing_storage_reference").length,
  };
}
