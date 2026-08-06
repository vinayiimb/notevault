// Duplicate detection over an in-memory batch — never an unrestricted
// findMany() against the database (Phase 2C item 4's explicit requirement).
// Cross-checking against the target DB is done separately with bounded,
// keyed lookups (see db-lookup.ts), not by scanning whole tables.
import { exactDuplicateKey, probableDuplicateKey } from "./normalize";

export type DuplicateGroup<T> = { key: string; items: T[] };

/** Exact duplicates: identical on every field in `keyOf`. */
export function findExactDuplicates<T>(items: T[], keyOf: (item: T) => string[]): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = exactDuplicateKey(...keyOf(item));
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()].filter(([, list]) => list.length > 1).map(([key, items]) => ({ key, items }));
}

/** Probable duplicates: same canonical-normalized key (case/punctuation/spacing/roman-numeral
 * insensitive — e.g. "Company Law" vs "company law" vs "Company Law-III" vs "Company Law III")
 * but not byte-identical, so not caught by findExactDuplicates. */
export function findProbableDuplicates<T>(items: T[], keyOf: (item: T) => string[]): DuplicateGroup<T>[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = probableDuplicateKey(...keyOf(item));
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .filter(([, list]) => list.length > 1)
    .map(([key, items]) => ({ key, items }))
    .filter((group) => {
      // Exclude groups that are ALSO exact duplicates of each other on every
      // member pairwise — those were already reported by findExactDuplicates.
      const exactKeys = new Set(group.items.map((i) => JSON.stringify(i)));
      return exactKeys.size > 1;
    });
}

/** Subject-name spelling/capitalization variants across a batch, grouped by
 * canonical key, for the proposed-subject-aliases report — separate from
 * probable-duplicate detection because aliases are a review artifact, not a
 * rejection reason. */
export function proposeSubjectAliases(
  subjectNames: string[],
): { canonicalKey: string; variants: string[] }[] {
  const groups = new Map<string, Set<string>>();
  for (const name of subjectNames) {
    const key = probableDuplicateKey(name);
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key)!.add(name);
  }
  return [...groups.entries()]
    .filter(([, variants]) => variants.size > 1)
    .map(([canonicalKey, variants]) => ({ canonicalKey, variants: [...variants].sort() }));
}
