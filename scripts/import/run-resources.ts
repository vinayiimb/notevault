// Phase 3 resource-wave importer — see docs/PHASE_3_RESOURCE_IMPORT_PLAN.md
// and docs/PHASE_3_RESOURCE_IMPORT_APPLIED.md. Same mode contract as run.ts
// (preview/validate/apply/verify), same target-guard (never runs against a
// neon.tech host or production env), separate from the catalogue wave so a
// Resource-wave bug can never touch Program/Term/Subject/ExamSession/
// SessionProgramLink outcomes or vice versa.
//
// Usage: npx tsx scripts/import/run-resources.ts --mode=preview
import { resolveImportTarget, describeTarget, TargetGuardError } from "./lib/target-guard";
import { getImportPrismaClient, disconnectImportPrismaClient } from "./lib/db-client";
import { computeResourceImportPlan, resolveAllSubjects } from "./lib/resource-plan";
import { resolveResourceStorage } from "./lib/resource-storage";
import { applyResourceImportPlan } from "./lib/resource-apply";
import { runResourceVerification } from "./lib/resource-verify";
import {
  ensureReportsDir,
  writeResourceRejectionsCsv,
  writeResourceWarningsCsv,
  writeResourcePreviewJson,
} from "./lib/resource-report";
import { writeFile } from "node:fs/promises";

const REPORTS_DIR = "reports";

function parseArgs(argv: string[]) {
  const mode = argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "preview";
  const confirm = argv.includes("--confirm");
  const maxUploadsArg = argv.find((a) => a.startsWith("--max-uploads="))?.split("=")[1];
  const maxUploads = maxUploadsArg ? Number(maxUploadsArg) : undefined;
  return { mode, confirm, maxUploads };
}

async function main() {
  const { mode, confirm, maxUploads } = parseArgs(process.argv.slice(2));

  if (mode === "apply" && !confirm) {
    console.error("Refusing to run apply mode without --confirm.");
    process.exitCode = 1;
    return;
  }

  let target;
  try {
    target = resolveImportTarget();
  } catch (err) {
    if (err instanceof TargetGuardError) {
      console.error(`[target-guard] ${err.message}`);
      process.exitCode = 1;
      return;
    }
    throw err;
  }
  console.log(`[target] ${describeTarget(target)} mode=${mode} (resource wave)`);

  const { client: prisma } = getImportPrismaClient();

  if (mode === "verify") {
    const report = await runResourceVerification(prisma);
    await disconnectImportPrismaClient();
    await ensureReportsDir(REPORTS_DIR);
    await writeFile(`${REPORTS_DIR}/resource-import-verify-report.json`, JSON.stringify(report, null, 2) + "\n", "utf-8");
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      console.error("\nverify mode: integrity issues found — exiting non-zero.");
      process.exitCode = 1;
    }
    return;
  }

  // Subject resolution first (read-only) — needed to know each candidate's
  // real target Subject id before storage can even compute a canonical R2
  // key (uploads/pyqs/<subjectId>/...).
  const resolvedSubjects = await resolveAllSubjects(prisma);

  // Storage: read-only classification for preview/validate; real (additive
  // only, idempotent) uploads only in apply mode.
  const { audit: storageAudit, resolution: storageResolution } = await resolveResourceStorage(resolvedSubjects, {
    allowUpload: mode === "apply",
    maxUploads,
  });

  const plan = await computeResourceImportPlan(prisma, storageResolution);

  await ensureReportsDir(REPORTS_DIR);
  await writeFile(
    `${REPORTS_DIR}/resource-storage-audit.json`,
    JSON.stringify({ generatedAt: new Date().toISOString(), mode, ...storageAudit }, null, 2) + "\n",
    "utf-8",
  );
  const storageCounts = storageAudit.decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.classification] = (acc[d.classification] ?? 0) + 1;
    return acc;
  }, {});
  console.log(`Storage: ${JSON.stringify(storageCounts)}`);

  if (mode === "apply") {
    const result = await applyResourceImportPlan(prisma, plan);
    await disconnectImportPrismaClient();
    await writeFile(
      `${REPORTS_DIR}/resource-import-apply-result.json`,
      JSON.stringify({ appliedAt: new Date().toISOString(), target: { hostname: target.hostname }, storageCounts, ...result }, null, 2) + "\n",
      "utf-8",
    );
    console.log(`\nApply complete. Inserted: ${result.inserted}`);
    console.log(`  skippedExisting=${result.skippedExisting} rejected=${result.rejected} unresolvedSubject=${result.unresolvedSubject} missingStorageReference=${result.missingStorageReference}`);
    return;
  }

  // preview / validate share the same read-only computation.
  await disconnectImportPrismaClient();

  const rejectedCount = await writeResourceRejectionsCsv(REPORTS_DIR, plan);
  const warningCount = await writeResourceWarningsCsv(REPORTS_DIR, plan);

  const perStatus: Record<string, number> = {
    insert: plan.outcomes.filter((o) => o.status === "insert").length,
    skip_existing: plan.outcomes.filter((o) => o.status === "skip_existing").length,
    rejected: plan.outcomes.filter((o) => o.status === "rejected").length,
    unresolved_subject: plan.outcomes.filter((o) => o.status === "unresolved_subject").length,
    missing_storage_reference: plan.outcomes.filter((o) => o.status === "missing_storage_reference").length,
  };

  await writeResourcePreviewJson(REPORTS_DIR, {
    generatedAt: new Date().toISOString(),
    target: { hostname: target.hostname },
    mode: mode as "preview" | "validate",
    sourceRecordCount: plan.sourceRecordCount,
    perStatus,
    exactDuplicateGroups: plan.exactDuplicateGroups.length,
    probableDuplicateGroups: plan.probableDuplicateGroups.length,
    exactDuplicateDetail: plan.exactDuplicateGroups,
    probableDuplicateDetail: plan.probableDuplicateGroups,
  });

  console.log(`\nSource: ${plan.sourceName} (${plan.sourceRecordCount} records) from ${plan.sourceFile}`);
  console.log(`Insert-ready (clean): ${perStatus.insert}`);
  console.log(`Already exists: ${perStatus.skip_existing}`);
  console.log(`Rejected: ${perStatus.rejected}  Unresolved subject: ${perStatus.unresolved_subject}  Missing storage reference: ${perStatus.missing_storage_reference}`);
  console.log(`Exact duplicate groups: ${plan.exactDuplicateGroups.length}  Probable duplicate groups: ${plan.probableDuplicateGroups.length}`);
  console.log(`Warnings: ${warningCount}`);
  console.log(`Reports written to ${REPORTS_DIR}/`);

  if (mode === "validate" && (rejectedCount > 0 || perStatus.unresolved_subject > 0 || perStatus.missing_storage_reference > 0)) {
    console.error("\nvalidate mode: rejected/unresolved/missing-storage records present — exiting non-zero.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
