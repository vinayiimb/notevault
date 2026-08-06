// Shared planning computation used identically by preview, validate, AND
// apply modes (Phase 2D requirement: what gets applied must be exactly what
// was previewed — no drift between the two). Read-only against the target
// DB (bounded, keyed lookups only — see db-lookup.ts).
import type { PrismaClient } from "@/generated/prisma";
import {
  findExistingProgramSlugs,
  getProgramIdsBySlug,
  findExistingTermKeys,
  getTermIdsByProgramAndOrder,
  findExistingSubjectKeys,
  findExistingExamSessionLabels,
  getExamSessionIdsByLabel,
  findExistingSessionLinkKeys,
} from "./db-lookup";
import { validateSemesterOrder, validateNonEmptyString, validateUrl, combineValidation } from "./validate";
import { findExactDuplicates, proposeSubjectAliases } from "./dedupe";
import { loadMasterSyllabusSource } from "../sources/master-syllabus";
import { loadExamSessionsSource } from "../sources/exam-sessions";
import { loadApprovedProgramAliases } from "./alias-loader";
import type { PlannedRecord, RowOutcome, SourceAdapterResult, WarningEntry } from "./types";

export type ImportPlan = {
  sources: SourceAdapterResult[];
  allWarnings: WarningEntry[];
  outcomes: RowOutcome[];
  proposedAliases: { canonicalKey: string; variants: string[] }[];
  exactDuplicateGroups: number;
};

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

