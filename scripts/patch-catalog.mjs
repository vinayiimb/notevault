import fs from "fs";
let code = fs.readFileSync("src/lib/pyq-catalog.ts", "utf8");

// 1. Remove static imports
code = code.replace(/import rawCatalog from "@\/data\/ramanujan-pyq-catalog\.json";\n/, "");
code = code.replace(/import rawOfficialArchiveMap from "@\/data\/archive-official-map\.json";\n/, "");

// 2. Replace static definitions
const defSearch = `const sourceCatalog = rawCatalog as CatalogPaper[];

type ArchiveOfficialMapRow = {`;

const defReplace = `type ArchiveOfficialMapRow = {`;
code = code.replace(defSearch, defReplace);

const mapSearch = `const officialArchiveMap = new Map(
  (rawOfficialArchiveMap as ArchiveOfficialMapRow[]).map((row) => [row.id, row]),
);`;

const mapReplace = `// Async data loading to bypass Webpack bundling of massive JSON files
let cachedSourceCatalog: CatalogPaper[] | null = null;
let cachedOfficialArchiveMap: Map<string, ArchiveOfficialMapRow> | null = null;

async function loadDataAsset(filename: string) {
  const isCloudflare = typeof caches !== 'undefined' || (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers');
  if (isCloudflare) {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://dupyq.online';
    return await fetch(baseUrl + '/data/' + filename).then(r => r.json());
  } else {
    const fsMod = eval("require('fs')");
    const pathMod = eval("require('path')");
    return JSON.parse(fsMod.readFileSync(pathMod.join(process.cwd(), 'public/data', filename), 'utf8'));
  }
}

export async function getSourceCatalog(): Promise<CatalogPaper[]> {
  if (!cachedSourceCatalog) {
    cachedSourceCatalog = await loadDataAsset('ramanujan-pyq-catalog.json') as CatalogPaper[];
  }
  return cachedSourceCatalog;
}

export async function getOfficialArchiveMap(): Promise<Map<string, ArchiveOfficialMapRow>> {
  if (!cachedOfficialArchiveMap) {
    const raw = await loadDataAsset('archive-official-map.json') as ArchiveOfficialMapRow[];
    cachedOfficialArchiveMap = new Map(raw.map((row) => [row.id, row]));
  }
  return cachedOfficialArchiveMap;
}
`;
code = code.replace(mapSearch, mapReplace);

// 3. Make synchronous functions async
code = code.replace(/export function getCatalogCourses\(\) \{/g, 'export async function getCatalogCourses() {\n  const sourceCatalog = await getSourceCatalog();');
code = code.replace(/export function getCatalogCourseBySlug\(courseSlug: string\) \{/g, 'export async function getCatalogCourseBySlug(courseSlug: string) {\n  const courses = await getCatalogCourses();\n  return courses.find((course) => course.slug === courseSlug) ?? null;\n');
// Clean up old body of getCatalogCourseBySlug
code = code.replace(/export async function getCatalogCourseBySlug\(courseSlug: string\) \{\n  const courses = await getCatalogCourses\(\);\n  return courses\.find\(\(course\) => course\.slug === courseSlug\) \?\? null;\n\n  return getCatalogCourses\(\)\.find\(\(course\) => course\.slug === courseSlug\) \?\? null;\n\}/g, 'export async function getCatalogCourseBySlug(courseSlug: string) {\n  const courses = await getCatalogCourses();\n  return courses.find((course) => course.slug === courseSlug) ?? null;\n}');

code = code.replace(/export function isCatalogCourseSubject/g, 'export async function isCatalogCourseSubject');
code = code.replace(/return sourceCatalog\.some/g, 'const sourceCatalog = await getSourceCatalog();\n  return sourceCatalog.some');

code = code.replace(/export function getCatalogYearRanges\(\) \{/g, 'export async function getCatalogYearRanges() {\n  const sourceCatalog = await getSourceCatalog();');
code = code.replace(/export function getSemesterGroupsForYear\(yearRange: string\) \{/g, 'export async function getSemesterGroupsForYear(yearRange: string) {\n  const sourceCatalog = await getSourceCatalog();');

// 4. Any other reference to `sourceCatalog` in other async functions needs `await getSourceCatalog()`
code = code.replace(/sourceCatalog\.map/g, '(await getSourceCatalog()).map');
code = code.replace(/sourceCatalog\n/g, '(await getSourceCatalog())\n');
code = code.replace(/sourceCatalog\.filter/g, '(await getSourceCatalog()).filter');
code = code.replace(/sourceCatalog\.some/g, '(await getSourceCatalog()).some');
code = code.replace(/sourceCatalog\./g, '(await getSourceCatalog()).');

// 5. Replace officialArchiveMap
code = code.replace(/officialArchiveMap\.get/g, '(await getOfficialArchiveMap()).get');
code = code.replace(/officialArchiveMap\.entries/g, '(await getOfficialArchiveMap()).entries');
code = code.replace(/officialArchiveMap\.values/g, '(await getOfficialArchiveMap()).values');

// 6. Fix any nested await getSourceCatalog() created by string replaces
code = code.replace(/\(await getSourceCatalog\(\)\)\.map/g, 'sourceCatalog.map');
code = code.replace(/\(await getSourceCatalog\(\)\)\.filter/g, 'sourceCatalog.filter');
code = code.replace(/\(await getSourceCatalog\(\)\)\.some/g, 'sourceCatalog.some');

fs.writeFileSync("src/lib/pyq-catalog.ts", code);
console.log("Patched pyq-catalog.ts");
