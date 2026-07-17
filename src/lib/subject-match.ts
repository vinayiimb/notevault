// Best-effort filename -> subject matching for bulk PDF uploads. Subjects
// named like "BC 1.2 — Financial Accounting" carry a code before the dash;
// others are matched purely on significant words in the title.
export type MatchableSubject = { id: string; name: string };

const STOPWORDS = new Set(["and", "for", "the", "of", "in", "to", "with", "on", "a", "an"]);

function normalizeLoose(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeWords(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function splitSubjectName(name: string): { code: string | null; title: string } {
  // Handles "BC 1.2 — Financial Accounting" and "DSC-2.1 — Corporate Accounting" alike:
  // split on the first em/en-dash-with-spaces, and separately allow a plain hyphen
  // to appear inside the code itself (DSC-2.1), not just between code and title.
  const emDashParts = name.split(/\s+[—–]\s+/);
  if (emDashParts.length >= 2 && /^[A-Za-z]{1,6}[\s-]?\d/.test(emDashParts[0])) {
    return { code: emDashParts[0].trim(), title: emDashParts.slice(1).join(" ").trim() };
  }
  const hyphenParts = name.split(/\s+-\s+/);
  if (hyphenParts.length >= 2 && /^[A-Za-z]{1,6}[\s-]?\d/.test(hyphenParts[0])) {
    return { code: hyphenParts[0].trim(), title: hyphenParts.slice(1).join(" ").trim() };
  }
  return { code: null, title: name };
}

// Collapses a title down to a stable key by stripping trailing paper/roll
// numbers (e.g. "Corporate Accounting 3666" and "Corporate Accounting 4210"
// both become "corporate accounting"), so a manually-corrected match can be
// remembered and re-applied to future papers of the same subject regardless
// of which specific paper code is in the filename.
export function normalizeMemoryKey(title: string): string {
  let s = title.trim();
  let prev: string;
  do {
    prev = s;
    s = s.replace(/\s*\(\d+\)\s*$/, "");
    s = s.replace(/\s*\d+\s*$/, "");
  } while (s !== prev && s.length > 0);
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function guessSubject(
  filename: string,
  subjects: MatchableSubject[],
  memory?: Record<string, string>
): string | null {
  const base = filename.replace(/\.pdf$/i, "");

  if (memory) {
    const key = normalizeMemoryKey(base.replace(/[_-]+/g, " "));
    const remembered = memory[key];
    if (remembered && subjects.some((s) => s.id === remembered)) {
      return remembered;
    }
  }

  const filenameLoose = normalizeLoose(base);
  const filenameWords = normalizeWords(base);

  let best: { id: string; score: number } | null = null;

  for (const subject of subjects) {
    const { code, title } = splitSubjectName(subject.name);
    let score = 0;

    if (code) {
      const codeLoose = normalizeLoose(code);
      if (codeLoose.length >= 3 && filenameLoose.includes(codeLoose)) {
        score += 10;
      }
    }

    // Deduped: a title like "Finance for Non-Finance Executives" contains
    // "finance" twice, which previously counted as two distinct matched
    // words against a filename containing "finance" once — crossing the
    // "at least two words" threshold below on a single coincidental word.
    const titleWords = [
      ...new Set(normalizeWords(title).filter((w) => w.length > 3 && !STOPWORDS.has(w))),
    ];
    const filenameWordSet = new Set(filenameWords);
    const matched = titleWords.filter((w) => filenameWordSet.has(w));
    // Require at least two matching significant words for a title-based match —
    // a single coincidental shared word (e.g. "basics") isn't a reliable signal
    // on its own and would otherwise cross the threshold below.
    if (titleWords.length > 0 && matched.length >= 2) {
      score += (matched.length / titleWords.length) * 6;
    }

    if (!best || score > best.score) {
      best = { id: subject.id, score };
    }
  }

  if (best && best.score >= 3) return best.id;
  return null;
}
