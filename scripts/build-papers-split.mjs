// Splits public/data/papers-catalog.json (~13MB, 29k papers) into small
// files for the /papers browser, so a visitor only downloads the course they
// pick instead of the whole archive:
//   public/data/papers/index.json          — [{ course, slug, count }]
//   public/data/papers/courses/<slug>.json — that course's papers
//   public/data/papers/search-index.json   — [course, subject, count] rows,
//                                            fetched only for header search
// Generated at build time (prebuild); the output is gitignored.
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(root, "public/data/papers-catalog.json");
const OUT = path.join(root, "public/data/papers");

// Must match slugify() in src/lib/utils.ts.
function slugify(input) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-");
}

const papers = JSON.parse(readFileSync(SOURCE, "utf8"));
const byCourse = new Map();
for (const p of papers) {
  const list = byCourse.get(p.course) ?? [];
  list.push(p);
  byCourse.set(p.course, list);
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(path.join(OUT, "courses"), { recursive: true });

const index = [];
const search = [];
for (const [course, list] of byCourse) {
  const slug = slugify(course);
  writeFileSync(path.join(OUT, "courses", `${slug}.json`), JSON.stringify(list));
  index.push({ course, slug, count: list.length });

  const subjects = new Map();
  for (const p of list) {
    const key = p.subject.trim().toLowerCase();
    const entry = subjects.get(key) ?? { subject: p.subject, count: 0 };
    entry.count += 1;
    subjects.set(key, entry);
  }
  for (const { subject, count } of subjects.values()) search.push([course, subject, count]);
}

index.sort((a, b) => a.course.localeCompare(b.course));
writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index));
writeFileSync(path.join(OUT, "search-index.json"), JSON.stringify(search));
console.log(`papers split: ${papers.length} papers → ${index.length} course files, ${search.length} search rows`);
