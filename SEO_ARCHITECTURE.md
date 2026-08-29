# DU PYQ Online — Scalable SEO Page Architecture

Branch: `seo/scalable-page-architecture` (off `origin/main` @ `7bc1485`; commits `3183171`, `b50463c`)
Status: **implemented, `next build` green, local HTTP smoke tests pass.** Not deployed (per your local-first rule) — ready for `vercel deploy` from this branch.

---

## 1. Existing architecture discovered

### Routing (`src/app`, App Router, Next.js 16.2)

| Area | Routes |
| --- | --- |
| Papers (JSON-backed) | `/papers` (client-only browser), `/pyp`, `/previous-year-papers` (DB-backed) |
| Subjects/programmes (DB-backed) | `/programs/[slug]`, `/subjects/[id]`, `/subject/[slug]/pyq`, `/terms/[id]`, `/semesters` |
| PYQ reading pages (DB-backed) | `/pyq-notes`, `/pyq-notes/[id]` |
| Exam sessions (DB + Drive) | `/exam-sessions`, `/exam-sessions/[id]/[linkId]/[subjectId]` |
| Notes | `/notes/[programmeSlug]/[subjectSlug]` |
| Tools | `/tools/du-paper-code-finder`, `/tools/exam-kit`, … |
| Blog | `/blog`, `/blog/[slug]` (21 posts, file-based) |

### Two parallel content systems

1. **Prisma / Postgres** — `Program`, `Term`, `Subject`, `Resource`, `ExamSession`, `SessionProgramLink`, `DriveFileMatch`. Powers `/programs`, `/subjects`, `/pyq-notes`, `/exam-sessions`.
   **Production DB is effectively empty** — `/programs/[slug]` and `/subjects/[id]` return **404 on the live site**, and the previous DB used (Supabase `cgyrtygedqatghvurtsl`) has been deleted; the local `.env` Neon databases (`ep-wispy-field`, `ep-late-fog`) are also empty. The real prod `DATABASE_URL` is a Vercel Production secret not pullable locally.

2. **Static JSON** — `public/data/du-question-bank-full-mapped.json` (18 MB, ~23k rows scraped from `qb.exam.du.ac.in` + syllabus-matched) plus `public/data/ramanujan-pyq-catalog.json`. Loaded via `fs.readFileSync` (guarded for Cloudflare Workers), module-cached in `src/lib/du-pyp-data.ts`. This is the **real, reliable content**: 237 programme strings, ~9.6k subject-nodes, ~21k question-paper PDF links, ~5.6k UPCs. Works at build time with no DB.

### Sitemap — the core problem

`src/app/sitemap.ts` **queried the database** for programmes/terms/subjects/resources/sessions, wrapped in a `try/catch` that silently falls back to "static routes only" on any DB error. Because the DB is unreachable at build time, the deployed `sitemap.xml` contains **only 37 URLs** (16 static + 21 blog). None of the 23k papers, and none of the JSON-backed `/papers` content, was ever in the sitemap.

### Other findings

- **`/papers` is a fully client-side React app.** It `fetch()`es `/data/papers-catalog.json` in the browser, renders with `useState`, and encodes selections as `?query` params via `router.replace`. **Zero crawlable server links** to any programme, subject, or paper. Googlebot sees one filter widget → nothing to crawl → 37 URLs.
- `robots.txt` was a static `public/robots.txt` (`Disallow: /admin/`, `/dashboard/` only).
- Canonical host is consistent: `https://www.dupyq.online`; `dupyq.online` → `www` via 308. Per-page `<link rel="canonical">` is correct where set.
- Bugs: title template `%s | DU PYQ Online` is double-applied on pages that already include the suffix (`… | DU PYQ Online | DU PYQ Online` live). `og:url` is stuck at the site root on every page.
- `slugify()` in `src/lib/utils.ts` already produces the exact slugs you want: `B.Com. (Hons.)` → `bcom-hons`, `B.Sc. (Hons.) Zoology` → `bsc-hons-zoology`, `Business Laws` → `business-laws`.
- `next.config.ts` **excludes `public/**` from function traces** and re-includes specific JSONs via `outputFileTracingIncludes` — `du-question-bank-full-mapped.json` is already listed, so the new routes can read it in production.
- ISR is used everywhere (`export const revalidate`), never `force-dynamic`, to stay under Vercel's function limit.

