// Phase 3 resource import planner — read-only against the target DB
// (bounded, keyed lookups only, same rule as db-lookup.ts). Computes what
// WOULD be inserted, never writes. See docs/PHASE_3_RESOURCE_IMPORT_PLAN.md
// and docs/PHASE_3_RESOURCE_IMPORT_APPLIED.md for the matching-hierarchy
// rationale and match-rate results.
import { readFileSync } from "node:fs";
import type { PrismaClient } from "@/generated/prisma";
import { loadResourceSource, type PlannedResourceRecord, type ResourceWarningEntry } from "../sources/resources";
import { canonicalSubjectKey } from "@/lib/subject-normalization";

const CHUNK_SIZE = 500;
const PROGRAM_MAPPING_PATH = "data/import-mappings/resource-program-mapping.json";

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export type MatchTier =
  | "exact-code" // exact known Subject id/code
  | "approved-alias" // program mapping + exact name match
  | "name-program-term" // normalized name + programme + semester/term
  | "name-program" // normalized name + programme only
  | "unique-global-name" // unique normalized name match anywhere (only when nothing else applies)
  | "conservative-fuzzy-dominant" // token-overlap match, only when the best candidate is a clear, unambiguous winner
  | null;

export type ResourceOutcome =
  | { status: "insert"; record: PlannedResourceRecord; resolvedSubjectId: string; matchTier: MatchTier; matchReason: string }
  | { status: "skip_existing"; record: PlannedResourceRecord; reason: string }
  | { status: "rejected"; record: PlannedResourceRecord; issues: string[] }
  | { status: "unresolved_subject"; record: PlannedResourceRecord; reason: string; candidateSubjectIds: string[] }
  | { status: "missing_storage_reference"; record: PlannedResourceRecord; reason: string };

export type ResourceImportPlan = {
  sourceName: string;
  sourceFile: string;
  sourceRecordCount: number;
  sourceWarnings: ResourceWarningEntry[];
  outcomes: ResourceOutcome[];
  exactDuplicateGroups: { key: string; naturalKeys: string[] }[];
  probableDuplicateGroups: { reason: string; classification: "SAME_RESOURCE" | "DIFFERENT_RESOURCE" | "UNRESOLVED_DUPLICATE"; naturalKeys: string[] }[];
};

// Confirmed-reachable public file references. Populated at runtime by
// run-resources.ts (Task 4: live R2 listing, see resource-storage.ts) — a
// record's fileUrl is only ever treated as reachable if it's actually been
// verified against the live bucket or resolved to a freshly-uploaded real
// object, never assumed from its shape alone.
export type StorageResolution = {
  /** Set of naturalKeys whose file is confirmed reachable, mapped to the
   * real, servable fileUrl to use on import (may differ from the source's
   * original local-dev-path fileUrl). */
  confirmedByNaturalKey: Map<string, { fileUrl: string; fileHash: string | null }>;
};

function stripCodePrefix(name: string): string {
  // Old export subject names are frequently prefixed with a DU-style paper
  // code ("HC31 — ...", "SEC-1.2 — ...", "BC 6.1(e) — ...") that the current
  // clean catalogue names never carry. Strip a short leading
  // alnum/dot/paren/hyphen token followed by an em-dash or hyphen, nothing
  // fuzzier than that.
  return name.replace(/^[A-Za-z0-9.()\-]{2,15}\s*[—-]\s*/, "").trim();
}

/** Deterministic (not fuzzy) name variants worth trying: the raw name, the
 * code-prefix-stripped name, and — because a few old rows record two
 * alternate paper names separated by "/" — each slash-separated part, both
 * raw and stripped. Every variant is still matched via exact
 * canonicalSubjectKey() equality; nothing here is a similarity/fuzzy score. */
function nameVariants(name: string): string[] {
  const variants = new Set<string>();
  variants.add(name);
  variants.add(stripCodePrefix(name));
  for (const part of name.split("/")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    variants.add(trimmed);
    variants.add(stripCodePrefix(trimmed));
  }
  return [...variants].filter(Boolean);
}

