const SEMESTER_SUFFIX =
  /\s*[-–—,:;|/]*\s*(?:\(?\s*)?\bsem(?:ester)?\s*[-:]*\s*(?:[1-8]|viii|vii|vi|iv|v|iii|ii|i)\b(?:\s*\)?)?\s*$/i;

const TRAILING_SOURCE_LABEL =
  /\s*[-–—,:;|/]*\s*\((?:core|old course)\)\s*$/i;

function tidySubjectName(value: string) {
  let result = value
    .normalize("NFKC")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  let previous: string;
  do {
    previous = result;
    result = result
      .replace(SEMESTER_SUFFIX, "")
      .replace(TRAILING_SOURCE_LABEL, "")
      .replace(/\s+/g, " ")
      .trim();
  } while (result !== previous);
  return result || value.trim();
}

/**
 * Conservative identity key for subject headings. It intentionally merges
 * presentation-only differences (case, punctuation, whitespace, and an
 * explicit trailing "Sem/Semester N") while preserving meaningful paper
 * levels such as Microeconomics I vs Microeconomics II.
 *
 * Uses \p{L}/\p{N} (Unicode letter/number categories), not [a-z0-9] — a
 * plain ASCII class silently strips every non-Latin subject name (Hindi,
 * Sanskrit, ...) down to an empty string, which then collapses every such
 * subject onto the same "duplicate" key regardless of actual content.
 */
export function canonicalCourseName(courseName: string): string {
  if (!courseName) return "General / Interdisciplinary";
  const norm = courseName.trim().replace(/\s+/g, " ");

  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*eco/i.test(norm) || /^economics$/i.test(norm)) return "B.A. (H) Economics";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*geog/i.test(norm) || /^geography$/i.test(norm)) return "B.A. (H) Geography";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*hist/i.test(norm) || /^history$/i.test(norm)) return "B.A. (H) History";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*pol/i.test(norm) || /^political science$/i.test(norm)) return "B.A. (H) Political Science";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*eng/i.test(norm) || /^english$/i.test(norm)) return "B.A. (H) English";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*hin/i.test(norm) || /^hindi$/i.test(norm)) return "B.A. (H) Hindi";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*skt/i.test(norm) || /^sanskrit$/i.test(norm)) return "B.A. (H) Sanskrit";
  if (/b\.?a\.?\s*\(?h(?:ons)?\.?\)?\s*soc/i.test(norm) || /^sociology$/i.test(norm)) return "B.A. (H) Sociology";
  if (/b\.?com\.?\s*\(?h(?:ons)?\.?\)?/i.test(norm)) return "B.Com. (H)";
  if (/b\.?com\.?\s*\(?prog(?:ramme)?\.?\)?/i.test(norm)) return "B.Com. (Programme)";
  if (/b\.?a\.?\s*\(?prog(?:ramme)?\.?\)?/i.test(norm)) return "B.A. (Programme)";

  if (/b\.?sc\.?\s*\(?h(?:ons)?\.?\)?\s*zool/i.test(norm) || /^zoology$/i.test(norm)) return "B.Sc. (H) Zoology";
  if (/b\.?sc\.?\s*\(?h(?:ons)?\.?\)?\s*bot/i.test(norm) || /^botany$/i.test(norm)) return "B.Sc. (H) Botany";
  if (/b\.?sc\.?\s*\(?h(?:ons)?\.?\)?\s*chem/i.test(norm) || /^chemistry$/i.test(norm)) return "B.Sc. (H) Chemistry";
  if (/b\.?sc\.?\s*\(?h(?:ons)?\.?\)?\s*phys/i.test(norm) || /^physics$/i.test(norm)) return "B.Sc. (H) Physics";
  if (/b\.?sc\.?\s*\(?h(?:ons)?\.?\)?\s*math/i.test(norm) || /^mathematics$/i.test(norm)) return "B.Sc. (H) Mathematics";

  return norm;
}

