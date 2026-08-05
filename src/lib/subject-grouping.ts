import { canonicalUpc, stageANormalize } from "@/lib/subject-normalization";

// Efficiency layer for the Subject Normalization Centre (see spec section
// 10): cheap deterministic + fuzzy scoring runs over every subject first so
// only genuinely uncertain clusters ever get sent to the AI (Stage B).

export type GroupableSubject = {
  id: string;
  name: string;
  upc?: string | null;
  aliases?: readonly string[];
};

export type CandidateGroup = {
  subjectIds: string[];
  /** true when every member shares an exact Stage A key or UPC — a
   * deterministic duplicate, not a fuzzy guess. */
  exact: boolean;
  /** 0-100 heuristic score behind the grouping, used to prioritize review
   * and to decide whether a group is confident enough to skip Stage B. */
  score: number;
};

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const currentRow = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      currentRow[j] = Math.min(
        prevRow[j] + 1, // deletion
        currentRow[j - 1] + 1, // insertion
        prevRow[j - 1] + cost // substitution
      );
    }
    prevRow = currentRow;
  }
  return prevRow[n];
}

/** 0 (nothing alike) to 1 (identical) edit-distance similarity. */
function editSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** 0 to 1 Jaccard similarity over whitespace-split word sets. */
function tokenSimilarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter(Boolean));
  const setB = new Set(b.split(" ").filter(Boolean));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const word of setA) if (setB.has(word)) intersection++;
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

// Below this, two names are treated as unrelated and never grouped —
// avoids flooding Stage B with pairs like "Financial Accounting" vs
// "Financial Management" that share one word but are genuinely different.
const FUZZY_FLOOR = 0.55;
// At/above this combined score, treat it as exact-equivalent to a Stage A
// key match (skips Stage B entirely) — reserved for near-identical strings
// (typos) rather than merely related ones.
const HIGH_CONFIDENCE_FLOOR = 0.92;

class UnionFind {
  private parent = new Map<string, string>();

  find(id: string): string {
    if (!this.parent.has(id)) this.parent.set(id, id);
    const p = this.parent.get(id)!;
    if (p === id) return id;
    const root = this.find(p);
    this.parent.set(id, root);
    return root;
  }

  union(a: string, b: string) {
    const rootA = this.find(a);
    const rootB = this.find(b);
    if (rootA !== rootB) this.parent.set(rootA, rootB);
  }
}

/**
 * Groups subjects (already scoped to one Term/Program by the caller — never
 * mix programmes here) into candidate duplicate clusters using Stage A keys,
 * UPC matches, and fuzzy name similarity. Returns two buckets:
 *  - exact groups: safe to surface as high-confidence suggestions directly
 *  - fuzzy groups: uncertain, should be sent to Stage B AI review
 * Subjects with no candidate match at all are simply omitted from the result.
 */
export function computeCandidateGroups(subjects: GroupableSubject[]): {
  exactGroups: CandidateGroup[];
  fuzzyGroups: CandidateGroup[];
} {
  const keyed = subjects.map((s) => ({
    subject: s,
    key: stageANormalize(s.name),
    upc: canonicalUpc(s.upc),
  }));

  const exact = new UnionFind();
  const byKey = new Map<string, string[]>();
  for (const item of keyed) {
    if (!item.key) continue;
    const list = byKey.get(item.key) ?? [];
    list.push(item.subject.id);
    byKey.set(item.key, list);
  }
  for (const ids of byKey.values()) {
    for (let i = 1; i < ids.length; i++) exact.union(ids[0], ids[i]);
  }

  // Equal non-null UPC is stronger evidence than name similarity — union
  // regardless of how different the names look (e.g. a renamed syllabus).
  const byUpc = new Map<string, string[]>();
  for (const item of keyed) {
    if (!item.upc) continue;
    const list = byUpc.get(item.upc) ?? [];
    list.push(item.subject.id);
    byUpc.set(item.upc, list);
  }
  for (const ids of byUpc.values()) {
    for (let i = 1; i < ids.length; i++) exact.union(ids[0], ids[i]);
  }

  const exactGroupsById = new Map<string, string[]>();
  for (const item of keyed) {
    const root = exact.find(item.subject.id);
    const list = exactGroupsById.get(root) ?? [];
    list.push(item.subject.id);
    exactGroupsById.set(root, list);
  }
  const exactGroups: CandidateGroup[] = [...exactGroupsById.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => ({ subjectIds: ids, exact: true, score: 98 }));

  const groupedIds = new Set(exactGroups.flatMap((g) => g.subjectIds));

  // Fuzzy pass: pairwise compare everything not already exact-grouped.
  // O(n^2) is fine here — grouping always runs scoped to one Term (a few
  // dozen subjects at most), never the whole catalog at once.
  const remaining = keyed.filter((item) => !groupedIds.has(item.subject.id));
  const fuzzy = new UnionFind();
  const pairScores = new Map<string, number>();

  for (let i = 0; i < remaining.length; i++) {
    for (let j = i + 1; j < remaining.length; j++) {
      const a = remaining[i];
      const b = remaining[j];

      // Conflicting non-null UPCs are strong evidence these are genuinely
      // different papers, regardless of name similarity — never group.
      if (a.upc && b.upc && a.upc !== b.upc) continue;

      const tokenScore = tokenSimilarity(a.key, b.key);
      // Edit distance is only a meaningful duplicate signal for near-typos
      // (a handful of characters off) — on multi-word phrases, one entirely
      // different word (e.g. "Financial Accounting" vs "Financial
      // Management") can still score deceptively high on *relative* edit
      // similarity purely from the shared prefix, so it's gated behind a
      // small *absolute* distance instead of used directly.
      const absoluteDistance = levenshtein(a.key, b.key);
      const isNearTypo = absoluteDistance <= 3;
      const editScore = isNearTypo ? editSimilarity(a.key, b.key) : 0;
      const combined = Math.max(tokenScore, editScore);
      if (combined < FUZZY_FLOOR) continue;

      fuzzy.union(a.subject.id, b.subject.id);
      const pairKey = [a.subject.id, b.subject.id].sort().join("::");
      pairScores.set(pairKey, combined);
    }
  }

  const fuzzyGroupsById = new Map<string, string[]>();
  for (const item of remaining) {
    const root = fuzzy.find(item.subject.id);
    const list = fuzzyGroupsById.get(root) ?? [];
    list.push(item.subject.id);
    fuzzyGroupsById.set(root, list);
  }

  const fuzzyGroups: CandidateGroup[] = [...fuzzyGroupsById.values()]
    .filter((ids) => ids.length > 1)
    .map((ids) => {
      let best = 0;
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const key = [ids[i], ids[j]].sort().join("::");
          best = Math.max(best, pairScores.get(key) ?? 0);
        }
      }
      return { subjectIds: ids, exact: false, score: Math.round(best * 100) };
    });

  // A fuzzy group that scored high enough to be effectively certain (near-
  // identical strings, typos) can skip the AI call.
  const promoted = fuzzyGroups.filter((g) => g.score / 100 >= HIGH_CONFIDENCE_FLOOR);
  const stillFuzzy = fuzzyGroups.filter((g) => g.score / 100 < HIGH_CONFIDENCE_FLOOR);

  return {
    exactGroups: [...exactGroups, ...promoted],
    fuzzyGroups: stillFuzzy,
  };
}
