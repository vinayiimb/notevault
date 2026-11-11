import master from "../../public/data/master-syllabus-data.json";
import courses from "../../public/data/du-courses-catalog.json";

// The pick-lists behind "Add your subjects": DSC / DSE / GE come from the DU
// syllabus table (course -> semester -> subject, with its UPC code), SEC / AEC /
// VAC from the university-wide course catalogue. Built once per server process
// and served (compact) by /api/subject-catalog; the browser filters it locally.

export type CatalogRow = [courseIdx: number, type: string, sems: number[], name: string, code: string];
export type PoolRow = [type: string, name: string, code: string];
export type SubjectCatalog = { courses: string[]; rows: CatalogRow[]; pool: PoolRow[] };

const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };

/** "I/III/V/VII" -> [1,3,5,7]; "III-VI" -> [3,4,5,6]; "Semester- VII" -> [7]; "Pool / not fixed" -> []. */
export function parseSemesters(raw: string): number[] {
  const text = raw.replace(/semester/gi, " ");
  const nums = (text.match(/\b(?:viii|vii|vi|iv|v|iii|ii|i)\b|\b[1-8]\b/gi) ?? []).map((t) => ROMAN[t.toLowerCase()] ?? Number(t));
  if (nums.length === 2 && /^[^/,]*\S\s*-\s*\S[^/,]*$/.test(text.trim()) && nums[0] < nums[1]) {
    return Array.from({ length: nums[1] - nums[0] + 1 }, (_, i) => nums[0] + i);
  }
  return [...new Set(nums)].sort((a, b) => a - b);
}

/** A real UPC / paper code, or "" for placeholders like "TBA". */
export const cleanCode = (raw: unknown) => {
  const c = String(raw ?? "").trim();
  return /^[A-Za-z0-9-]{6,}$/.test(c) ? c.toUpperCase() : "";
};

const TYPE_OF: Record<string, string> = { "DSC/Core": "DSC", DSE: "DSE", GE: "GE" };

let cached: SubjectCatalog | null = null;

export function getSubjectCatalog(): SubjectCatalog {
  if (cached) return cached;
  const courseList: string[] = [];
  const idx = new Map<string, number>();
  const merged = new Map<string, CatalogRow>();
  for (const r of master as { course: string; semester: string; type: string; subjectName: string; upc?: string }[]) {
    const type = TYPE_OF[r.type];
    if (!type || !r.subjectName) continue;
    let ci = idx.get(r.course);
    if (ci === undefined) {
      ci = courseList.push(r.course) - 1;
      idx.set(r.course, ci);
    }
    const name = r.subjectName.trim();
    const code = cleanCode(r.upc);
    const key = `${ci}|${type}|${name}|${code}`;
    const sems = parseSemesters(r.semester ?? "");
    const prev = merged.get(key);
    if (prev) prev[2] = [...new Set([...prev[2], ...sems])].sort((a, b) => a - b);
    else merged.set(key, [ci, type, sems, name, code]);
  }
  const pool: PoolRow[] = (courses as { title: string; courseType: string; upcs?: string[] }[])
    .map((c): PoolRow => [c.courseType, c.title.trim(), cleanCode(c.upcs?.[0])])
    .sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
  cached = { courses: courseList, rows: [...merged.values()], pool };
  return cached;
}
