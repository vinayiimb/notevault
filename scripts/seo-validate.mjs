/**
 * scripts/seo-validate.mjs — one-shot SEO coverage report for the DU PYP
 * page hierarchy. Reads the same static JSON the pages/sitemap use (no DB).
 *
 *   node scripts/seo-validate.mjs           # prints the report
 *   node scripts/seo-validate.mjs --write   # also writes SEO_VALIDATION.md
 *
 * Uses the compiled du-pyp-seo module via a tiny `server-only` shim so it can
 * run outside Next.
 */
import Module from "node:module";
import fs from "node:fs";

const orig = Module._resolveFilename;
Module._resolveFilename = function (req, ...rest) {
  if (req === "server-only") {
    const shim = new URL("./_server-only-shim.cjs", import.meta.url).pathname;
    if (!fs.existsSync(shim)) fs.writeFileSync(shim, "module.exports = {};");
    return shim;
  }
  return orig.call(this, req, ...rest);
};

const seo = await import("../src/lib/du-pyp-seo.ts");

const stats = await seo.getSeoCoverageStats();
const programmes = await seo.getSeoProgrammes();
const indexableProgrammes = programmes.filter(seo.isProgrammeIndexable);

const [progUrls, semUrls, subjUrls, codeUrls, paperUrls] = await Promise.all([
  seo.getIndexableProgrammeUrls(),
  seo.getIndexableProgrammeSemesterUrls(),
  seo.getIndexableSubjectUrls(),
  seo.getIndexablePaperCodeUrls(),
  seo.getIndexablePaperUrls(),
]);

// duplicate check
function dupes(urls) {
  const seen = new Set();
  let n = 0;
  for (const u of urls) {
    if (seen.has(u.path)) n++;
    seen.add(u.path);
  }
  return n;
}

const sample = (arr, n = 6) => arr.slice(0, n).map((u) => u.path);
const sampleRandom = (arr, n = 6) => {
  const out = [];
  const step = Math.max(1, Math.floor(arr.length / n));
  for (let i = 0; i < arr.length && out.length < n; i += step) out.push(arr[i].path);
  return out;
};

const staticCount = 16;
const blogCount = (() => {
  try {
    return fs.readdirSync(new URL("../src/content/blog", import.meta.url)).filter((f) => f.endsWith(".md")).length;
  } catch {
    return 0;
  }
})();

const totalSitemap =
  staticCount + blogCount + progUrls.length + semUrls.length + subjUrls.length + codeUrls.length + paperUrls.length;

const lines = [];
const p = (s = "") => lines.push(s);

p("# SEO Validation — DU PYQ Online");
p();
p(`Generated ${new Date().toISOString()} from \`public/data/du-question-bank-full-mapped.json\` + Ramanujan catalog.`);
p();
p("## URL counts");
p();
p("| Category | Total nodes | Indexable (sitemap) | Skipped |");
p("| --- | --- | --- | --- |");
p(`| Static | ${staticCount} | ${staticCount} | — |`);
p(`| Blog | ${blogCount} | ${blogCount} | — |`);
p(`| Programmes | ${stats.programmes.total} | ${stats.programmes.indexable} | ${stats.programmes.total - stats.programmes.indexable} (non-programme buckets / < 3 subjects) |`);
p(`| Programme × semester | — | ${semUrls.length} | thin sems (< 3 subjects / < 3 papers) are noindex |`);
p(`| Subjects | ${stats.subjects.total} | ${stats.subjects.inSitemap} | ${stats.subjects.skippedEmptySlug} empty-slug + ${stats.subjects.skippedNoPapers} no-papers + ${stats.subjects.indexable - stats.subjects.inSitemap} under noindex programmes |`);
p(`| Paper codes | ${stats.paperCodes.total} | ${stats.paperCodes.indexable} | ${stats.paperCodes.total - stats.paperCodes.indexable} (no papers) |`);
p(`| Individual papers | ${stats.papers.total} | ${stats.papers.inSitemap} | ${stats.papers.total - stats.papers.inSitemap} (under noindex programme/subject) |`);
p(`| **Total sitemap URLs** | | **${totalSitemap.toLocaleString("en-IN")}** | |`);
p();
p("## Duplicates (should all be 0)");
p();
p(`- programme paths: ${dupes(progUrls)}`);
p(`- programme-semester paths: ${dupes(semUrls)}`);
p(`- subject paths: ${dupes(subjUrls)}`);
p(`- paper-code paths: ${dupes(codeUrls)}`);
p(`- paper paths: ${dupes(paperUrls)}`);
p();
p("## Sample URLs");
p();
p("### Programmes");
p(sampleRandom(progUrls).map((u) => `- \`${u}\``).join("\n"));
p();
p("### Programme × semester");
p(sampleRandom(semUrls).map((u) => `- \`${u}\``).join("\n"));
p();
p("### Subjects");
p(sampleRandom(subjUrls).map((u) => `- \`${u}\``).join("\n"));
p();
p("### Paper codes");
p(sampleRandom(codeUrls).map((u) => `- \`${u}\``).join("\n"));
p();
p("### Individual papers");
p(sampleRandom(paperUrls).map((u) => `- \`${u}\``).join("\n"));
p();
p("## 10 random subject pages — uniqueness spot check");
p();
const idxSubjects = [];
for (const prog of indexableProgrammes) {
  for (const s of prog.subjects) {
    if (seo.isSubjectIndexable(s)) idxSubjects.push({ prog, s });
  }
}
const step = Math.floor(idxSubjects.length / 10) || 1;
for (let i = 0, k = 0; i < idxSubjects.length && k < 10; i += step, k++) {
  const { prog, s } = idxSubjects[i];
  const meta = {
    path: `/papers/${prog.slug}/${s.slug}`,
    name: s.name,
    programme: prog.name,
    semesters: s.semesters,
    paperCodes: s.paperCodes,
    years: s.years,
    papers: s.papers.length,
  };
  p("```json");
  p(JSON.stringify(meta, null, 2));
  p("```");
}

const report = lines.join("\n") + "\n";
process.stdout.write(report);
if (process.argv.includes("--write")) {
  fs.writeFileSync(new URL("../SEO_VALIDATION.md", import.meta.url), report);
  process.stderr.write("\nwrote SEO_VALIDATION.md\n");
}