export function canonicalSubjectKey(value: string) {
  return tidySubjectName(value)
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------- Subject Normalization Centre: Stage A comparison key ----------
// Kept separate from canonicalSubjectKey (which existing callers like
// matchOfficialSubject rely on unchanged). This key is only used to find
// duplicate-name *candidates* for admin review — it never overwrites a raw
// subject name. It deliberately keeps numbered/lettered papers distinct
// (Financial Accounting I != Financial Accounting II): roman/arabic numeral
// *style* is normalized so both compare equal to each other, but different
// numbers still produce different keys.

const ROMAN_TO_ARABIC: Record<string, string> = {
  i: "1",
  ii: "2",
  iii: "3",
  iv: "4",
  v: "5",
  vi: "6",
  vii: "7",
  viii: "8",
};

type Replacer = string | ((substring: string, ...groups: string[]) => string);
const WORD_SYNONYMS: [RegExp, Replacer][] = [
  [/\bprogramme\b/g, "program"],
  [/\bhonours\b/g, "hons"],
  [/\bhon\b/g, "hons"],
  [/\bpaper\s+(i|ii|iii|iv|v|vi|vii|viii)\b/g, (_m, num) => `paper ${ROMAN_TO_ARABIC[num]}`],
  [/\bpart\s+(i|ii|iii|iv|v|vi|vii|viii)\b/g, (_m, num) => `part ${ROMAN_TO_ARABIC[num]}`],
  // A bare trailing roman numeral ("Microeconomics III") behaves the same
  // way as "Paper III" for comparison purposes — normalize its *style* to
  // arabic without touching the number itself, so "Microeconomics III" and
  // "Microeconomics 3" compare equal while "Microeconomics II" stays distinct.
  [/\b(i|ii|iii|iv|v|vi|vii|viii)$/g, (m) => ROMAN_TO_ARABIC[m]],
];

// "practical"/"practice" are deliberately NOT equated here (unlike the
// synonyms above) — the spec calls this substitution valid "only when
// context supports it", and a blind merge risks conflating a lab
// Practical paper with an unrelated "... Law and Practice" subject. Stage
// B (AI, with full course/semester context) is a safer place to make that
// call than a blanket string rule; the fuzzy token scorer in
// subject-grouping.ts still surfaces these as candidates for it to review.

/**
 * Stage A deterministic comparison key for the Subject Normalization
 * Centre's duplicate-candidate detection. Builds on canonicalSubjectKey
 * (lowercase, whitespace, punctuation, &/and) and additionally:
 *  - standardizes programme/program, honours/hons
 *  - standardizes "Paper I"/"Part I"/trailing "... III" to arabic numerals
 *    so notation style never causes a false "different subject" split
 * Two subjects sharing this key are near-certain duplicates (Stage A);
 * everything else falls through to fuzzy scoring / Stage B AI review.
 */
export function stageANormalize(value: string): string {
  let key = canonicalSubjectKey(value);
  for (const [pattern, replacement] of WORD_SYNONYMS) {
    key = typeof replacement === "string" ? key.replace(pattern, replacement) : key.replace(pattern, replacement);
  }
  return key.replace(/\s+/g, " ").trim();
}

function isAllCaps(value: string) {
  const letters = value.replace(/[^A-Za-z]+/g, "");
  return letters.length >= 3 && letters === letters.toUpperCase();
}

function labelScore(value: string) {
  const tidy = tidySubjectName(value);
  let score = 0;
  if (tidy === value.trim()) score += 20;
  if (!isAllCaps(tidy)) score += 10;
  score -= tidy.length / 1000;
  return score;
}

export function preferredSubjectLabel(values: string[]) {
  const candidates = [...new Set(values.map(tidySubjectName).filter(Boolean))];
  return (
    candidates.sort(
      (a, b) => labelScore(b) - labelScore(a) || a.localeCompare(b),
    )[0] ?? "Subject"
  );
}

export type CanonicalCandidate = {
  id: string;
  name: string;
  upc?: string | null;
  resourceCount: number;
  questionCount: number;
};

/**
 * Recommends which subject in a duplicate group should become the
 * canonical/master subject — the merge target every other member's
 * resources move into. Priority order (highest first):
 *  1. Has an official UPC (syllabus paper code) — a real catalogue anchor
 *     beats a plain scraped name every time.
 *  2. Most linked records (resources + questions) — the row with the most
 *     real content is the safest default target; keeping content on the
 *     canonical side needs no reassignment at all.
 *  3. Name-quality score (capitalization, no stray whitespace) — a tie-
 *     breaker only, same heuristic preferredSubjectLabel already uses.
 * The admin can always override this in the UI — this only picks the
 * default radio selection, never applies anything by itself.
 */
export function recommendCanonicalSubject(candidates: CanonicalCandidate[]): string | null {
  if (candidates.length === 0) return null;
  const ranked = [...candidates].sort((a, b) => {
    const upcScore = (Boolean(b.upc) ? 1 : 0) - (Boolean(a.upc) ? 1 : 0);
    if (upcScore !== 0) return upcScore;
    const contentScore = (b.resourceCount + b.questionCount) - (a.resourceCount + a.questionCount);
    if (contentScore !== 0) return contentScore;
    return labelScore(b.name) - labelScore(a.name) || a.name.localeCompare(b.name);
  });
  return ranked[0].id;
}

export function normalizedSubjectLabel(value: string) {
  return tidySubjectName(value);
}

export function canonicalUpc(value: string | null | undefined) {
  return (value ?? "").normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, "").toLocaleUpperCase();
}