export async function computeImportPlan(prisma: PrismaClient): Promise<ImportPlan> {
  const sources: SourceAdapterResult[] = [loadMasterSyllabusSource(), loadExamSessionsSource()];
  const allWarnings: WarningEntry[] = sources.flatMap((s) => s.warnings);

  const byModel = {
    Program: sources.flatMap((s) => s.records.filter((r) => r.model === "Program")),
    Term: sources.flatMap((s) => s.records.filter((r) => r.model === "Term")),
    Subject: sources.flatMap((s) => s.records.filter((r) => r.model === "Subject")),
    ExamSession: sources.flatMap((s) => s.records.filter((r) => r.model === "ExamSession")),
    SessionProgramLink: sources.flatMap((s) => s.records.filter((r) => r.model === "SessionProgramLink")),
  };

  let exactDuplicateGroups = 0;
  const firstOccurrence = new Map<string, PlannedRecord>();
  for (const [model, records] of Object.entries(byModel)) {
    const groups = findExactDuplicates(records, (r) => [r.naturalKey, JSON.stringify(r.data)]);
    exactDuplicateGroups += groups.length;
    for (const record of records) {
      const key = `${model}::${record.naturalKey}`;
      if (!firstOccurrence.has(key)) firstOccurrence.set(key, record);
    }
  }

  const subjectNames = byModel.Subject.map((r) => String(r.data.name));
  const proposedAliases = proposeSubjectAliases(subjectNames);

  const outcomes: RowOutcome[] = [];

  // --- Program ---
  const candidateProgramSlugs = [...new Set(byModel.Program.map((r) => r.naturalKey))];
  const existingProgramSlugs = await findExistingProgramSlugs(prisma, candidateProgramSlugs);
  const plannedProgramSlugs = new Set<string>();
  for (const record of byModel.Program) {
    if (firstOccurrence.get(`Program::${record.naturalKey}`) !== record) continue;
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
  // findExistingTermKeys/getTermIdsByProgramAndOrder are keyed by real
  // Program.id, but source records only know a Program's slug — resolve
  // existingProgramSlugs to real ids first, then translate the id-keyed
  // "programId::order" results back into the slug-keyed natural-key format
  // this plan uses everywhere else. (A prior version of this file passed
  // slugs directly into the id-keyed lookup, which silently always
  // returned empty — found via the Phase 2D idempotency test, which
  // exists precisely to catch this class of bug.)
  const existingProgramIdBySlug = await getProgramIdsBySlug(prisma, [...existingProgramSlugs]);
  const existingProgramIds = [...existingProgramIdBySlug.values()];
  const programSlugByExistingId = new Map([...existingProgramIdBySlug.entries()].map(([slug, id]) => [id, slug]));
  const existingTermIdKeys = await findExistingTermKeys(prisma, existingProgramIds);
  const existingTermKeys = new Set(
    [...existingTermIdKeys].map((idKey) => {
      const [programId, order] = idKey.split("::");
      return `${programSlugByExistingId.get(programId)}::${order}`;
    }),
  );

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
    if (existingTermKeys.has(record.naturalKey)) {
      outcomes.push({ status: "skip_existing", record, reason: "Term with this (Program, order) already exists in target" });
      continue;
    }
    outcomes.push({ status: "insert", record });
    plannedTermKeys.add(record.naturalKey);
  }
  const availableTermKeys = new Set([...existingTermKeys, ...plannedTermKeys]);

  // --- Subject (depends on Term) ---
  // Same id/slug translation problem as Term: findExistingSubjectKeys is
  // keyed by real Term.id, but records only know "programSlug::order".
  const existingProgramTermIds = await getTermIdsByProgramAndOrder(prisma, existingProgramIds);
  const existingTermIdByNaturalKey = new Map(
    [...existingProgramTermIds.entries()].map(([idKey, termId]) => {
      const [programId, order] = idKey.split("::");
      return [`${programSlugByExistingId.get(programId)}::${order}`, termId];
    }),
  );
  const existingSubjectKeysByTermId = await findExistingSubjectKeys(prisma, [...existingTermIdByNaturalKey.values()]);
  const termIdByNaturalKeyReverse = new Map([...existingTermIdByNaturalKey.entries()].map(([k, v]) => [v, k]));
  const existingSubjectNaturalKeys = new Set(
    [...existingSubjectKeysByTermId].map((idKey) => {
      const sep = idKey.indexOf("::");
      const termId = idKey.slice(0, sep);
      const slug = idKey.slice(sep + 2);
      return `${termIdByNaturalKeyReverse.get(termId)}::${slug}`;
    }),
  );

  for (const record of byModel.Subject) {
    if (firstOccurrence.get(`Subject::${record.naturalKey}`) !== record) continue;
    const termKey = String(record.data.termKey);
    if (!availableTermKeys.has(termKey)) {
      outcomes.push({ status: "unresolved_fk", record, missingParent: `Term(${termKey})` });
      continue;
    }
    const issues = validateRecord(record);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
      continue;
    }
    if (existingSubjectNaturalKeys.has(record.naturalKey)) {
      outcomes.push({ status: "skip_existing", record, reason: "Subject with this (Term, slug) already exists in target" });
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
  const existingSessionIdByLabel = await getExamSessionIdsByLabel(prisma, [...existingSessionLabels]);
  const sessionLabelByExistingId = new Map([...existingSessionIdByLabel.entries()].map(([label, id]) => [id, label]));
  const existingLinkIdKeys = await findExistingSessionLinkKeys(prisma, [...existingSessionIdByLabel.values()]);
  const existingLinkNaturalKeys = new Set(
    [...existingLinkIdKeys].map((idKey) => {
      const [sessionId, programId, variantLabel] = idKey.split("::");
      return `${sessionLabelByExistingId.get(sessionId)}::${programSlugByExistingId.get(programId)}::${variantLabel}`;
    }),
  );

  // Phase 2E/Checkpoint D: before giving up on a SessionProgramLink whose
  // programSlug doesn't match any Program, check for a human-*approved*
  // alias (data/import-mappings/program-aliases.json — pending/needs-review/
  // unresolved entries are never consulted, only "approved"). This is the
  // planner fix Checkpoint D calls for, in place of hand-inserting one-off
  // rows: once an operator approves an alias, this makes the corresponding
  // links deterministic inserts on the very next preview/apply run, with no
  // code change required.
  const approvedProgramAliases = await loadApprovedProgramAliases();

  for (const originalRecord of byModel.SessionProgramLink) {
    if (firstOccurrence.get(`SessionProgramLink::${originalRecord.naturalKey}`) !== originalRecord) continue;
    const sessionKey = String(originalRecord.data.sessionKey);
    let programSlug = String(originalRecord.data.programSlug);
    let record = originalRecord;

    if (!availableProgramSlugs.has(programSlug)) {
      const aliasTarget = approvedProgramAliases.get(programSlug);
      if (aliasTarget && availableProgramSlugs.has(aliasTarget)) {
        // Re-key the record onto the approved target slug so every
        // downstream check (existing-link lookup, apply.ts's insert) sees a
        // single consistent identifier — never two records disagreeing
        // about which Program this link actually targets.
        programSlug = aliasTarget;
        record = {
          ...originalRecord,
          naturalKey: `${sessionKey}::${aliasTarget}::${String(originalRecord.data.variantLabel ?? "")}`,
          data: { ...originalRecord.data, programSlug: aliasTarget },
        };
      }
    }

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
    if (existingLinkNaturalKeys.has(record.naturalKey)) {
      outcomes.push({ status: "skip_existing", record, reason: "SessionProgramLink with this (session, program, variant) already exists in target" });
      continue;
    }
    outcomes.push({ status: "insert", record });
  }

  return { sources, allWarnings, outcomes, proposedAliases, exactDuplicateGroups };
}