// Tier 6 — "conservative fuzzy match only where there is a clearly dominant
// candidate" (the task's own preferred-hierarchy wording). Token-set Jaccard
// overlap, not edit-distance/phonetic fuzziness — deliberately simple and
// auditable. Only ever considered when NO tier 2-5 name match exists at all
// in the scoped programme(s) (never overrides or second-guesses an
// already-ambiguous exact-name case). Two independent gates, both required:
//   - best score >= FUZZY_MIN_SCORE (enough real word overlap to be
//     plausibly the same subject, not just sharing one common word)
//   - best score beats the SECOND-best candidate by >= FUZZY_MIN_GAP (a
//     genuinely dominant winner, not "one of several plausible guesses")
// Verified against this wave's real data before being trusted (see
// docs/PHASE_3_RESOURCE_IMPORT_APPLIED.md "Mapping" section for the actual
// measured precision on a hand-checked sample).
const FUZZY_MIN_SCORE = 0.5;
const FUZZY_MIN_GAP = 0.25;

function tokenSet(name: string): Set<string> {
  return new Set(canonicalSubjectKey(name).split(/\s+/).filter((t) => t.length > 2));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function findDominantFuzzyMatch(name: string, candidates: SubjectRow[]): SubjectRow | null {
  if (candidates.length === 0) return null;
  const nameTokens = tokenSet(name);
  const scored = candidates
    .map((c) => ({ subject: c, score: jaccard(nameTokens, tokenSet(c.name)) }))
    .sort((a, b) => b.score - a.score);
  const best = scored[0];
  if (!best || best.score < FUZZY_MIN_SCORE) return null;
  const second = scored[1]?.score ?? 0;
  if (best.score - second < FUZZY_MIN_GAP) return null;
  return best.subject;
}

type ProgramMapping = {
  singleProgramMappings: Record<string, { targetSlug: string }>;
  poolProgramSlugs: { old: string[]; currentPoolProgramSlugs: string[] };
};

function loadProgramMapping(): ProgramMapping {
  return JSON.parse(readFileSync(PROGRAM_MAPPING_PATH, "utf-8"));
}

async function findExistingBySourceJsonName(prisma: PrismaClient, naturalKeys: string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (const batch of chunk([...new Set(naturalKeys)], CHUNK_SIZE)) {
    const rows = await prisma.resource.findMany({
      where: { sourceJsonName: { in: batch } },
      select: { sourceJsonName: true },
    });
    for (const r of rows) if (r.sourceJsonName) found.add(r.sourceJsonName);
  }
  return found;
}

type SubjectRow = { id: string; name: string; termOrder: number; programSlug: string };

/** Reads the whole Subject table once, in bounded cursor-paginated pages
 * (never a single unrestricted findMany), and indexes it by Program.slug —
 * every subsequent lookup in this module is an in-memory scoped search
 * within one programme's (or the 5 pool programmes') subjects, not a fresh
 * DB round trip per record. */
async function loadSubjectsByProgram(prisma: PrismaClient): Promise<Map<string, SubjectRow[]>> {
  const byProgram = new Map<string, SubjectRow[]>();
  const take = 1000;
  let cursor: string | undefined;
  for (;;) {
    const page = await prisma.subject.findMany({
      take,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      orderBy: { id: "asc" },
      select: { id: true, name: true, term: { select: { order: true, program: { select: { slug: true } } } } },
    });
    for (const s of page) {
      const row: SubjectRow = { id: s.id, name: s.name, termOrder: s.term.order, programSlug: s.term.program.slug };
      const list = byProgram.get(row.programSlug);
      if (list) list.push(row);
      else byProgram.set(row.programSlug, [row]);
    }
    if (page.length < take) break;
    cursor = page[page.length - 1].id;
  }
  return byProgram;
}

/** Resolves one record's target Subject following the preferred hierarchy:
 * 2. approved programme mapping + exact name match (single-program case)
 *    or pool-scoped exact name match (pool case)
 * 3. same, narrowed by term/semester order when the name alone is ambiguous
 * 4. name + programme only (same as 2/3 collapsed — kept distinct in the
 *    return value for reporting)
 * 5. unique global name match — ONLY tried if the programme-scoped search
 *    found zero candidates (e.g. mapping gap), and only if the name is
 *    unique across the ENTIRE catalogue (never picked among 2+).
 * Tier 1 ("exact known Subject ID/code") does not apply to this source —
 * the old export's subjectId is from a different database and carries no
 * meaning in the target DB.
 */
function resolveSubject(
  record: PlannedResourceRecord,
  subjectsByProgram: Map<string, SubjectRow[]>,
  mapping: ProgramMapping,
): { candidates: SubjectRow[]; tier: MatchTier; reason: string } {
  const variants = nameVariants(record.original.exportSubjectName);
  const variantKeys = new Set(variants.map((v) => canonicalSubjectKey(v)));

  const isPool = mapping.poolProgramSlugs.old.includes(record.data.exportProgramSlug);
  const scopedProgramSlugs: string[] = isPool
    ? mapping.poolProgramSlugs.currentPoolProgramSlugs
    : mapping.singleProgramMappings[record.data.exportProgramSlug]
      ? [mapping.singleProgramMappings[record.data.exportProgramSlug].targetSlug]
      : [];

  const scopedSubjects = scopedProgramSlugs.flatMap((slug) => subjectsByProgram.get(slug) ?? []);
  const nameMatches = scopedSubjects.filter((s) => variantKeys.has(canonicalSubjectKey(s.name)));

  if (nameMatches.length === 1) {
    return {
      candidates: nameMatches,
      tier: isPool ? "name-program" : "approved-alias",
      reason: `Matched "${record.original.exportSubjectName}" -> "${nameMatches[0].name}" within programme "${scopedProgramSlugs.join("/")}" (${isPool ? "pool-scoped" : "mapped programme"}).`,
    };
  }

  if (nameMatches.length > 1) {
    // Ambiguous by name alone within the scoped programme(s) — try
    // narrowing by term/semester order before giving up.
    if (record.data.exportTermOrder != null) {
      const termNarrowed = nameMatches.filter((s) => s.termOrder === record.data.exportTermOrder);
      if (termNarrowed.length === 1) {
        return {
          candidates: termNarrowed,
          tier: "name-program-term",
          reason: `Matched "${record.original.exportSubjectName}" -> "${termNarrowed[0].name}" — name alone was ambiguous (${nameMatches.length} candidates), narrowed to 1 by old semester order ${record.data.exportTermOrder}.`,
        };
      }
    }
    return {
      candidates: nameMatches,
      tier: null,
      reason: `Ambiguous: ${nameMatches.length} Subjects in programme "${scopedProgramSlugs.join("/")}" share a name match for "${record.original.exportSubjectName}" (${nameMatches.map((c) => `${c.name} [sem ${c.termOrder}]`).join("; ")}) and old semester order (${record.data.exportTermOrder ?? "unknown"}) did not narrow it to one. Never auto-picked.`,
    };
  }

  // Nothing in the scoped programme(s) at all — either the programme
  // mapping is missing/wrong, or the subject genuinely doesn't exist in the
  // current catalogue. Last resort: a UNIQUE match anywhere in the whole
  // catalogue (still exact canonical-key equality, never fuzzy) — only
  // accepted if there is exactly one such Subject in the entire DB.
  const allSubjects = [...subjectsByProgram.values()].flat();
  const globalMatches = allSubjects.filter((s) => variantKeys.has(canonicalSubjectKey(s.name)));
  if (globalMatches.length === 1) {
    return {
      candidates: globalMatches,
      tier: "unique-global-name",
      reason: `No match within the mapped/pool programme(s) ("${scopedProgramSlugs.join("/") || "none mapped"}") — fell back to a global search and found exactly one Subject anywhere in the catalogue named "${globalMatches[0].name}" (programme "${globalMatches[0].programSlug}"). Accepted only because it was unique.`,
    };
  }
  if (globalMatches.length > 1) {
    return {
      candidates: globalMatches,
      tier: null,
      reason: `No match within the mapped/pool programme(s); a global fallback search found ${globalMatches.length} Subjects with this name across different programmes (${globalMatches.map((c) => c.programSlug).join(", ")}) — ambiguous, never auto-picked.`,
    };
  }

  // Tier 6, last resort: conservative fuzzy match, scoped to the same
  // mapped/pool programme(s) used above (never global — a fuzzy match
  // across the whole 7,650-Subject catalogue would be far too likely to
  // land on an unrelated subject that happens to share a couple of words).
  const fuzzy = findDominantFuzzyMatch(record.original.exportSubjectName, scopedSubjects);
  if (fuzzy) {
    return {
      candidates: [fuzzy],
      tier: "conservative-fuzzy-dominant",
      reason: `No exact-name match for "${record.original.exportSubjectName}" in programme "${scopedProgramSlugs.join("/")}" — token-overlap fuzzy match found a single, clearly-dominant candidate: "${fuzzy.name}" (next-best candidate scored at least ${FUZZY_MIN_GAP} lower). Flagged for spot-check in the applied report, not silently trusted.`,
    };
  }

  return {
    candidates: [],
    tier: null,
    reason: `No current Subject matches "${record.original.exportSubjectName}" (old programme "${record.original.exportProgramName}") — not found in the mapped programme(s), the elective pools, or anywhere else in the catalogue, including a conservative fuzzy pass.`,
  };
}

/** Subject resolution only, no storage/duplicate gating — used by
 * resource-storage.ts to know which real Subject id (and therefore which
 * canonical R2 key) each candidate resource would resolve to, BEFORE
 * deciding what (if anything) to upload. Kept separate from
 * computeResourceImportPlan so storage resolution never needs to guess at
 * or duplicate the matching hierarchy. */
export async function resolveAllSubjects(
  prisma: PrismaClient,
): Promise<Map<string, { record: PlannedResourceRecord; resolvedSubjectId: string; tier: MatchTier }>> {
  const source = loadResourceSource();
  const mapping = loadProgramMapping();
  const subjectsByProgram = await loadSubjectsByProgram(prisma);

  const resolved = new Map<string, { record: PlannedResourceRecord; resolvedSubjectId: string; tier: MatchTier }>();
  for (const record of source.records) {
    const resolution = resolveSubject(record, subjectsByProgram, mapping);
    if (resolution.candidates.length === 1) {
      resolved.set(record.naturalKey, { record, resolvedSubjectId: resolution.candidates[0].id, tier: resolution.tier });
    }
  }
  return resolved;
}

export async function computeResourceImportPlan(
  prisma: PrismaClient,
  storage?: StorageResolution,
): Promise<ResourceImportPlan> {
  const source = loadResourceSource();
  const mapping = loadProgramMapping();

  // --- Exact duplicate detection (within source) ---
  const byHash = new Map<string, PlannedResourceRecord[]>();
  const byUrl = new Map<string, PlannedResourceRecord[]>();
  for (const r of source.records) {
    if (r.data.fileHash) {
      const list = byHash.get(r.data.fileHash) ?? [];
      list.push(r);
      byHash.set(r.data.fileHash, list);
    }
    const urlList = byUrl.get(r.data.fileUrl) ?? [];
    urlList.push(r);
    byUrl.set(r.data.fileUrl, urlList);
  }
  const exactDuplicateGroups: { key: string; naturalKeys: string[] }[] = [];
  const exactDuplicateNaturalKeys = new Set<string>();
  for (const [hash, list] of byHash) {
    if (list.length < 2) continue;
    exactDuplicateGroups.push({ key: `fileHash:${hash}`, naturalKeys: list.map((r) => r.naturalKey) });
    for (const r of list.slice(1)) exactDuplicateNaturalKeys.add(r.naturalKey);
  }
  for (const [url, list] of byUrl) {
    if (list.length < 2) continue;
    if (exactDuplicateGroups.some((g) => g.naturalKeys.length === list.length && list.every((r) => g.naturalKeys.includes(r.naturalKey)))) continue;
    exactDuplicateGroups.push({ key: `fileUrl:${url}`, naturalKeys: list.map((r) => r.naturalKey) });
    for (const r of list.slice(1)) exactDuplicateNaturalKeys.add(r.naturalKey);
  }

  // --- Probable duplicate detection + classification (within source) ---
  // SAME_RESOURCE: same title+subject AND same fileSize (a re-export/re-save
  //   of the identical scan is virtually always byte-identical in size).
  // DIFFERENT_RESOURCE: same title+subject but meaningfully different
  //   fileSize/year — plausibly two different papers that happen to share a
  //   title (e.g. two different years' PYQs titled identically).
  // UNRESOLVED_DUPLICATE: same title+subject, sizes close but not equal,
  //   year missing/equal — genuinely can't tell; skipped, never guessed.
  const byTitleSubject = new Map<string, PlannedResourceRecord[]>();
  for (const r of source.records) {
    const key = `${r.data.title.toLocaleLowerCase()}::${r.data.subjectCanonicalKey}`;
    const list = byTitleSubject.get(key) ?? [];
    list.push(r);
    byTitleSubject.set(key, list);
  }
  const probableDuplicateGroups: ResourceImportPlan["probableDuplicateGroups"] = [];
  const probableDuplicateSkipNaturalKeys = new Set<string>();
  for (const [key, list] of byTitleSubject) {
    if (list.length < 2) continue;
    const notExact = list.filter((r) => !exactDuplicateNaturalKeys.has(r.naturalKey));
    if (notExact.length < 2) continue;

    const sizes = new Set(notExact.map((r) => r.data.fileSize));
    const years = new Set(notExact.map((r) => r.data.year));
    let classification: "SAME_RESOURCE" | "DIFFERENT_RESOURCE" | "UNRESOLVED_DUPLICATE";
    let reason: string;
    if (sizes.size === 1) {
      classification = "SAME_RESOURCE";
      reason = `Same normalized title + same subject ("${key}") and identical fileSize (${[...sizes][0]} bytes) — treated as the same underlying paper; only the first occurrence is kept.`;
      for (const r of notExact.slice(1)) probableDuplicateSkipNaturalKeys.add(r.naturalKey);
    } else if (years.size > 1 && [...years].every((y) => y != null)) {
      classification = "DIFFERENT_RESOURCE";
      reason = `Same normalized title + same subject ("${key}") but different exam years (${[...years].join(", ")}) and different fileSize — treated as genuinely different papers, both kept.`;
    } else {
      classification = "UNRESOLVED_DUPLICATE";
      reason = `Same normalized title + same subject ("${key}"), differing fileSize (${[...sizes].join(", ")} bytes) with no distinguishing year — cannot safely tell if these are the same paper re-saved or different papers. Skipped, not guessed.`;
      for (const r of notExact) probableDuplicateSkipNaturalKeys.add(r.naturalKey);
    }
    probableDuplicateGroups.push({ reason, classification, naturalKeys: notExact.map((r) => r.naturalKey) });
  }

  const existingNaturalKeys = await findExistingBySourceJsonName(prisma, source.records.map((r) => r.naturalKey));
  const subjectsByProgram = await loadSubjectsByProgram(prisma);

  const outcomes: ResourceOutcome[] = [];
  for (const record of source.records) {
    if (existingNaturalKeys.has(record.naturalKey)) {
      outcomes.push({ status: "skip_existing", record, reason: "Resource with this sourceJsonName already exists in target" });
      continue;
    }

    const issues: string[] = [];
    if (!record.data.title) issues.push("title: empty after normalization");
    if (!record.data.fileName) issues.push("fileName: missing");
    if (!record.data.fileUrl) issues.push("fileUrl: missing");
    if (record.data.fileSize <= 0) issues.push(`fileSize: invalid (${record.data.fileSize})`);
    if (record.data.type !== "PYQ" && record.data.type !== "NOTES") issues.push(`type: unexpected value "${record.data.type}"`);
    if (issues.length > 0) {
      outcomes.push({ status: "rejected", record, issues });
      continue;
    }

    if (exactDuplicateNaturalKeys.has(record.naturalKey)) {
      outcomes.push({ status: "rejected", record, issues: [`Exact duplicate of another source row (same fileHash or fileUrl) — see exactDuplicateGroups in the report.`] });
      continue;
    }
    if (probableDuplicateSkipNaturalKeys.has(record.naturalKey)) {
      outcomes.push({ status: "rejected", record, issues: [`Probable duplicate (SAME_RESOURCE or UNRESOLVED_DUPLICATE) — see probableDuplicateGroups in the report.`] });
      continue;
    }

    const resolution = resolveSubject(record, subjectsByProgram, mapping);
    if (resolution.candidates.length !== 1) {
      outcomes.push({
        status: "unresolved_subject",
        record,
        reason: resolution.reason,
        candidateSubjectIds: resolution.candidates.map((c) => c.id),
      });
      continue;
    }

    const confirmed = storage?.confirmedByNaturalKey.get(record.naturalKey);
    if (!confirmed) {
      outcomes.push({
        status: "missing_storage_reference",
        record,
        reason: record.data.fileUrl.startsWith("/uploads/")
          ? `fileUrl "${record.data.fileUrl}" is a local dev-storage path — not verified reachable. See docs/PHASE_3_RESOURCE_IMPORT_APPLIED.md storage section for what was and wasn't uploaded.`
          : `fileUrl "${record.data.fileUrl}" was not confirmed against the live R2 bucket this run.`,
      });
      continue;
    }

    outcomes.push({
      status: "insert",
      record: { ...record, data: { ...record.data, fileUrl: confirmed.fileUrl, fileHash: confirmed.fileHash ?? record.data.fileHash } },
      resolvedSubjectId: resolution.candidates[0].id,
      matchTier: resolution.tier,
      matchReason: resolution.reason,
    });
  }

  return {
    sourceName: source.sourceName,
    sourceFile: source.sourceFile,
    sourceRecordCount: source.records.length,
    sourceWarnings: source.warnings,
    outcomes,
    exactDuplicateGroups,
    probableDuplicateGroups,
  };
}
