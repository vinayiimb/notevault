// Phase 2E / Checkpoint C — builds the four version-controlled mapping files
// under data/import-mappings/ from the importer's own deterministic outputs
// (reports/proposed-subject-aliases.csv, the Phase 2E program classification,
// and the semester-parsing rules already implemented in lib/normalize.ts).
//
// This script only *proposes*. Every entry it writes has approvalStatus
// "pending" (or "unresolved" where there's no deterministic target at all)
// — nothing here is auto-approved, per the global rule against fuzzy-merging
// programmes/subjects automatically. A human (or a follow-up, explicitly
// human-reviewed commit) flips approvalStatus to "approved" before
// Checkpoint D/E treats a mapping as safe to apply.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { EXAM_SESSIONS_SOURCE } from "@/data/exam-sessions-source";
import { deterministicSlug, normalizeWhitespaceAndUnicode } from "../lib/normalize";
import { PROGRAM_ALIAS_CLASSIFICATION } from "../lib/program-alias-classification";

const OUT_DIR = "data/import-mappings";
const GENERATED_AT = new Date().toISOString();
const SOURCE = "phase2e-rejected-record-classification";

async function buildProgramAliases() {
  // One entry per distinct missing slug (not per rejected row) — 41 total,
  // matching the 41 distinct programSlugs behind the 160 rejected rows
  // (see docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md).
  const originalBySlug = new Map<string, string>();
  const rowCountBySlug = new Map<string, number>();
  for (const session of EXAM_SESSIONS_SOURCE) {
    for (const row of session.rows) {
      const slug = deterministicSlug(normalizeWhitespaceAndUnicode(row.course));
      if (!PROGRAM_ALIAS_CLASSIFICATION[slug]) continue;
      if (!originalBySlug.has(slug)) originalBySlug.set(slug, row.course);
      rowCountBySlug.set(slug, (rowCountBySlug.get(slug) ?? 0) + 1);
    }
  }

  const entries = [...originalBySlug.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([slug, original]) => {
      const cls = PROGRAM_ALIAS_CLASSIFICATION[slug];
      const approvalStatus = cls.targetProgramSlug === null ? "unresolved" : cls.manualReviewRequired ? "needs-review" : "pending";
      return {
        originalValue: original,
        sourceProgramSlug: slug,
        targetProgramSlug: cls.targetProgramSlug,
        mappingType: "programme-alias",
        sourceIssueCategory: cls.category,
        source: SOURCE,
        rationale: cls.rationale,
        confidence: cls.confidence,
        approvalStatus,
        approvedBy: null,
        createdAt: GENERATED_AT,
        mappingVersion: 1,
        affectedRowCount: rowCountBySlug.get(slug) ?? 0,
      };
    });

  await writeFile(
    `${OUT_DIR}/program-aliases.json`,
    JSON.stringify(
      {
        generatedAt: GENERATED_AT,
        generatedBy: SOURCE,
        note: "AI-proposed mappings only. Every entry needs an explicit human approvalStatus change to \"approved\" before Checkpoint D/E may apply it. Programme names are never fuzzy-merged automatically (see docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md).",
        resolutionOrder: ["exact source identifier", "exact normalized name", "approved alias", "stable programme code", "explicit manual mapping", "unresolved"],
        totalEntries: entries.length,
        statusTotals: entries.reduce<Record<string, number>>((acc, e) => {
          acc[e.approvalStatus] = (acc[e.approvalStatus] ?? 0) + 1;
          return acc;
        }, {}),
        entries,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  console.log(`program-aliases.json: ${entries.length} entries (${[...new Set(entries.map((e) => e.approvalStatus))].join(", ")})`);
  return entries;
}

async function buildTermAliases() {
  // Declarative mirror of scripts/import/lib/normalize.ts's parseSemesterField
  // — that function is the actual, tested, deterministic implementation;
  // this file documents its equivalence rules in version-controlled,
  // reviewable form per the Checkpoint C requirement, rather than
  // duplicating a second resolution mechanism that could drift from the
  // code. Regenerating this file after a normalize.ts change is a manual
  // step — see the "syncedWithNormalizeTs" note.
  const romanEquivalents: Array<{ order: number; roman: string; forms: string[] }> = [
    { order: 1, roman: "I", forms: ["Semester I", "Semester 1", "Semester-1", "Sem 1", "Sem I", "I", "1"] },
    { order: 2, roman: "II", forms: ["Semester II", "Semester 2", "Sem 2", "Sem II", "II", "2"] },
    { order: 3, roman: "III", forms: ["Semester III", "Semester 3", "Sem 3", "Sem III", "III", "3", "IIi"] },
    { order: 4, roman: "IV", forms: ["Semester IV", "Semester 4", "Sem 4", "Sem IV", "IV", "4"] },
    { order: 5, roman: "V", forms: ["Semester V", "Semester 5", "Sem 5", "Sem V", "V", "5"] },
    { order: 6, roman: "VI", forms: ["Semester VI", "Semester 6", "Sem 6", "Sem VI", "VI", "6"] },
    { order: 7, roman: "VII", forms: ["Semester VII", "Semester 7", "Sem 7", "Sem VII", "VII", "7"] },
    { order: 8, roman: "VIII", forms: ["Semester VIII", "Semester 8", "Sem 8", "Sem VIII", "VIII", "8"] },
  ];

  const entries = romanEquivalents.map((r) => ({
    normalizedOrder: r.order,
    canonicalRoman: r.roman,
    equivalentForms: r.forms,
    mappingType: "term-normalization",
    source: "scripts/import/lib/normalize.ts#parseSemesterField",
    rationale: `Case-insensitive roman numeral / arabic digit / "Semester"|"Sem" prefix equivalence, verified against real MASTER_SYLLABUS_ROWS data during Phase 2C-2E (includes the real "IIi" typo, resolved case-insensitively).`,
    confidence: 1.0,
    approvalStatus: "approved",
    approvedBy: "deterministic-code (scripts/import/__tests__/normalize.test.ts)",
    createdAt: GENERATED_AT,
    mappingVersion: 1,
  }));

  const excludedKinds = [
    {
      kind: "pool",
      rawExamples: ["Pool / not fixed", "Pool / see prerequisites"],
      rowsObserved: 194,
      rationale: "Not a semester at all — an elective pool spanning multiple semesters. Intentionally excluded from Term creation, not an alias target.",
    },
    {
      kind: "multi",
      rawExamples: ["I/III/V", "I,III,V", "III-VI"],
      rowsObserved: 2838,
      rationale: "Multi-semester source rows expand into one Subject per listed/ranged semester — handled by parseSemesterField's \"multi\" result kind, not a term alias (there's no single normalizedValue to alias to).",
    },
  ];

  await writeFile(
    `${OUT_DIR}/term-aliases.json`,
    JSON.stringify(
      {
        generatedAt: GENERATED_AT,
        note: "Declarative mirror of the tested parseSemesterField() logic in scripts/import/lib/normalize.ts — approvalStatus is \"approved\" here because this documents already-implemented, unit-tested, deterministic code (not an AI judgment call), unlike program-aliases.json / subject-aliases.json.",
        syncedWithNormalizeTs: "2026-08-06 — keep in sync manually if parseSemesterField's regex/token rules change.",
        verifiedAgainstProgrammeConstraint: "Every Term this produces is created scoped to its own Program (Term.programId + Term.order is the actual uniqueness key — see prisma/schema.prisma) — this file only documents *label* equivalence, resolution still requires the caller to also resolve the correct Program first (see plan.ts's Term section).",
        entries,
        excludedKinds,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  console.log(`term-aliases.json: ${entries.length} entries (all approved, mirrors tested code)`);
  return entries;
}

async function buildSubjectAliases() {
  // Source: reports/proposed-subject-aliases.csv, the importer's own
  // proposeSubjectAliases() output (scripts/import/lib/dedupe.ts) — already
  // restricted to case/punctuation/spacing/roman-numeral-preserving
  // canonical-key matches (see dedupe.ts's probableDuplicateKey and its
  // "keeps numbered papers as separate groups" / "conflicting UPC codes
  // prevent grouping" tested guarantees). This script does not re-derive
  // that grouping — it only reformats it into the mapping-file shape and
  // marks every entry "pending" human approval, per the SUBJECT RULES
  // (Part I/II, Theory/Practical, DSC/DSE etc. must stay distinct — that
  // distinction lives in proposeSubjectAliases()'s canonical-key logic and
  // its UPC-conflict guard, not re-checked here).
  const csv = await readFile("reports/proposed-subject-aliases.csv", "utf-8");
  const lines = csv.trim().split("\n").slice(1); // drop header

  function parseCsvLine(line: string): string[] {
    // Minimal CSV parser sufficient for this report's shape (one quoted
    // field max, containing commas — matches report.ts's own writer).
    const fields: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') { inQuotes = false; }
        else { cur += ch; }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    fields.push(cur);
    return fields;
  }

  const entries = lines.map((line) => {
    const [canonicalKey, variantsRaw, variantCountRaw] = parseCsvLine(line);
    const variants = variantsRaw.split(" | ");
    // Prefer the most title-cased-looking variant as the proposed canonical
    // display form (purely cosmetic tie-break — either an approver picks
    // the real target row, or applies this only where a single Subject
    // already exists under one of these spellings within the same Term).
    const normalizedValue = [...variants].sort((a, b) => {
      const score = (s: string) => (s === s.toUpperCase() ? 0 : s === s.toLowerCase() ? 1 : 2);
      return score(b) - score(a);
    })[0];
    return {
      originalValue: variants,
      normalizedValue,
      canonicalKey,
      mappingType: "subject-alias",
      source: "reports/proposed-subject-aliases.csv (proposeSubjectAliases)",
      rationale: "Case/punctuation/spacing/hyphen/apostrophe variant of the same subject name (canonical-key match) — academically distinct subjects (Part I/II, Theory/Practical, DSC/DSE, different UPC) are excluded by proposeSubjectAliases()'s own guards, not re-verified per-entry here.",
      confidence: 0.8,
      approvalStatus: "pending",
      approvedBy: null,
      createdAt: GENERATED_AT,
      mappingVersion: 1,
      variantCount: Number(variantCountRaw),
    };
  });

  await writeFile(
    `${OUT_DIR}/subject-aliases.json`,
    JSON.stringify(
      {
        generatedAt: GENERATED_AT,
        generatedFrom: "reports/proposed-subject-aliases.csv",
        note: "Every entry is a PROPOSAL (approvalStatus: pending). Academically distinct subjects are never merged just for similar names — see rationale per entry and docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md.",
        totalEntries: entries.length,
        entries,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  console.log(`subject-aliases.json: ${entries.length} entries (all pending)`);
  return entries;
}

async function buildSessionProgramLinks(programAliasEntries: Awaited<ReturnType<typeof buildProgramAliases>>) {
  // Not a name-alias file — this documents which SessionProgramLink rows are
  // blocked on which program-alias decision, so Checkpoint D's dry-run has
  // a deterministic, versioned input instead of re-deriving it from the CSV
  // each time. sessionKey/variantLabel/driveUrl are the same natural-key
  // components run.ts already uses (see scripts/import/sources/exam-sessions.ts).
  const bySlug = new Map<string, { sessionKey: string; driveUrl: string }[]>();
  for (const session of EXAM_SESSIONS_SOURCE) {
    for (const row of session.rows) {
      const slug = deterministicSlug(normalizeWhitespaceAndUnicode(row.course));
      if (!PROGRAM_ALIAS_CLASSIFICATION[slug]) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, []);
      bySlug.get(slug)!.push({ sessionKey: normalizeWhitespaceAndUnicode(session.label), driveUrl: row.url });
    }
  }

  const entries = programAliasEntries.map((alias) => ({
    blockedOnProgramAliasSlug: alias.sourceProgramSlug,
    blockedOnProgramAliasStatus: alias.approvalStatus,
    variantLabel: "",
    uniqueConstraint: "SessionProgramLink_sessionId_programId_variantLabel_key (see prisma/schema.prisma @@unique([sessionId, programId, variantLabel]))",
    status: alias.targetProgramSlug ? "deterministic-once-alias-approved" : "unresolved",
    affectedLinks: (bySlug.get(alias.sourceProgramSlug) ?? []).map((l) => ({ sessionKey: l.sessionKey, driveUrl: l.driveUrl })),
  }));

  await writeFile(
    `${OUT_DIR}/session-program-links.json`,
    JSON.stringify(
      {
        generatedAt: GENERATED_AT,
        note: "Every link here is currently rejected (unresolved_fk) purely because its Program alias isn't approved yet — once a program-aliases.json entry flips to approved, the corresponding links become deterministic inserts for Checkpoint D/E to apply (no separate link-level ambiguity in this wave).",
        totalBlockedLinkGroups: entries.length,
        totalBlockedLinks: entries.reduce((sum, e) => sum + e.affectedLinks.length, 0),
        entries,
      },
      null,
      2,
    ) + "\n",
    "utf-8",
  );
  console.log(`session-program-links.json: ${entries.length} groups, ${entries.reduce((s, e) => s + e.affectedLinks.length, 0)} links`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const programAliasEntries = await buildProgramAliases();
  await buildTermAliases();
  await buildSubjectAliases();
  await buildSessionProgramLinks(programAliasEntries);
}

main();
