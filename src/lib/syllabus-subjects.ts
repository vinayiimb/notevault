import { loadDataAsset } from "@/lib/pyq-catalog";
import { semestersOf } from "@/lib/syllabus-semesters";

// The DSC (core) papers of a course and semester, from the site's master syllabus. A whole-semester buyer gets these
// listed under their order automatically. Course names in the syllabus are the same strings as the canonical programme
// names an order carries.

type Row = { course: string; semester: string; type: string; subjectName: string; courseNumber?: string };

let cache: Row[] | null = null;

export async function dscSubjects(programme: string, semester: number): Promise<string[]> {
  if (!programme || !semester) return [];
  cache ??= (await loadDataAsset("master-syllabus-data.json")) as Row[];
  const want = programme.trim().toLowerCase();
  const rows = cache
    .filter((r) => r.type === "DSC/Core" && r.course.trim().toLowerCase() === want && semestersOf(r.semester).includes(semester))
    .sort((a, b) => (parseInt(a.courseNumber?.replace(/\D/g, "") ?? "") || 0) - (parseInt(b.courseNumber?.replace(/\D/g, "") ?? "") || 0));
  const seen = new Set<string>();
  return rows.map((r) => r.subjectName.trim()).filter((n) => n && !seen.has(n.toLowerCase()) && seen.add(n.toLowerCase()));
}
