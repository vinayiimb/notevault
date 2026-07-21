export type QualitySubject = {
  id: string;
  name: string;
  slug: string;
  term: {
    id: string;
    name: string;
    program: { id: string; name: string };
  };
  _count: { resources: number; questions: number };
  notes: { id: string } | null;
  analysis: { id: string } | null;
};

export type SubjectIssue = {
  kind: "duplicate" | "similar";
  confidence: number;
  reason: string;
  left: QualitySubject;
  right: QualitySubject;
  keep: QualitySubject;
  merge: QualitySubject;
};

export function normalizeSubjectName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\bintroduction\b/g, "intro")
    .replace(/\bmanagement\b/g, "mgmt")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokenSignature(value: string) {
  return normalizeSubjectName(value).split(" ").filter(Boolean).sort().join(" ");
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

function richness(subject: QualitySubject) {
  return subject._count.resources * 5 + subject._count.questions * 2 + Number(Boolean(subject.notes)) * 4 + Number(Boolean(subject.analysis)) * 3;
}

function makeIssue(left: QualitySubject, right: QualitySubject): SubjectIssue | null {
  const a = normalizeSubjectName(left.name);
  const b = normalizeSubjectName(right.name);
  if (!a || !b) return null;

  let kind: SubjectIssue["kind"];
  let confidence: number;
  let reason: string;

  if (a === b) {
    kind = "duplicate";
    confidence = 1;
    reason = "Same normalized subject name";
  } else if (tokenSignature(a) === tokenSignature(b)) {
    kind = "duplicate";
    confidence = 0.98;
    reason = "Same words in a different order";
  } else {
    const score = 1 - levenshtein(a, b) / Math.max(a.length, b.length);
    if (Math.min(a.length, b.length) < 6 || score < 0.9) return null;
    kind = "similar";
    confidence = score;
    reason = "Likely spelling or punctuation variation";
  }

  const leftScore = richness(left);
  const rightScore = richness(right);
  const keep = rightScore > leftScore ? right : left;
  return {
    kind,
    confidence,
    reason,
    left,
    right,
    keep,
    merge: keep.id === left.id ? right : left,
  };
}

export function normalizeLooseName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

export function similarity(a: string, b: string) {
  const x = normalizeLooseName(a);
  const y = normalizeLooseName(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  return 1 - levenshtein(x, y) / Math.max(x.length, y.length);
}

// DU course names are almost always written with "(H)" as shorthand for
// "(Hons.)" / "(Honours)" ("B.A. (H) Economics" vs the canonical "B.A.
// (Hons.) Economics"), and "Prog." for "Programme". Left unhandled, that
// alone drags an otherwise-exact name below the auto-match confidence
// threshold on nearly every honours course — expand these before comparing.
function canonicalizeCourseLabel(value: string) {
  return value
    .toLowerCase()
    .replace(/\(h\)/g, "(hons)")
    .replace(/\bhon\b/g, "hons")
    .replace(/\bprog\.?\b/g, "programme");
}

// Turns a Drive PDF filename into a subject name: strip the extension and
// trailing paper/roll code (a number, optionally in parens, that DU filenames
// almost always end with — "Corporate Accounting  3319.pdf" -> "Corporate
// Accounting"). Casing is left exactly as typed in the filename — the person
// who named the file already wrote it the way it should display ("GST" stays
// "GST", not "Gst").
export function deriveSubjectNameFromFilename(filename: string): string {
  let base = filename.replace(/\.pdf$/i, "").trim();
  let prev: string;
  do {
    prev = base;
    base = base.replace(/\.+$/, "").trim(); // stray extra dots before the extension, e.g. "...2942...pdf"
    base = base.replace(/\s*\(\d+[A-Za-z]?\)\s*$/, "");
    // Trailing paper/roll code — digits, optionally with a trailing letter
    // suffix like "1135A" (a common exam-paper-code convention).
    base = base.replace(/\s*[-_]?\s*\d+[A-Za-z]?\s*$/, "");
  } while (base !== prev && base.length > 0);
  return base.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

// Finds the best existing DriveSubject (within the same Program, across all
// sessions/years) that a freshly-derived subject name likely refers to, so
// re-syncing a folder next year reuses the same subject instead of creating
// a near-duplicate over a capitalization change, "(H)"/"(Hons)" wording, or
// small typo. Same idea as matchProgramName, applied to subject names —
// caller decides the confidence bar (subject names are typo-prone enough
// that a slightly lower bar than course-matching is appropriate).
export function matchDriveSubjectName<T extends { id: string; name: string }>(
  existing: T[],
  rawName: string,
): { subject: T | null; confidence: number } {
  const canonical = canonicalizeCourseLabel(rawName);
  const normalized = normalizeLooseName(canonical);
  if (!normalized) return { subject: null, confidence: 0 };

  const exact = existing.find((s) => normalizeLooseName(canonicalizeCourseLabel(s.name)) === normalized);
  if (exact) return { subject: exact, confidence: 1 };

  let best: T | null = null;
  let bestScore = 0;
  for (const s of existing) {
    const score = similarity(canonical, canonicalizeCourseLabel(s.name));
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return { subject: best, confidence: bestScore };
}

// Confidence-scored match of a raw course-name string against the existing
// (small, stable) Program list. Used by session/Drive-link imports so that
// minor spelling/casing variants across yearly re-imports still resolve to
// the same Program instead of needing a new one created every time — the
// caller decides what confidence threshold is safe to auto-accept.
export function matchProgramName<T extends { id: string; name: string }>(
  programs: T[],
  value: string,
): { program: T | null; confidence: number; variantLabel: string } {
  const canonicalValue = canonicalizeCourseLabel(value);
  const v = normalizeLooseName(canonicalValue);
  if (!v) return { program: null, confidence: 0, variantLabel: "" };

  const exact = programs.find((p) => normalizeLooseName(canonicalizeCourseLabel(p.name)) === v);
  if (exact) return { program: exact, confidence: 1, variantLabel: "" };

  // DU elective-pool shorthand: GSEC/SEC/VAC/VEC/AEC all live under the
  // "Common Pool" programme; a bare "GE" means the separate GE Pool. Matched
  // as whole tokens (word-boundary split), never as a substring — e.g.
  // "B.A. (Hons.) Economics" must never hit this just because "...ons.Ec..."
  // happens to contain the letters "sec". Each pool code gets its own
  // variantLabel because DU gives SEC/VAC/AEC separate Drive folders even
  // though they share one Program row — without this, importing all three
  // would silently overwrite each other under the same [session, program] key.
  const tokens = value.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const poolToken = tokens.find((t) => ["gsec", "sec", "vac", "vec", "aec", "aecc", "dse"].includes(t));
  if (poolToken) {
    const pool = programs.find((p) => normalizeLooseName(p.name).includes("commonpool"));
    if (pool) return { program: pool, confidence: 0.95, variantLabel: poolToken.toUpperCase() };
  }
  if (tokens.length <= 2 && (tokens.includes("ge") || v === "genericelective")) {
    const pool = programs.find((p) => normalizeLooseName(p.name).includes("gepool"));
    if (pool) return { program: pool, confidence: 0.95, variantLabel: "" };
  }

  const substring = programs.find((p) => {
    const pn = normalizeLooseName(canonicalizeCourseLabel(p.name));
    return pn.includes(v) || v.includes(pn);
  });
  if (substring) return { program: substring, confidence: 0.95, variantLabel: "" };

  let best: T | null = null;
  let bestScore = 0;
  for (const program of programs) {
    const score = similarity(canonicalValue, canonicalizeCourseLabel(program.name));
    if (score > bestScore) {
      bestScore = score;
      best = program;
    }
  }
  return { program: best, confidence: bestScore, variantLabel: "" };
}

export function findSubjectIssues(subjects: QualitySubject[]) {
  const byTerm = new Map<string, QualitySubject[]>();
  for (const subject of subjects) {
    const group = byTerm.get(subject.term.id) ?? [];
    group.push(subject);
    byTerm.set(subject.term.id, group);
  }

  const issues: SubjectIssue[] = [];
  for (const group of byTerm.values()) {
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const issue = makeIssue(group[i], group[j]);
        if (issue) issues.push(issue);
      }
    }
  }

  return issues.sort((a, b) => b.confidence - a.confidence || a.left.name.localeCompare(b.left.name));
}
