// Controlled importer — see docs/PHASE_2C_DATA_IMPORT_PLAN.md and
// docs/PHASE_2D_WAVE1_STAGING_IMPORT.md.
//
// Modes:
//   preview   read-only: loads sources, validates, dedups, resolves FKs
//             against the target DB (read-only lookups), writes reports.
//             No writes of any kind.
//   validate  same computation as preview, but exits non-zero if any
//             record is rejected/unresolved — for CI-style gating.
//   apply     performs the actual writes (status: "insert" outcomes only),
//             in FK dependency order, in bounded chunked transactions.
//             Requires --confirm. Enabled starting Phase 2D, with explicit
//             per-run approval — this file does not decide when it's safe
//             to run, target-guard.ts and the operator do.
//   verify    post-apply read-only checks (row counts, FK integrity,
//             duplicate/orphan checks, excluded-model checks).
//
// Usage: npx tsx scripts/import/run.ts --mode=preview
import { resolveImportTarget, describeTarget, TargetGuardError } from "./lib/target-guard";
import { getImportPrismaClient, disconnectImportPrismaClient } from "./lib/db-client";
import { ensureReportsDir, writeRejectionsCsv, writeWarningsCsv, writeProposedAliasesCsv, writePreviewSummaryJson } from "./lib/report";
import { computeImportPlan } from "./lib/plan";
import { applyImportPlan } from "./lib/apply";
import { runVerification } from "./lib/verify";
import { writeFile } from "node:fs/promises";

const REPORTS_DIR = "reports";

function parseArgs(argv: string[]) {
  const mode = argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "preview";
  const confirm = argv.includes("--confirm");
  return { mode, confirm };
}

async function main() {
  const { mode, confirm } = parseArgs(process.argv.slice(2));

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
  console.log(`[target] ${describeTarget(target)} mode=${mode}`);

  const { client: prisma } = getImportPrismaClient();

  if (mode === "verify") {
    const report = await runVerification(prisma);
    await disconnectImportPrismaClient();
    await ensureReportsDir(REPORTS_DIR);
    await writeFile(`${REPORTS_DIR}/import-verify-report.json`, JSON.stringify(report, null, 2) + "\n", "utf-8");
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      console.error("\nverify mode: integrity issues found — exiting non-zero.");
      process.exitCode = 1;
    }
    return;
  }

  const plan = await computeImportPlan(prisma);

  if (mode === "apply") {
    const result = await applyImportPlan(prisma, plan);
    await disconnectImportPrismaClient();
    await ensureReportsDir(REPORTS_DIR);
    await writeFile(`${REPORTS_DIR}/import-apply-result.json`, JSON.stringify({ appliedAt: new Date().toISOString(), target: { hostname: target.hostname }, ...result }, null, 2) + "\n", "utf-8");
    console.log(`\nApply complete. Total inserted: ${result.totalInserted}`);
    for (const [model, counts] of Object.entries(result.perModel)) {
      console.log(`  ${model}: inserted=${counts.inserted} skippedExisting=${counts.skippedExisting} rejected=${counts.rejected} unresolvedFk=${counts.unresolvedForeignKey}`);
    }
    return;
  }

  // preview / validate share the same read-only computation.
  await disconnectImportPrismaClient();

  await ensureReportsDir(REPORTS_DIR);
  const rejectedCount = await writeRejectionsCsv(REPORTS_DIR, plan.outcomes);
  const warningCount = await writeWarningsCsv(REPORTS_DIR, plan.allWarnings);
  const aliasGroupCount = await writeProposedAliasesCsv(REPORTS_DIR, plan.proposedAliases);

  const perModel: Record<string, { toCreate: number; alreadyExists: number; rejected: number; unresolvedForeignKey: number }> = {};
  for (const model of ["Program", "Term", "Subject", "ExamSession", "SessionProgramLink"]) {
    const modelOutcomes = plan.outcomes.filter((o) => o.record.model === model);
    perModel[model] = {
      toCreate: modelOutcomes.filter((o) => o.status === "insert").length,
      alreadyExists: modelOutcomes.filter((o) => o.status === "skip_existing").length,
      rejected: modelOutcomes.filter((o) => o.status === "rejected").length,
      unresolvedForeignKey: modelOutcomes.filter((o) => o.status === "unresolved_fk").length,
    };
  }

  const estimatedDatabaseWrites = Object.values(perModel).reduce((sum, m) => sum + m.toCreate, 0);
  const modelsRemainingEmpty = [
    "SubjectAlias", "SubjectNotes", "NoteTheme", "SubjectAnalysis", "Resource", "CatalogPaperUpload",
    "CatalogSubjectOverride", "DriveSubject", "DriveFileMatch", "Question", "Admin", "Student",
    "StudentExamDate", "OrangeEvent", "Feedback", "FailedUpload", "ScanRun", "SubjectMergeSuggestion",
    "SubjectMergeLog", "SiteSettings", "ContentBlock", "SubjectMatchMemory", "CourseMatchMemory", "UploadBatch",
  ];

  await writePreviewSummaryJson(REPORTS_DIR, {
    generatedAt: new Date().toISOString(),
    target: { hostname: target.hostname },
    mode: mode as "preview" | "validate",
    sources: plan.sources.map((s) => ({ name: s.sourceName, file: s.sourceFile, recordCount: s.records.length, warningCount: s.warnings.length })),
    perModel,
    exactDuplicateGroups: plan.exactDuplicateGroups,
    probableDuplicateGroups: plan.proposedAliases.length,
    proposedAliasGroups: aliasGroupCount,
    modelsRemainingEmpty,
    estimatedDatabaseWrites,
  });

  console.log(`\nSources loaded: ${plan.sources.map((s) => `${s.sourceName} (${s.records.length} records)`).join(", ")}`);
  console.log(`Estimated database writes: ${estimatedDatabaseWrites}`);
  console.log(`Rejected: ${rejectedCount}  Warnings: ${warningCount}  Proposed alias groups: ${aliasGroupCount}`);
  console.log(`Reports written to ${REPORTS_DIR}/`);

  if (mode === "validate" && (rejectedCount > 0 || plan.outcomes.some((o) => o.status === "unresolved_fk"))) {
    console.error("\nvalidate mode: rejected/unresolved records present — exiting non-zero.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
