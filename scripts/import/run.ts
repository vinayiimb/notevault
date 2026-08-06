// Phase 2C controlled importer — see docs/PHASE_2C_DATA_IMPORT_PLAN.md.
//
// Modes:
//   preview   read-only: loads sources, validates, dedups, resolves FKs
//             against the target DB (read-only lookups), writes reports.
//             No writes of any kind.
//   validate  same computation as preview, but exits non-zero if any
//             record is rejected/unresolved — for CI-style gating.
//   apply     performs the actual writes, in dependency order, inside
//             transactions, batched. Requires --confirm. NOT RUN in
//             Phase 2C — built for a future, separately-approved phase.
//   verify    post-apply read-only checks (row counts, FK integrity).
//             NOT RUN in Phase 2C.
//
// Usage: npx tsx scripts/import/run.ts --mode preview
import { resolveImportTarget, describeTarget, TargetGuardError } from "./lib/target-guard";
import { getImportPrismaClient, disconnectImportPrismaClient } from "./lib/db-client";
import {
  findExistingProgramSlugs,
  findExistingTermKeys,
  findExistingExamSessionLabels,
} from "./lib/db-lookup";
import { validateSemesterOrder, validateNonEmptyString, validateUrl, combineValidation } from "./lib/validate";
import { findExactDuplicates, proposeSubjectAliases } from "./lib/dedupe";
import { ensureReportsDir, writeRejectionsCsv, writeWarningsCsv, writeProposedAliasesCsv, writePreviewSummaryJson } from "./lib/report";
import { loadMasterSyllabusSource } from "./sources/master-syllabus";
import { loadExamSessionsSource } from "./sources/exam-sessions";
import type { PlannedRecord, RowOutcome, SourceAdapterResult, WarningEntry } from "./lib/types";

const REPORTS_DIR = "reports";

function parseArgs(argv: string[]) {
  const mode = argv.find((a) => a.startsWith("--mode="))?.split("=")[1] ?? "preview";
  const confirm = argv.includes("--confirm");
  return { mode, confirm };
}