---

## 2. Problems found

1. Sitemap depends on an unreachable DB and silently degrades to 37 URLs.
2. No server-rendered internal links to programme / subject / paper pages — the entire catalog is invisible to crawlers.
3. Individual papers have **no stable URLs at all** — they only exist as rows behind a client filter and as external PDF links.
4. Paper codes (UPC) have no pages.
5. DB-backed `/programs` and `/subjects` are dead in production (404).
6. `lastModified` in the old sitemap was `new Date()` for every dynamic URL — tells Google everything changed at deploy time.
7. Title-template double suffix; root-pinned `og:url`.

---

## 3. Target architecture implemented (all on the static JSON)

```
Home
└─ /previous-year-papers            ← NEW crawlable index: every indexable programme
   └─ /papers/[programmeSlug]        ← Level 1  e.g. /papers/bcom-hons
      └─ /papers/[programmeSlug]/[subjectSlug]   ← Level 2  e.g. /papers/bcom-hons/business-laws
         └─ /paper/[slug]            ← Level 4  e.g. /paper/business-laws-bcom-hons-nov-dec-2025-2412081102-1778057936
/paper-code/[code]                   ← Level 3  e.g. /paper-code/2412081102
```

- **Programme page** — DU context, semesters, paper types, paper count, all subjects grouped by semester (crawlable `<Link>`s), related programmes (by shared subjects), breadcrumbs, `BreadcrumbList` + `CollectionPage` JSON-LD, self-canonical.
- **Subject page** — subject, programme, semester(s), paper code(s) (linked to `/paper-code/…`), credits, exam-year span, syllabus PDF link, question papers grouped by year (each linking to `/paper/[slug]` + direct View/Download), related subjects in the same programme, breadcrumbs, JSON-LD.
- **Paper-code page** — UPC, subject title(s), every `(programme, subject)` placement (consolidated — one page per code, never one per record), semesters, credits, papers by year, syllabus link.
- **Individual paper page** — subject, programme, semester, paper type, paper code, exam session, year, set, max marks, source, university; **View PDF** + **Download PDF** (both point at the same external file — no separate indexable URLs for view/download/preview); "other years for the same subject"; breadcrumbs; self-canonical.

### Indexability rules (thin-content protection)

| Level | Indexable (self-canonical + in sitemap) when… | Otherwise |
| --- | --- | --- |
| Programme | slug non-empty, not a scraper bucket (`another-question-papers`, `b-com-prog-b-a-prog`, …), **≥ 3 indexable subjects** | still renders, `noindex,follow`, not in sitemap |
| Subject | slug non-empty (rules out names that are entirely non-Latin script), **≥ 1 real question paper** | renders as a catalog stub, `noindex,follow`, not in sitemap |
| Paper code | numeric, ≥ 1 paper | 404 |
| Paper | resolves to a real PDF link | 404 |

Invalid combinations (`/papers/fake/fake`, wrong programme for a subject, bad code, bad slug) call `notFound()` → **real HTTP 404**, no soft-404.

### Slugs

Deterministic, from `slugify()`. Collisions are **consolidated, not duplicated**:
- 10 programme-slug collisions (trailing `/`, case) → one page, cleanest name chosen as display name, papers merged.
- ~94 subject-slug collisions (case/punctuation variants, empty-from-Devanagari) → merged onto one subject page; empty-slug subjects are `noindex` + sitemap-excluded.
- Paper slug is anchored on the stable id in the PDF URL (`qb.exam.du.ac.in/.../1778057936.pdf` → `1778057936`; Google-Drive `…/file/d/<id>/…`; Ramanujan filenames → short hash) so it never changes for a given paper.

---

## 4. Files changed

