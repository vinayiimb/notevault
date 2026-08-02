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
export function canonicalSubjectKey(value: string) {
  return tidySubjectName(value)
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
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
