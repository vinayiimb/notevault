// Client-safe: Admin → Papers archive edits (rename/combine/move/hide a
// subject; edit, add, re-link or hide a single paper), layered on the static
// /data/papers files. Shared by /papers and the PYQ Analyser admin picker so
// both list exactly the same subjects.
import type { CatalogPaper } from "@/lib/pyq-catalog-types";
import { canonicalSubjectKey } from "@/lib/subject-normalization";
import type { PaperEdit } from "@/lib/paper-edits";

export type SubjectOverride = {
  course: string;
  subjectKey: string;
  displayName: string | null;
  semesterOverride: number | null;
  hidden: boolean;
  courseOverride: string | null;
};
export type Overrides = { subjects: Map<string, SubjectOverride>; papers: PaperEdit[]; list: SubjectOverride[] };

export async function fetchJson<T>(url: string, fallback: T): Promise<T> {
  try {
    const res = await fetch(url);
    if (!res.ok) return fallback;
    return (await res.json()) as T;
  } catch {
    return fallback;
  }
}

export async function loadOverrides(): Promise<Overrides> {
  const [subjects, papers] = await Promise.all([
    fetchJson<SubjectOverride[]>("/api/catalog-overrides", []),
    fetchJson<PaperEdit[]>("/api/catalog-paper-overrides", []),
  ]);
  const list = Array.isArray(subjects) ? subjects : [];
  return {
    list,
    subjects: new Map(list.map((o) => [`${o.course}\u0000${o.subjectKey}`, o])),
    papers: Array.isArray(papers) ? papers : [],
  };
}

export function applyOverrides(raw: CatalogPaper[], overrides: Overrides): CatalogPaper[] {
  const out: CatalogPaper[] = [];
  for (const p of raw) {
    const override = overrides.subjects.get(`${p.course}\u0000${canonicalSubjectKey(p.subject)}`);
    if (override?.hidden) continue;
    let paper = p;
    if (override) {
      paper = {
        ...paper,
        originalSubject: p.subject,
        subject: override.displayName || p.subject,
        course: override.courseOverride || p.course,
        semester: override.semesterOverride != null ? String(override.semesterOverride) : p.semester,
      };
    }
    out.push(paper);
  }
  return out;
}
