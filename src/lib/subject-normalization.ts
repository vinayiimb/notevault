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
 */
export function canonicalSubjectKey(value: string) {
  return tidySubjectName(value)
    .toLocaleLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
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