function validateRecord(record: PlannedRecord): string[] {
  const issues: string[] = [];
  switch (record.model) {
    case "Program":
      issues.push(...combineValidation(validateNonEmptyString(record.data.name, "name")).issues.map((i) => `${i.field}: ${i.message}`));
      break;
    case "Term":
      issues.push(...combineValidation(validateSemesterOrder(record.data.order, "order")).issues.map((i) => `${i.field}: ${i.message}`));
      break;
    case "Subject":
      issues.push(...combineValidation(validateNonEmptyString(record.data.name, "name")).issues.map((i) => `${i.field}: ${i.message}`));
      break;
    case "ExamSession":
      issues.push(...combineValidation(validateNonEmptyString(record.data.label, "label")).issues.map((i) => `${i.field}: ${i.message}`));
      break;
    case "SessionProgramLink":
      issues.push(...combineValidation(validateUrl(record.data.driveUrl, "driveUrl")).issues.map((i) => `${i.field}: ${i.message}`));
      break;
  }
  return issues;
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

  if (mode === "apply") {
    console.error("apply mode is implemented but intentionally not invoked in Phase 2C. Stopping.");
    process.exitCode = 1;
    return;
  }
  if (mode === "verify") {
    console.error("verify mode runs after apply and is intentionally not invoked in Phase 2C. Stopping.");
    process.exitCode = 1;
    return;
  }

  const sources: SourceAdapterResult[] = [loadMasterSyllabusSource(), loadExamSessionsSource()];
  const allWarnings: WarningEntry[] = sources.flatMap((s) => s.warnings);

  const byModel = {
    Program: sources.flatMap((s) => s.records.filter((r) => r.model === "Program")),
    Term: sources.flatMap((s) => s.records.filter((r) => r.model === "Term")),
    Subject: sources.flatMap((s) => s.records.filter((r) => r.model === "Subject")),
    ExamSession: sources.flatMap((s) => s.records.filter((r) => r.model === "ExamSession")),
    SessionProgramLink: sources.flatMap((s) => s.records.filter((r) => r.model === "SessionProgramLink")),
  };

  // --- within-batch duplicate detection (exact, by naturalKey) ---
  let exactDuplicateGroups = 0;
  const firstOccurrence = new Map<string, PlannedRecord>(); // "model::naturalKey" -> first record
  for (const [model, records] of Object.entries(byModel)) {
    const groups = findExactDuplicates(records, (r) => [r.naturalKey, JSON.stringify(r.data)]);
    exactDuplicateGroups += groups.length;
    for (const record of records) {
      const key = `${model}::${record.naturalKey}`;
      if (!firstOccurrence.has(key)) firstOccurrence.set(key, record);
    }
  }

  // --- probable duplicates / proposed aliases (Subject names only) ---
  const subjectNames = byModel.Subject.map((r) => String(r.data.name));
  const proposedAliases = proposeSubjectAliases(subjectNames);

  const { client: prisma } = getImportPrismaClient();

  const outcomes: RowOutcome[] = [];

  // --- Program ---
  const candidateProgramSlugs = [...new Set(byModel.Program.map((r) => r.naturalKey))];
  const existingProgramSlugs = await findExistingProgramSlugs(prisma, candidateProgramSlugs);
  const plannedProgramSlugs = new Set<string>();
  for (const record of byModel.Program) {
    if (firstOccurrence.get(`Program::${record.naturalKey}`) !== record) continue; // dedup: only first wins
    const issues = validateRecord(record);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
    } else if (existingProgramSlugs.has(record.naturalKey)) {
      outcomes.push({ status: "skip_existing", record, reason: "Program with this slug already exists in target" });
    } else {
      outcomes.push({ status: "insert", record });
      plannedProgramSlugs.add(record.naturalKey);
    }
  }
  const availableProgramSlugs = new Set([...existingProgramSlugs, ...plannedProgramSlugs]);

  // --- Term (depends on Program) ---
  const existingTermKeys = await findExistingTermKeys(prisma, [...existingProgramSlugs]); // keyed by real programId — see note below
  // Existing Terms are keyed by real Program.id in the DB, but our source
  // records only know the Program *slug*. Since staging is currently empty
  // (Phase 2B), there is nothing to cross-reference yet; this is wired for
  // correctness on a future non-empty run, not exercised meaningfully today
  // — see docs/PHASE_2C_DATA_IMPORT_PLAN.md's noted limitation.
  const plannedTermKeys = new Set<string>();
  for (const record of byModel.Term) {
    if (firstOccurrence.get(`Term::${record.naturalKey}`) !== record) continue;
    const programSlug = String(record.data.programSlug);
    if (!availableProgramSlugs.has(programSlug)) {
      outcomes.push({ status: "unresolved_fk", record, missingParent: `Program(slug=${programSlug})` });
      continue;
    }
    const issues = validateRecord(record);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
      continue;
    }
    // Existing-row check is best-effort without real Program ids (see note above).
    outcomes.push({ status: "insert", record });
    plannedTermKeys.add(record.naturalKey);
  }
  const availableTermKeys = new Set([...existingTermKeys, ...plannedTermKeys]);

  // --- Subject (depends on Term) ---
  for (const record of byModel.Subject) {
    if (firstOccurrence.get(`Subject::${record.naturalKey}`) !== record) continue;
    const termKey = String(record.data.termKey);
    if (!availableTermKeys.has(termKey) && !plannedTermKeys.has(termKey)) {
      outcomes.push({ status: "unresolved_fk", record, missingParent: `Term(${termKey})` });
      continue;
    }
    const issues = validateRecord(record);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
      continue;
    }
    outcomes.push({ status: "insert", record });
  }

  // --- ExamSession ---
  const candidateSessionLabels = [...new Set(byModel.ExamSession.map((r) => r.naturalKey))];
  const existingSessionLabels = await findExistingExamSessionLabels(prisma, candidateSessionLabels);
  const plannedSessionLabels = new Set<string>();
  for (const record of byModel.ExamSession) {
    if (firstOccurrence.get(`ExamSession::${record.naturalKey}`) !== record) continue;
    const issues = validateRecord(record);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
    } else if (existingSessionLabels.has(record.naturalKey)) {
      outcomes.push({ status: "skip_existing", record, reason: "ExamSession with this label already exists in target" });
    } else {
      outcomes.push({ status: "insert", record });
      plannedSessionLabels.add(record.naturalKey);
    }
  }
  const availableSessionLabels = new Set([...existingSessionLabels, ...plannedSessionLabels]);

  // --- SessionProgramLink (depends on ExamSession + Program) ---
  for (const record of byModel.SessionProgramLink) {
    if (firstOccurrence.get(`SessionProgramLink::${record.naturalKey}`) !== record) continue;
    const sessionKey = String(record.data.sessionKey);
    const programSlug = String(record.data.programSlug);
    const missing: string[] = [];
    if (!availableSessionLabels.has(sessionKey)) missing.push(`ExamSession(label=${sessionKey})`);
    if (!availableProgramSlugs.has(programSlug)) missing.push(`Program(slug=${programSlug})`);
    if (missing.length > 0) {
      outcomes.push({ status: "unresolved_fk", record, missingParent: missing.join(", ") });
      continue;
    }
    const issues = validateRecord(record);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
      continue;
    }
    outcomes.push({ status: "insert", record });
  }

  await disconnectImportPrismaClient();

  // --- reports ---
  await ensureReportsDir(REPORTS_DIR);
  const rejectedCount = await writeRejectionsCsv(REPORTS_DIR, outcomes);
  const warningCount = await writeWarningsCsv(REPORTS_DIR, allWarnings);
  const aliasGroupCount = await writeProposedAliasesCsv(REPORTS_DIR, proposedAliases);

  const perModel: Record<string, { toCreate: number; alreadyExists: number; rejected: number; unresolvedForeignKey: number }> = {};
  for (const model of Object.keys(byModel)) {
    const modelOutcomes = outcomes.filter((o) => o.record.model === model);
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
    sources: sources.map((s) => ({ name: s.sourceName, file: s.sourceFile, recordCount: s.records.length, warningCount: s.warnings.length })),
    perModel,
    exactDuplicateGroups,
    probableDuplicateGroups: proposedAliases.length,
    proposedAliasGroups: aliasGroupCount,
    modelsRemainingEmpty,
    estimatedDatabaseWrites,
  });

  console.log(`\nSources loaded: ${sources.map((s) => `${s.sourceName} (${s.records.length} records)`).join(", ")}`);
  console.log(`Estimated database writes: ${estimatedDatabaseWrites}`);
  console.log(`Rejected: ${rejectedCount}  Warnings: ${warningCount}  Proposed alias groups: ${aliasGroupCount}`);
  console.log(`Reports written to ${REPORTS_DIR}/`);

  if (mode === "validate" && (rejectedCount > 0 || outcomes.some((o) => o.status === "unresolved_fk"))) {
    console.error("\nvalidate mode: rejected/unresolved records present — exiting non-zero.");
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
