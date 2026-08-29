# What to do now — Deploy + Google Search Console

Everything is built and tested on the branch **`seo/scalable-page-architecture`** in
`/Users/sayam/Projects/notevault`. Nothing is deployed yet.

The work is in 4 stages. Do them in order.

---

## STAGE 1 — Deploy the branch to production (you, ~10 min)

You do this because deploys cost Vercel credits and I'm set to local-first.

```bash
cd /Users/sayam/Projects/notevault
git checkout seo/scalable-page-architecture   # you're already on it

# Option A — merge to main, let Vercel auto-deploy (recommended)
git checkout main
git pull
git merge --no-ff seo/scalable-page-architecture -m "merge: scalable SEO page architecture"
git push origin main
# Vercel deploys main automatically. Watch: https://vercel.com/vinaykumarmoond-4860s-projects/notevault

# Option B — deploy the branch straight to production without merging
vercel --prod
```

Wait for the deploy to finish (Vercel dashboard shows "Ready").

---

## STAGE 2 — Verify the deploy (you, 2 min)

Run this from your Mac terminal once the deploy is live:

```bash
cd /Users/sayam/Projects/notevault
node scripts/verify-seo-deploy.mjs
```

It checks ~20 URLs (programme/subject/paper-code/paper pages, the sitemap index,
every shard, robots.txt, and that fake URLs 404). **Every line must say `OK`.**
If anything says `FAIL`, stop and tell me the output before doing Stage 3.

Manual spot check (optional):
- Open <https://www.dupyq.online/sitemap.xml> — should be an XML `<sitemapindex>` listing 7 `<sitemap>` entries.
- Open <https://www.dupyq.online/sitemaps/programmes.xml> — XML list of ~176 programme URLs.
- Open <https://www.dupyq.online/papers/bcom-hons> — a real B.Com (Hons) papers page with subjects by semester.
- Open <https://www.dupyq.online/robots.txt> — must end with `Sitemap: https://www.dupyq.online/sitemap.xml`.

---

## STAGE 3 — Google Search Console (you, ~15 min, one time)

Go to <https://search.google.com/search-console> and pick the
`dupyq.online` (or `https://www.dupyq.online`) property.

### 3a. Submit the sitemap

1. Left menu → **Sitemaps**.
2. If an old `sitemap.xml` row is listed and its "Discovered URLs" is tiny (~37) or
   it shows an error — click it → **⋮ / Remove sitemap**.
3. In "Add a new sitemap", type: `sitemap.xml`  → **Submit**.
   (The full URL becomes `https://www.dupyq.online/sitemap.xml`.)
4. Refresh after a minute. Status should be **Success**. "Discovered URLs" will start
   low and climb over days as Google reads the 7 shards — that's normal.
   You do NOT need to submit the shard URLs individually; the index handles it.

### 3b. Inspect one URL per level

Paste each into the **search bar at the very top** ("Inspect any URL"):

| Paste this | Expect |
| --- | --- |
| `https://www.dupyq.online/papers/bcom-hons` | "URL is not on Google" (it's new) → that's fine |
| `https://www.dupyq.online/papers/bcom-hons/business-laws` | same |
| `https://www.dupyq.online/paper-code/2412081102` | same |
| `https://www.dupyq.online/sitemaps/programmes.xml` | 200 / crawlable |

For each of the first three, after the inspection loads:
- Click **"Test live URL"** (top right).
- It should say **"URL is available to Google"**, with **Indexing allowed? Yes** and the
  **User-declared canonical** matching the URL you typed.
- Click **"Request indexing"**. (Google allows ~10/day — don't try to do hundreds.)

### 3c. Request indexing for your top pages

Do "Request indexing" (same as above) for ~8–10 of your most important programmes, e.g.:

```
https://www.dupyq.online/papers/bcom-hons
https://www.dupyq.online/papers/bcom-p
https://www.dupyq.online/papers/ba-hons-economics
https://www.dupyq.online/papers/ba-hons-political-science
https://www.dupyq.online/papers/ba-hons-english
https://www.dupyq.online/papers/bsc-hons-zoology
https://www.dupyq.online/papers/bsc-hons-chemistry
https://www.dupyq.online/papers/bsc-hons-computer-science
https://www.dupyq.online/papers/history
https://www.dupyq.online/papers/ba-prog-economics-as-major
```

(Full slug list: open `SEO_VALIDATION.md`, or
`https://www.dupyq.online/sitemaps/programmes.xml`.)

That's the entire GSC job. The rest is just watching.

---

## STAGE 4 — Watch over 2–4 weeks (you, 5 min/week)

### Week 1
- **Sitemaps** → your sitemap "Discovered URLs" should be in the thousands and rising.
- **Pages** (left menu, under Indexing) → "Not indexed" reasons. Expect a large
  "Discovered – currently not indexed" and "Crawled – currently not indexed" bucket
  at first — Google indexes a big new site gradually. This is normal.

### Weeks 2–4
- **Pages** → "Indexed" count should be climbing (hundreds → thousands).
- **Performance** → set a filter: **+ New → Page → "Contains" → `/papers/`**.
  Impressions rise first (days–weeks), clicks follow.
  Repeat the filter for `/paper/` and `/paper-code/`.
- **Settings → Crawl stats** → total crawl requests should jump. Check the
  "By response" chart — a small rise in 404s is fine; a **big** spike in 404s on
  `/paper/...` URLs means a paper slug changed → tell me, I'll check `stablePaperId`
  in `src/lib/du-pyp-seo.ts`.

### If programme or subject pages pile up in "Crawled – not indexed" after 4 weeks
That means Google thinks they're thin. Tell me and I'll raise the bar in
`src/lib/du-pyp-seo.ts` — the function `isProgrammeIndexable` (currently requires
≥ 3 subjects) and `isSubjectIndexable` (requires ≥ 1 paper). Bumping those to
e.g. ≥ 5 subjects / ≥ 2 papers drops the weakest pages from the sitemap.

### Old URLs
`/programs/*` and `/subjects/*` already 404 in production — leave them alone.
If you ever repopulate the database and they come back, tell me and I'll add
301 redirects (or canonicals) from them to the new `/papers/*` equivalents.

---

## Where the files are

| File | Location | What it is |
| --- | --- | --- |
| `SEO_ARCHITECTURE.md` | repo root **and** `~/Downloads/DU_SEO_Handoff/` | Full technical write-up, audit, test results |
| `SEO_VALIDATION.md` | repo root **and** `~/Downloads/DU_SEO_Handoff/` | URL counts + sample URLs from every level |
| `DEPLOY_AND_GSC_STEPS.md` | repo root **and** `~/Downloads/DU_SEO_Handoff/` | This file |
| `scripts/verify-seo-deploy.mjs` | repo | Post-deploy URL checker (Stage 2) |
| `scripts/seo-validate.mjs` | repo | Regenerates `SEO_VALIDATION.md` from the data file |
| New pages | `src/app/(site)/papers/[programmeSlug]/...`, `src/app/(site)/paper-code/[code]/`, `src/app/(site)/paper/[slug]/` | The 4 route levels |
| Sitemap | `src/app/sitemap.xml/route.ts`, `src/app/sitemaps/[shard]/route.ts`, `src/lib/sitemap-shards.ts` | Index + shards |
| Data layer | `src/lib/du-pyp-seo.ts` | Slugs, indexability rules, all lookups |
| Robots | `src/app/robots.ts` (replaces deleted `public/robots.txt`) | |

Git: branch `seo/scalable-page-architecture`, commits `3183171`, `b50463c`, `eb3c1c2`.
