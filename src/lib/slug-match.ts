/**
 * Forgiving slug matching for /papers URLs that people (and LLMs) guess:
 * "bcom-honours", "b-com-hons", "ba-honours-economics", "financial-accounting-sem-1".
 * Pure — no data access — so it can be checked with scripts/slug-match.check.ts.
 */

const PHRASES: [RegExp, string][] = [
  [/\bbachelor-of-arts\b/g, "ba"],
  [/\bbachelor-of-science\b/g, "bsc"],
  [/\bbachelor-of-commerce\b/g, "bcom"],
  [/\bbachelor-of-business-administration\b/g, "bba"],
  [/\bbachelor-of-management-studies\b/g, "bms"],
];

const WORDS: Record<string, string> = {
  honours: "hons", honors: "hons", honour: "hons", h: "hons",
  program: "prog", programme: "prog", p: "prog", pass: "prog",
  socialogy: "sociology", maths: "mathematics", math: "mathematics",
  organization: "organisation", organizational: "organisational", behavior: "behaviour",
  eco: "economics", econ: "economics", polsci: "political-science", cs: "computer-science",
};

// Words that carry no identity — dropped before comparing.
const STOP = new Set([
  "and", "of", "the", "in", "with", "for", "du", "delhi", "university",
  "pyq", "pyqs", "papers", "paper", "previous", "year", "question", "questions", "pdf",
  "course", "courses", "as", "major", "discipline", "sem", "semester",
  "1", "2", "3", "4", "5", "6", "7", "8", "i", "ii", "iii", "iv", "v", "vi", "vii", "viii",
]);

export function slugTokens(slug: string): string[] {
  let s = slug.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  for (const [re, to] of PHRASES) s = s.replace(re, to);
  // Glue split degree letters: "b-a" → "ba", "b-sc" → "bsc", "b-com" → "bcom", "b-voc" → "bvoc".
  s = s.replace(/\bb-(a|sc|com|voc|ba|ms|tech|el-ed)\b/g, "b$1");
  return s
    .split("-")
    .filter(Boolean)
    .map((w) => WORDS[w] ?? w)
    .flatMap((w) => w.split("-"))
    .filter((w) => !STOP.has(w));
}

/** Best candidate slug for `query`, or null when nothing is a convincing match. */
export function bestSlug(query: string, candidates: string[]): string | null {
  const q = new Set(slugTokens(query));
  if (q.size === 0) return null;
  let best: string | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const t = new Set(slugTokens(c));
    if (t.size === 0) continue;
    let hit = 0;
    for (const w of q) if (t.has(w)) hit++;
    // Recall of the query matters most; precision breaks ties toward the tighter slug.
    const score = hit / q.size + (0.5 * hit) / t.size;
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  // Every query word must land, or half of them on a 3+ word query.
  return bestScore >= (q.size >= 3 ? 0.75 : 1.2) ? best : null;
}

/** Semester number the query mentions ("sem-3", "semester-iii"), if any. */
export function semesterFromSlug(slug: string): number | null {
  const m = slug.toLowerCase().match(/\b(?:sem|semester)-?(viii|vii|vi|iv|v|iii|ii|i|[1-8])\b/);
  if (!m) return null;
  const r: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
  return r[m[1]] ?? Number(m[1]);
}
