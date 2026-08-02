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
