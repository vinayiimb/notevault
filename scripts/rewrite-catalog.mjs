import fs from "fs";

let code = fs.readFileSync("src/lib/pyq-catalog.ts", "utf8");

// Remove json imports
code = code.replace(/import rawCatalog from "@\/data\/ramanujan-pyq-catalog\.json";\n/, "");
code = code.replace(/import rawOfficialArchiveMap from "@\/data\/archive-official-map\.json";\n/, "");

// Replace const sourceCatalog
code = code.replace(
  "const sourceCatalog = rawCatalog as CatalogPaper[];\n",
  `
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
`
);

// Remove const officialArchiveMap
code = code.replace(
  /const officialArchiveMap = new Map\(\s*\(rawOfficialArchiveMap as ArchiveOfficialMapRow\[\]\)\.map\(\(row\) => \[row\.id, row\]\),\s*\);\n/,
  ""
);

// Convert synchronous functions to async
code = code.replace(
  `export function getCatalogCourses() {`,
  `export async function getCatalogCourses() {`
);
code = code.replace(
  `export function getCatalogCourseBySlug(courseSlug: string) {`,
  `export async function getCatalogCourseBySlug(courseSlug: string) {`
);
code = code.replace(
  `export function isCatalogCourseSubject(course: string, subject: string) {`,
  `export async function isCatalogCourseSubject(course: string, subject: string) {`
);
code = code.replace(
  `export function getCatalogYearRanges() {`,
  `export async function getCatalogYearRanges() {`
);
code = code.replace(
  `export function getSemesterGroupsForYear(yearRange: string) {`,
  `export async function getSemesterGroupsForYear(yearRange: string) {`
);
code = code.replace(
  `function applyOfficialFileMap(paper: CatalogPaper): CatalogPaper {`,
  `async function applyOfficialFileMap(paper: CatalogPaper): Promise<CatalogPaper> {`
);
code = code.replace(
  `function validateSourceCatalog() {`,
  `async function validateSourceCatalog() {`
);

// Change `return getCatalogCourses().find` to `const courses = await getCatalogCourses(); return courses.find`
code = code.replace(
  /return getCatalogCourses\(\)\.find/g,
  `const courses = await getCatalogCourses(); return courses.find`
);

// Change `const course = getCatalogCourseBySlug(courseSlug);` to `const course = await getCatalogCourseBySlug(courseSlug);`
code = code.replace(
  /const course = getCatalogCourseBySlug/g,
  `const course = await getCatalogCourseBySlug`
);

// Change usages of sourceCatalog to `(await getSourceCatalog())`
code = code.replace(/sourceCatalog\.map/g, "(await getSourceCatalog()).map");
code = code.replace(/sourceCatalog\.some/g, "(await getSourceCatalog()).some");
code = code.replace(/sourceCatalog\.filter/g, "(await getSourceCatalog()).filter");
code = code.replace(/sourceCatalog\.length/g, "(await getSourceCatalog()).length");
code = code.replace(/sourceCatalog\.entries/g, "(await getSourceCatalog()).entries");

// Change usages of officialArchiveMap to `(await getOfficialArchiveMap())`
code = code.replace(/officialArchiveMap\.get/g, "(await getOfficialArchiveMap()).get");

// Ensure getUnifiedPyqArchive awaits applyOfficialFileMap
code = code.replace(
  /return papers\.map\(\(p\) => \{\n\s*const o = applyOverride\(applyOfficialFileMap\(p\), overrides\);/g,
  `const result = await Promise.all(papers.map(async (p) => {\n    const o = applyOverride(await applyOfficialFileMap(p), overrides);`
);
code = code.replace(
  /      college: o\.college,\n    \};\n  \}\);/g,
  `      college: o.college,\n    };\n  }));\n  return result;`
);

fs.writeFileSync("src/lib/pyq-catalog.ts", code);