export function extractUpcCandidate(value: string | null | undefined) {
  if (!value) return null;
  // DU codes are normally long numeric identifiers; allow visual separators
  // used in filenames while avoiding ordinary four-digit exam years.
  const withoutExamYears = value.replace(/(?<!\d)(?:19|20)\d{2}(?!\d)/g, " ");
  const matches = withoutExamYears.match(/(?<!\d)(?:\d[\s_-]*){7,16}(?!\d)/g) ?? [];
  const candidates = matches.map(canonicalUpc).filter((candidate) => /^\d{7,16}$/.test(candidate));
  return candidates.length === 1 ? candidates[0] : null;
}

export type OfficialSubjectCandidate = {
  id: string;
  name: string;
  upc?: string | null;
  aliases?: readonly string[];
};

export type OfficialSubjectMatch = {
  subject: OfficialSubjectCandidate | null;
  method: "UPC" | "OFFICIAL_NAME" | "ALIAS" | "NONE" | "AMBIGUOUS";
};

/**
 * Strict matcher for a list already scoped to one course + semester.
 * UPC wins, followed by the official name and then admin-approved aliases.
 * Fuzzy guesses never attach a file: zero or multiple hits go to review.
 */
export function matchOfficialSubject(
  candidates: readonly OfficialSubjectCandidate[],
  input: { subjectName?: string | null; upc?: string | null },
): OfficialSubjectMatch {
  const inputUpc = canonicalUpc(input.upc);
  if (inputUpc) {
    const hits = candidates.filter((candidate) => canonicalUpc(candidate.upc) === inputUpc);
    if (hits.length === 1) return { subject: hits[0], method: "UPC" };
    if (hits.length > 1) return { subject: null, method: "AMBIGUOUS" };
  }

  const inputName = canonicalSubjectKey(input.subjectName ?? "");
  if (!inputName) return { subject: null, method: "NONE" };

  const officialHits = candidates.filter((candidate) => canonicalSubjectKey(candidate.name) === inputName);
  if (officialHits.length === 1) return { subject: officialHits[0], method: "OFFICIAL_NAME" };
  if (officialHits.length > 1) return { subject: null, method: "AMBIGUOUS" };

  const aliasHits = candidates.filter((candidate) =>
    (candidate.aliases ?? []).some((alias) => canonicalSubjectKey(alias) === inputName),
  );
  if (aliasHits.length === 1) return { subject: aliasHits[0], method: "ALIAS" };
  if (aliasHits.length > 1) return { subject: null, method: "AMBIGUOUS" };

  return { subject: null, method: "NONE" };
}
