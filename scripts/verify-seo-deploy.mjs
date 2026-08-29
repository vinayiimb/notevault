/**
 * scripts/verify-seo-deploy.mjs — post-deploy smoke test for the SEO page
 * architecture. Run AFTER the branch is live in production:
 *
 *   node scripts/verify-seo-deploy.mjs
 *   node scripts/verify-seo-deploy.mjs https://notevault-<preview>.vercel.app
 *
 * Every line must print OK. Any FAIL → stop and report it.
 */

const BASE = (process.argv[2] || "https://www.dupyq.online").replace(/\/$/, "");

let pass = 0;
let fail = 0;

async function head(path) {
  const res = await fetch(BASE + path, { redirect: "manual" });
  return res.status;
}
async function body(path) {
  const res = await fetch(BASE + path);
  return { status: res.status, text: await res.text() };
}
function check(name, ok, detail = "") {
  if (ok) {
    pass++;
    console.log(`OK    ${name}${detail ? "  — " + detail : ""}`);
  } else {
    fail++;
    console.log(`FAIL  ${name}${detail ? "  — " + detail : ""}`);
  }
}

console.log(`\nVerifying ${BASE}\n${"-".repeat(60)}`);

// --- valid pages: expect 200 ---
for (const p of [
  "/papers/bcom-hons",
  "/papers/bcom-hons/business-laws",
  "/paper-code/2412081102",
  "/previous-year-papers",
  "/papers",
]) {
  const s = await head(p);
  check(`200  ${p}`, s === 200, `got ${s}`);
}

// --- invalid: expect 404 ---
for (const p of [
  "/papers/this-programme-does-not-exist",
  "/papers/bcom-hons/this-subject-does-not-exist",
  "/papers/ba-hons-economics/business-laws", // subject under wrong programme
  "/paper-code/9999999999",
  "/paper/not-a-real-paper-slug",
]) {
  const s = await head(p);
  check(`404  ${p}`, s === 404, `got ${s}`);
}

// --- canonical + title on a subject page ---
{
  const { status, text } = await body("/papers/bcom-hons/business-laws");
  check("subject page 200", status === 200, `got ${status}`);
  // Canonical is always the production domain (from metadataBase), even when
  // this script runs against a preview/localhost URL.
  check(
    "subject self-canonical",
    text.includes(`rel="canonical" href="https://www.dupyq.online/papers/bcom-hons/business-laws"`),
    "canonical -> https://www.dupyq.online/papers/bcom-hons/business-laws",
  );
  check("subject has BreadcrumbList JSON-LD", text.includes('"@type":"BreadcrumbList"'));
  check("subject has CollectionPage JSON-LD", text.includes('"@type":"CollectionPage"'));
  check(
    "subject not leaking null/undefined",
    !/>(null|undefined|NaN)</i.test(text),
    "no >null< / >undefined< in HTML",
  );
}

// --- robots.txt ---
{
  const { status, text } = await body("/robots.txt");
  check("robots.txt 200", status === 200, `got ${status}`);
  check("robots.txt points at /sitemap.xml", text.includes(`${BASE}/sitemap.xml`) || text.includes("https://www.dupyq.online/sitemap.xml"));
  check("robots.txt does NOT block /papers", !/Disallow:\s*\/papers/.test(text));
  check("robots.txt does NOT block /paper", !/Disallow:\s*\/paper(\s|$)/m.test(text));
}

// --- sitemap index ---
let shardNames = [];
{
  const { status, text } = await body("/sitemap.xml");
  check("/sitemap.xml 200", status === 200, `got ${status}`);
  check("/sitemap.xml is a <sitemapindex>", text.includes("<sitemapindex"));
  shardNames = [...text.matchAll(/\/sitemaps\/([^<]+)\.xml/g)].map((m) => m[1]);
  check("/sitemap.xml lists shards", shardNames.length >= 5, `${shardNames.length} shards: ${shardNames.join(", ")}`);
}

// --- every shard resolves + has <loc> ---
let totalLocs = 0;
for (const name of shardNames) {
  const { status, text } = await body(`/sitemaps/${name}.xml`);
  const locs = (text.match(/<loc>/g) || []).length;
  totalLocs += locs;
  check(`shard /sitemaps/${name}.xml`, status === 200 && locs > 0, `${status}, ${locs} urls`);
}
check("total sitemap URLs > 25,000", totalLocs > 25000, `${totalLocs.toLocaleString()} urls`);

// --- unknown shard 404 ---
check("unknown shard 404", (await head("/sitemaps/does-not-exist-99.xml")) === 404);

console.log(`${"-".repeat(60)}\n${pass} OK, ${fail} FAIL\n`);
process.exit(fail === 0 ? 0 : 1);