| File | Change |
| --- | --- |
| `src/lib/du-pyp-seo.ts` | **new** — SEO data layer: slug registry, consolidation, indexability rules, lookups, related-entity queries, sitemap feeds, coverage stats. All on top of `du-pyp-data`. |
| `src/lib/du-pyp-data.ts` | +1 export `getAllDuPypPapers()` (non-breaking). |
| `src/lib/seo.ts` | +`programmePapersMetadata`, `subjectPapersMetadata`, `paperCodeMetadata`, `individualPaperMetadata`, `collectionPageJsonLd`. |
| `src/app/sitemap.ts` | **rewritten** — `generateSitemaps()` sharded index, JSON-backed, no DB. Real `lastModified` from the data file's mtime. |
| `src/app/robots.ts` | **new** — replaces `public/robots.txt`; keeps `/papers`, `/paper`, `/paper-code` crawlable; blocks `/admin`, `/dashboard`, `/api`, `/login`, `/search`. |
| `public/robots.txt` | **deleted** (a static file would shadow `robots.ts`). |
| `src/app/(site)/papers/[programmeSlug]/page.tsx` | **new** — Level 1. |
| `src/app/(site)/papers/[programmeSlug]/[subjectSlug]/page.tsx` | **new** — Level 2. |
| `src/app/(site)/paper-code/[code]/page.tsx` | **new** — Level 3. |
| `src/app/(site)/paper/[slug]/page.tsx` | **new** — Level 4. |
| `src/components/seo/paper-card.tsx` | **new** — shared paper row. |
| `src/app/(site)/previous-year-papers/page.tsx` | crawlable "All DU Programmes" index section (JSON); existing DB sections guarded so the page no longer goes thin when the DB is down. |

No schema changes. No routes removed. `/papers`, `/pyp`, `/programs`, `/subjects` all still work.

---

## 5. Sitemap architecture

`/sitemap.xml` is a hand-rolled **sitemap index** (`app/sitemap.xml/route.ts`) pointing at `/sitemaps/<shard>.xml` (`app/sitemaps/[shard]/route.ts`). Hand-rolled rather than Next's `generateSitemaps` because this Next version does not serve an index document at `/sitemap.xml` when `generateSitemaps` is used — only the shards — and `robots.txt` must point at a working `/sitemap.xml`.

| Shard | Contents | Priority | changefreq |
| --- | --- | --- | --- |
| `/sitemaps/static.xml` | homepage, main nav, indexable tools, blog index (16) | 0.4–1.0 | daily–monthly |
| `/sitemaps/blog.xml` | 21 posts | 0.5 | monthly |
| `/sitemaps/programmes.xml` | indexable programme pages | 0.8 | weekly |
| `/sitemaps/subjects-{0..N}.xml` | indexable subject pages, 20k/shard | 0.7 | monthly |
| `/sitemaps/paper-codes-{0..N}.xml` | indexable UPC pages, 20k/shard | 0.6 | monthly |
| `/sitemaps/papers-{0..N}.xml` | individual paper pages, 20k/shard | 0.5 | yearly |

- No DB call — the sitemap can never silently collapse again.
- `lastModified` = the data file's real mtime for JSON URLs, real post date for blog, omitted for static.
- Excluded: redirects, 404s, `/admin`, `/dashboard`, `/api`, `/login`, `/search`, `?filter` states, `noindex` (thin) pages, canonicalised-away duplicates.

---

## 6. URL counts now eligible for sitemap

From `scripts/seo-validate.mjs` (run `node scripts/seo-validate.mjs --write` to regenerate `SEO_VALIDATION.md`):

| Category | Nodes in data | In sitemap (indexable) | Skipped |
| --- | --- | --- | --- |
| Static routes | 16 | 16 | — |
| Blog posts | 21 | 21 | — |
| Programme pages | 237 | **176** | 61 (scraper buckets / pool labels / < 3 subjects) |
| Subject pages | 9,597 | **6,551** | 2 empty-slug + 1,619 no-papers + 1,425 under a noindex programme |
| Paper-code pages | 5,471 | **4,380** | 1,091 (code has no papers) |
| Individual paper pages | 23,452 | **20,689** | 2,763 (under a noindex programme/subject) |
| **Total** | | **≈ 31,833** | |

- **0** duplicate paths at every level.
- Skipped-as-thin: 1,619 subjects (real syllabus entries, no papers yet) + 1,425 subjects under pool labels → all render but `noindex,follow`, not in sitemap.
- Skipped-as-duplicate: the slug-collision consolidation merges 10 programme-name variants and ~90 subject-name variants onto single pages (counted once).

Sample generated URLs:
- Programme — `/papers/bcom-hons`, `/papers/ba-hons-economics`, `/papers/bsc-hons-zoology`, `/papers/history`
- Subject — `/papers/bcom-hons/business-laws`, `/papers/ba-prog-philosophy/logic`, `/papers/bsc-hons-chemistry/reactions-reagents-and-chemical-process`
- Paper code — `/paper-code/2412081102`, `/paper-code/2302201101`
- Individual paper — `/paper/business-laws-bcom-hons-2025-2412081102-<id>`, `/paper/an-invitation-to-sociology-b-a-program-sociology-nov-dec-2025-2025-2302201101-1778057936`

---

## 7. SEO safeguards implemented

- Real 404s via `notFound()` for every invalid combination; no soft-404.
- `noindex,follow` (not 404, not indexed) for thin-but-real subjects and non-programme buckets.
- Self-canonical on every indexable page; `noindex` pages still declare canonical + `follow`.
- Per-page `openGraph.url` (fixes the root-pinned `og:url`).
- Natural titles — no keyword stuffing, no "Free Download PYQ Previous Papers Delhi University" strings. Root layout appends ` | DU PYQ Online`; new pages pass bare titles so there's no double suffix.
- Descriptions built only from real data attributes (counts, years, codes, credits). No fabricated paragraphs, ratings, authors, or dates.
- `BreadcrumbList` + `CollectionPage` JSON-LD that mirrors visible content.
- Crawlable `<Link>` / `<a href>` throughout; no JS-only navigation for core paths.
- External PDF links carry `rel="nofollow noopener"`; no separate view/download/preview URLs.
- ISR (`revalidate = 86400`) — pages stay static (no function-count blowup), refresh daily.
- `generateStaticParams` pre-builds only the largest slice of each level (40 programmes, subjects of the top 10 programmes ≈ 850 pages, first 200 codes, first 300 papers); the long tail is ISR-on-demand and cached on first hit — bounded build time and memory.

---

## 8. Database / index changes

None. The architecture is entirely on the versioned JSON catalog. If the Prisma catalog is repopulated later, `/programs` and `/subjects` come back on their own; this layer is independent and can be cross-linked then.

---

## 9. Tests performed

**Build (`next build`, run 3×):**
- ✓ Compiled successfully.
- ✓ TypeScript — no errors (whole project).
- ✓ Static generation — 1,484 pages, **0 prerender errors**. Includes 40 `/papers/[programmeSlug]`, ~850 `/papers/[programmeSlug]/[subjectSlug]`, 200 `/paper-code/[code]`, 300 `/paper/[slug]`, and all sitemap shards (`/sitemaps/static.xml`, `/sitemaps/blog.xml`, `/sitemaps/programmes.xml`, `/sitemaps/subjects-0.xml`, …) + `/sitemap.xml` index + `/robots.txt`.
- DB-unreachable errors during the build are **expected and handled** — existing pages have fallbacks; the new pages and sitemap make no DB call.

**Data validation (`scripts/seo-validate.mjs`):**
- 176 programme / 6,551 subject / 4,380 paper-code / 20,689 paper URLs eligible.
- **0** duplicate paths at every level.
- Slug determinism confirmed — same input → same slug; paper slugs anchored on the stable PDF id.
- 10 random subject pages spot-checked (`SEO_VALIDATION.md`) — each carries distinct name / programme / semester / paper-code / year-span / paper count. Not "identical but for the title".

**Local HTTP smoke test (`next start`, all passed):**

| URL | Expected | Got |
| --- | --- | --- |
| `/papers/bcom-hons` | 200, self-canonical, natural title | ✓ `B.Com. (Hons.) Previous Year Question Papers \| DU PYQ Online` |
| `/papers/bcom-hons/business-laws` | 200 + BreadcrumbList + CollectionPage JSON-LD, `robots: index,follow` | ✓ canonical + `og:url` correct, no `null`/`undefined` in HTML |
| `/paper-code/2412081102` | 200 | ✓ |
| `/paper/an-invitation-to-sociology-…-2302201101-1778057936` | 200, links to real qb.exam.du.ac.in PDF | ✓ |
| `/papers/fake-program` | 404 | ✓ |
| `/papers/bcom-hons/not-a-subject` | 404 | ✓ |
| `/papers/ba-hons-economics/business-laws` (subject under wrong programme) | 404 | ✓ |
| `/paper-code/9999999999` | 404 | ✓ |
| `/paper/not-a-real-paper` | 404 | ✓ |
| `/papers/aec` (non-programme bucket) | 200 + `robots: noindex,follow`, **not in sitemap** | ✓ |
| `/papers/aec/aec-environmental-science-theory-into-practice` (subject under noindex programme) | 200 + `noindex,follow` + self-canonical | ✓ |
| `/robots.txt` | 200, `Sitemap: …/sitemap.xml`, `/paper*` crawlable | ✓ |
| `/sitemap.xml` | 200, `<sitemapindex>` with 7 shards | ✓ |
| `/sitemaps/programmes.xml` | 200, 176 `<loc>` | ✓ |
| `/sitemaps/subjects-0.xml` | 200, 6,551 `<loc>` | ✓ |
| `/sitemaps/paper-codes-0.xml` | 200, 4,380 `<loc>` | ✓ |
| `/sitemaps/papers-0.xml` / `papers-1.xml` | 200, 20,000 / 689 `<loc>` | ✓ |
| `/sitemaps/bogus-99.xml` | 404 | ✓ |

---

## 10. Remaining risks

- **Build memory** — the 18 MB JSON is parsed once and shared, but `generateStaticParams` across four levels adds pages. Caps above keep it bounded; if the Vercel build OOMs, lower the `.slice()` limits.
- **Prod `DATABASE_URL`** — unrelated existing pages (`/pyq-notes`, `/exam-sessions`) still depend on it. Out of scope here, but worth confirming the Vercel secret points at a live DB.
- **`/papers` client browser** is untouched — it still emits `?query` URLs. Those aren't linked or in the sitemap, but consider adding `<meta name="robots" content="noindex">` when `?` params are present, or a canonical to `/papers`. (Not done yet — flagged as next step.)
- **Data quality** — 227 → 222 "programmes" after filtering still includes broad pools ("Generic Elective", "University-wide AEC Pool"). They have real papers and ≥3 subjects so they're kept; revisit if they read as thin.
- Non-Latin-script subject names (Hindi/Sanskrit papers) are `noindex` for now — a transliteration pass could recover them.

---

## 11. Exact next steps in Google Search Console

1. **Deploy** the branch to production (Vercel). Verify `https://www.dupyq.online/sitemap.xml` returns the index and `/sitemaps/programmes.xml` etc. resolve with 200.
2. GSC → **Sitemaps** → remove the old `sitemap.xml` entry if present, re-add `https://www.dupyq.online/sitemap.xml`. Google follows the index to all shards automatically.
3. GSC → **URL Inspection** on 3–4 representative new URLs (one per level). Confirm "URL is on Google" eligibility, correct canonical, no "Discovered – not indexed". Use **Request Indexing** for a handful of high-value programme pages (`/papers/bcom-hons`, `/papers/ba-hons-economics`, …).
4. GSC → **Pages** report — watch "Crawled – currently not indexed" and "Discovered – currently not indexed" over 2–4 weeks. Some tail pages will sit there; that's expected. If *programme* or *subject* pages pile up there, they may read as thin — tighten the indexability threshold.
5. GSC → **Removals** — no action; nothing to remove.
6. After ~2 weeks, check **Crawl stats** (Settings) for crawl-rate increase and any spike in 404s/5xx. A rise in 404s from `/paper/…` means a slug changed — check `stablePaperId` didn't regress.
7. Keep the old `/programs/*` and `/subjects/*` URLs live (they 404 today anyway); if they're repopulated, add `rel=canonical` from them to the `/papers/*` equivalents or 301 them.
8. Monitor **Performance** → filter to `/papers/`, `/paper/`, `/paper-code/` — impressions should climb first, then clicks.
