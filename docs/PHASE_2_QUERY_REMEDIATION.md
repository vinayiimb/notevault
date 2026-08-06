# Phase 2A — Query, Caching & Network-Transfer Remediation

**Date:** 2026-08-06
**Branch:** `infrastructure/backend-migration`
**Scope:** Fix the query architecture and caching that the Phase 1 audit (`docs/INFRASTRUCTURE_AUDIT.md`) identified as the cause of Neon's ~7GB/month network transfer against a ~40MB database. **No production deploy, no DNS change, no Supabase connection, no environment-variable change.** Still on Neon.

---

## 1. Root Cause (recap from Phase 1, confirmed by this pass)

The database is genuinely small. The transfer was driven by *how often* and *how much* was queried per request, not by data volume:

1. **`getUnifiedPyqArchive()`** merged three sources — a bundled static catalog (2,431 rows, no DB cost) plus two unbounded Postgres `findMany()` calls (`getPyqArchiveIndex`, `getFullDriveArchiveIndex`, each scanning *every* PYQ resource / every synced Drive file on the site) — with **no caching and no scoping**, on every call.
2. **`/subjects/[id]`, `/pyq-notes/[id]`, `/terms/[id]`, `/exam-sessions/[id]`** had no `revalidate`/`dynamic` export, so each was fully re-rendered (fresh Postgres round trips) on every single visit.
3. **`sitemap.ts`** ran 7 full-table scans with no caching, so every crawler hit re-triggered all of them.
4. **`generateMetadata()` and the page component** on several dynamic routes each independently queried the same record — double the DB round trips per request.
5. **Deep `include`s** pulled full rows (including large `ocrText`/`rawOcrText` `@db.Text` columns) into list views that only ever rendered a title, a byte size, or a boolean flag.

---

## 2. Files Changed

```
 prisma/schema.prisma                                        |  26 ++
 prisma/migrations/20260806120000_..._indexes/migration.sql   |  NEW
 src/app/(site)/exam-sessions/[id]/page.tsx                   |   6 +
 src/app/(site)/pyq-notes/[id]/page.tsx                       |   7 +
 src/app/(site)/subjects/[id]/page.tsx                        |  16 +-
 src/app/(site)/terms/[id]/page.tsx                           |  10 +-
 src/app/admin/(dashboard)/subject-normalization/actions.ts   |   6 +-
 src/app/api/catalog-combined-pdf/route.ts                    |  23 +-
 src/app/api/search-suggestions/route.ts                      |  17 +-
 src/app/api/subjects/[id]/download-all/route.ts              |  28 +-
 src/app/sitemap.ts                                           |   6 +
 src/components/search-bar.tsx                                |   7 +-
 src/lib/actions.ts                                            |  14 +-
 src/lib/data.ts                                                | 404 +++++++++++++------
 src/lib/prisma.ts                                              |  41 +++
 src/lib/pyq-catalog.ts                                         | 128 +++++-
 src/lib/cache-tags.ts                                          |  NEW
 src/lib/query-diagnostics.ts                                   |  NEW
 src/lib/rate-limit.ts                                          |  NEW
 src/lib/__tests__/cache-tags.test.ts                           |  NEW
 src/lib/__tests__/pyq-archive-pagination.test.ts               |  NEW
 src/lib/__tests__/query-diagnostics.test.ts                    |  NEW
 src/lib/__tests__/rate-limit.test.ts                           |  NEW
 src/lib/__tests__/search-suggestions.test.ts                   |  NEW
 src/lib/__tests__/sitemap.test.ts                              |  NEW
 17 files changed, 597 insertions(+), 142 deletions(-)  (excluding new files, which git diff --stat doesn't size)
```

R2 storage integration was not touched, as instructed. `prisma/schema.prisma`'s `datasource` block (provider, `DATABASE_URL`/`DATABASE_URL_UNPOOLED`) is unchanged — still `postgresql`, still Neon.

> **Note on two unrelated files:** `src/components/archive/catalog-archive-browser.tsx` and `src/components/dashboard/student-course-card.tsx` also show as modified in `git diff` but were **not edited by this Phase 2A work** — see the completion message for details; they're flagged there for your decision, not folded into this remediation.

---

## 3. Queries Removed or Replaced

See `docs/QUERY_INVENTORY.csv` (new `phase_2a_status`/`phase_2a_notes` columns) for the full per-query ledger. Summary:

| # | What changed | Where |
|---|---|---|
| 1 | `getUnifiedPyqArchive()` / `getRawUnifiedPyqArchive()` now accept an optional `{subjectName?, programName?}` scope, pushed into the two Postgres-backed sub-fetches (`getPyqArchiveIndex`, `getFullDriveArchiveIndex`) as a Prisma `where`, instead of always scanning every row on the site. | `src/lib/pyq-catalog.ts`, `src/lib/data.ts` |
| 2 | `/subjects/[id]` now calls the archive scoped to `{subjectName: subject.name}` instead of the full unscoped union. | `src/app/(site)/subjects/[id]/page.tsx` |
| 3 | `/api/catalog-combined-pdf` now calls the archive scoped to `{programName: course}` instead of the full unscoped union. | `src/app/api/catalog-combined-pdf/route.ts` |
| 4 | New `getPaginatedPyqArchive(filters)` — the general-purpose `{programme, course, semester, subject, year, paperType, examSession, search, page, pageSize}` → `{items, page, pageSize, total, totalPages}` primitive requested by the spec. Not wired into `/pyq-notes` yet (see §9). | `src/lib/pyq-catalog.ts` |
| 5 | `getSubjectById` — `resources` include narrowed to 12 named fields; the large `ocrText` `@db.Text` column is no longer selected, replaced with an `ocrTextHash`-derived boolean (same rendered behavior — the UI only ever checked truthiness). | `src/lib/data.ts` |
| 6 | `getTermById` — `subjects.resources`/`subjects.questions` (full rows, including OCR text) replaced with a filtered Prisma `_count` (`resources: true`, `questions: {where: {isRepeated: true}}`). The page previously fetched every row just to call `.length()`. | `src/lib/data.ts`, `src/app/(site)/terms/[id]/page.tsx` |
| 7 | `getProgramsByLevel` — `include` converted to `select`, same shape, narrower field set on `Program`. | `src/lib/data.ts` |
| 8 | `searchSubjects`'s underlying subjects+aliases fetch — was 2 unbounded Postgres queries per keystroke (debounced, but still per-request); now `unstable_cache`-wrapped (5 min, tag `subjects`), with alias substring-matching moved to an in-memory scan over the cached list. | `src/lib/data.ts` |
| 9 | `/api/subjects/[id]/download-all` — `include` (full `Resource` rows) replaced with a 4-field `select`. | `src/app/api/subjects/[id]/download-all/route.ts` |
| 10 | `sitemap.ts` — no query changes (selects were already narrow); added route-level caching (see §5). | `src/app/sitemap.ts` |

**Deliberately left unchanged:** all admin-only queries (dashboard counts, CSV import matching, coverage tooling, subject-normalization scans) and all genuinely personalized queries (student dashboard, leaderboard, exam-date reminders) — the spec explicitly says admin/user data must never be publicly cached, and none of these are public, per-request, unbounded reads the audit flagged. Full reasoning per row is in the CSV.

---

## 4. Before/After Query Behaviour

```
Before (per visit to /subjects/[id]):
  Page request
    → getSubjectById()                    [1 query, full resources incl. ocrText]
    → generateMetadata() → getSubjectById() [DUPLICATE — 1 more full query]
    → getUnifiedPyqArchive()
        → getFullPyqCatalog()              [1 query: ALL catalogPaperUpload rows]
        → getPyqArchiveIndex()             [1 query: ALL PYQ resources, site-wide]
        → getFullDriveArchiveIndex()       [1 query: ALL synced Drive files, site-wide]
        → getCatalogSubjectOverrides()     [1 query: ALL overrides]
  = 6 Postgres round trips, 2 of them full-table scans, EVERY visit, EVERY visitor.

After (per visit to /subjects/[id], within the 6h ISR window):
  First visitor after a revalidation window:
    → getSubjectById()                     [1 query — React cache() dedupes the
                                             generateMetadata() call against this]
    → getUnifiedPyqArchive({subjectName})
        → getFullPyqCatalog()              [1 query: ALL catalogPaperUpload —
                                             small admin-managed table, unscoped]
        → getPyqArchiveIndex({subjectName}) [1 query: only THIS subject's resources]
        → getFullDriveArchiveIndex({subjectName}) [1 query: only THIS subject's drive files]
        → getCatalogSubjectOverrides()     [1 query: ALL overrides — small table]
  = 5 Postgres round trips, none of them full-table scans, ONCE per subject per 6h,
    then served from Next.js's ISR cache to every subsequent visitor until an
    admin edit calls revalidatePath (which was already wired in src/lib/actions.ts
    before this change — see §5) or the window expires.
```

```
Before (sitemap.xml):
  Every crawler hit → 7 full-table scans, every time.
After:
  7 full-table scans once per hour (export const revalidate = 3600), shared across
  every crawler/visitor in that window.
```

```
Before (search-suggestions, per keystroke after 200ms debounce):
  → searchSubjects(q)
      → prisma.subject.findMany({mergedIntoId: null})       [ALL subjects]
      → prisma.subjectAlias.findMany({normalizedName: {contains: aliasKey}}) [per-query DB hit]
After (per keystroke after 400ms debounce, min 2 chars):
  → searchSubjects(q)
      → getCachedSearchIndex()   [unstable_cache, 5 min TTL — 0 DB queries most keystrokes]
      → in-memory ranking/filtering over the cached list
```

---

## 5. Cache Strategy

Classic Next.js caching model was used throughout (**not** the `cacheComponents`/`use cache` directive) — `next.config.ts` doesn't enable `cacheComponents`, and switching the whole app onto Cache Components mid-migration is a much bigger, riskier change than this pass's scope. See `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` for the model this follows.

| Mechanism | Used for | Why |
|---|---|---|
| `export const revalidate = N` (page-level ISR) | `/subjects/[id]` (6h), `/pyq-notes/[id]` (6h), `/terms/[id]` (24h), `/exam-sessions/[id]` (24h), `sitemap.ts` (1h) | These pages had *no* caching at all — this is the primary fix. `generateStaticParams()` already returns `[]` with `dynamicParams = true` on all of them, so this is on-demand ISR: first visit per id generates and caches, every later visit in the window is free. |
| `revalidatePath()` on admin mutation | Same pages, invalidated instantly on edit | **Already implemented** in `src/lib/actions.ts` before this change — e.g. `updateSubjectIdentityAction` already called `revalidatePath(\`/subjects/${subjectId}\`)`. Those calls were previously no-ops (nothing was cached to invalidate); adding `revalidate` to the pages makes them do real work. No new `revalidatePath` calls were needed for these routes. |
| React `cache()` (per-request memoization) | `getSubjectById`, `getProgramBySlug`, `getTermById`, `getPyqResourceById`, `getExamSessionById`, `getSessionLinkWithSubjects` | Dedupes the `generateMetadata()` + page-component double-fetch within a single request. Doesn't persist across requests — that's what the page-level `revalidate` above is for. |
| `unstable_cache()` + `revalidateTag()` | `searchSubjects`'s subjects+aliases fetch (tag `"subjects"`, 5 min) | The only case where there's no single page's ISR to lean on — this data is read from both `/api/search-suggestions` (a Route Handler, not ISR-able the same way) and `/search` (a `searchParams`-driven page, which is *always* dynamic regardless of `revalidate`). `revalidateTag(CACHE_TAGS.subjects, "max")` was added to every subject-mutating admin action (create/rename/merge/delete, in `src/lib/actions.ts` and `subject-normalization/actions.ts`) so an admin's edit doesn't have to wait out the 5-minute window. Note: Next 16 requires the two-argument `revalidateTag(tag, profile)` form — the single-argument form is deprecated and no longer type-checks. |
| Scoped `where` (no caching layer, just a smaller query) | `getPyqArchiveIndex`/`getFullDriveArchiveIndex` called from `/subjects/[id]` and `/api/catalog-combined-pdf` | These callers need fresh, request-specific slices (one subject, one programme) — caching wasn't the fix, *scoping the query itself* was. |
| Left uncached | Admin routes, `/dashboard`, `/leaderboard`, exam-date reminders | Per the spec: admin/user-specific data must never be shared-cached. None of these were touched. |

### Cache tags

Centralized in `src/lib/cache-tags.ts` (`CACHE_TAGS.subjects` is the only one currently wired to a mutation — `programs`/`terms`/`pyqArchive`/`driveArchive` are declared for future use if a similar orphaned-cache situation shows up for those). A unit test (`cache-tags.test.ts`) guards against ever adding a user/session-scoped tag to that shared registry.

---

## 6. Sitemap Strategy

- `export const revalidate = 3600` added — the fix here was purely caching, **not** further select-narrowing: the 7 queries already used `select: { id/slug, ...timestamp }`, no `include`, no large fields (verified by `sitemap.test.ts`'s regex assertion against the source).
- Sitemap-index/segmentation was evaluated and **not implemented** — current entry count (programs + terms + subjects + PYQ resources + exam sessions + session links + drive-file/subject pairs + blog posts + ~14 static routes) is well under the ~50,000-URL single-sitemap limit search engines enforce; segmentation would add complexity without a real limit being approached. Revisit if the catalog grows an order of magnitude.
- No URLs were removed to reduce query count.
- No unpublished/private records are excluded because **none of the underlying models have a draft/private/publication-status field** — confirmed against the full Prisma schema during the Phase 1 audit. Nothing to filter.

---

## 7. Indexes Added

New migration: `prisma/migrations/20260806120000_add_phase2a_query_performance_indexes/migration.sql`. **Not applied to any database by this change** — hand-authored SQL (no local Postgres was reachable in this sandbox to run `prisma migrate dev`), following the exact naming convention Prisma's own migration generator uses (verified against `prisma format`/`prisma validate`, which both pass). Run `prisma migrate deploy` against a real environment to apply it — see §11 for the exact command.

| Index | Table | Why |
|---|---|---|
| `Resource_subjectId_type_idx` | `Resource(subjectId, type)` | `Resource.subjectId` had **no index at all** despite being the most-traversed relation in the app (every subject page, the archive merge, download-all). Composite with `type` because almost every real query also filters `type: "PYQ" \| "NOTES"` in the same `WHERE`. |
| `Resource_createdAt_idx` | `Resource(createdAt)` | Backs `getRecentResources` (`orderBy: createdAt desc, take: 6`) and `getResourceHighlights` (`orderBy: createdAt desc` per type) — without it, both do a full sort for a 1–6 row result. |
| `Question_subjectId_isRepeated_idx` | `Question(subjectId, isRepeated)` | `Question.subjectId` had **no index at all**. `isRepeated` is the other column every real query filters/orders by (`ExamWeightage`, the most-repeated-questions section, and the new `getTermById` filtered `_count`). |
| `DriveSubject_programId_name_idx` | `DriveSubject(programId, name)` | Backs the new program+subject-name scoped archive lookups (item 1 above). Equality-only — the case-insensitive match those callers use (`mode: "insensitive"`) still falls back to a scan within the (already `programId`-narrowed) row set, which is fine at this table's current per-programme size; a true case-insensitive index would need a functional/`citext` index, deliberately not added this pass (see §10).

Indexes considered and **not** added, with reasoning: `Resource.year`/`Subject.paperType` (never appear in a `WHERE`, display-only), exam-session/link ordering (nested `orderBy` on a relation chain, not indexable without denormalizing), "publication status" (no such field exists in the schema — confirmed, nothing to index).

---

## 8. Diagnostics

`src/lib/query-diagnostics.ts` — `recordQueryDiagnostic(name, fn, meta?)` wraps a data-layer call and, **only** when `NODE_ENV !== "production"` **and** `NOTEVAULT_QUERY_DIAGNOSTICS=1` is set, logs `name`, `route` (if passed), `durationMs`, row count, `pageSize` (if passed), and an approximate response size (`JSON.stringify(...).length`) via `console.debug`. It never logs the query result itself, request headers, cookies, or any credential — only shape metadata. Off by default everywhere, so it adds zero production log noise. Wired into every touched read function in `src/lib/data.ts` and the top-level `getUnifiedPyqArchive` in `src/lib/pyq-catalog.ts`.

To use it locally: `NOTEVAULT_QUERY_DIAGNOSTICS=1 npm run dev`, then watch the console while navigating.

---

## 9. Pagination Design

`getPaginatedPyqArchive(filters)` in `src/lib/pyq-catalog.ts` implements the exact shape requested:

```ts
type ArchiveFilters = {
  programme?: string; course?: string; semester?: string; subject?: string;
  year?: string; paperType?: string; examSession?: string; search?: string;
  page?: number; pageSize?: number;
};
type PaginatedArchiveResult = { items: CatalogPaper[]; page: number; pageSize: number; total: number; totalPages: number };
```

- Default `pageSize`: 20. Maximum: 50 (clamped, not rejected). `page` is clamped into `[1, totalPages]`.
- `programme`/`subject` are pushed into Postgres via the existing scope mechanism (§3, item 1) — genuine database-side filtering.
- `semester`/`year`/`paperType`/`examSession`/`search` run in memory over that already-scoped result. **This is a real architectural limit, not an oversight:** the unified archive is a union of one bundled-at-build static JSON catalog (2,431 rows, not a database table at all) and several Postgres tables, merged in application code with admin overrides layered on top (`CatalogSubjectOverride`). There is no single SQL table to push a `LIMIT`/`OFFSET` into across all of that without restructuring the data model — out of scope for "fix caching before the Supabase move."
- **Not yet wired into any route.** `/pyq-notes` continues to use the existing `getUnifiedPyqArchive()` (full array) feeding its 735-line client-side grouping/filtering UI (`CatalogArchiveBrowser`) — rewriting that UI to consume paginated server results is a real UI change, explicitly out of scope ("do not redesign the UI"). That page is already reasonably protected by its pre-existing `export const revalidate = 3600`. `getPaginatedPyqArchive` is ready as the primitive for that rewrite whenever it's greenlit as its own piece of work.
- Tested in `src/lib/__tests__/pyq-archive-pagination.test.ts` against the real bundled static catalog (no database needed — see §11).

---

## 10. Remaining Risks

1. **Preview and Development Vercel environments share the exact same `DATABASE_URL` as Production** (confirmed via `vercel env ls` — see §12). This was **not changed** by this pass (out of scope, and the Phase 2 decisions explicitly say "not required for this fresh migration" beyond documenting it). Every PR preview deployment currently adds to production's Neon egress. A runtime warning was added (`src/lib/prisma.ts`) that logs once per warm instance when a non-production `VERCEL_ENV`/`NODE_ENV` is pointed at a non-localhost database host — it cannot safely auto-fix this (no separate staging DB exists yet).
2. **`getPaginatedPyqArchive` is unused in production routes** — built to spec, tested, but not yet load-bearing. `/pyq-notes` still fetches the full archive (mitigated by its existing hourly ISR cache, not eliminated).
3. **`getCourseCoverageData`** (admin coverage tool, `src/lib/coverage-data.ts`) still does a deep nested include (`terms.subjects.resources`, `terms.subjects.driveSubjects.files`) — flagged High risk in Phase 1, not touched this pass because it's admin-only (not a public egress source) and reworking it risked breaking an actively-used admin screen without dedicated test coverage for it. Recommended follow-up: apply the same `_count`/select-narrowing pattern used for `getTermById`.
4. **`getDailyQuestion`'s `skip`/`take` rotation** has no supporting index for the `Question` table's implicit ordering by `createdAt` — `Question` gained a `(subjectId, isRepeated)` index this pass (a different access pattern), not one for this specific full-table `count()` + `skip()` rotation. Low risk today (Question table size is modest); revisit if it grows into the tens of thousands of rows.
5. **`scanForDuplicateSubjects`'s per-term loop** (`subject-normalization/actions.ts`) still issues one `findMany` per term inside a loop — an N+1 pattern, but admin-triggered and bounded by term count, not a public egress source. Left unchanged.
6. **In-memory rate limiter (`src/lib/rate-limit.ts`) is per-instance, not shared** — on Vercel's serverless runtime, a client rotating across cold starts/regions isn't caught by a single warm instance's counters. It stops the common single-instance-abuse case without a paid dependency (Upstash/Vercel KV), per the "do not add a paid dependency" instruction. If `/api/catalog-combined-pdf` or `/api/subjects/[id]/download-all` see real abuse, the real fix is a shared store.
7. **Hand-authored migration, not `prisma migrate dev`-generated** — no local Postgres was reachable in this sandbox. The SQL was written to match Prisma's exact generator conventions and the schema passes `prisma validate`/`prisma format`, but it should be double-checked with `prisma migrate diff` against a real target database before `prisma migrate deploy` (see §11).
8. **`/programs/[slug]` (already `force-static` before this pass) has no `revalidatePath` call wired to it** — checked during this pass; no admin action currently calls `revalidatePath(\`/programs/${slug}\`)` when a program's own name/summary changes (only `/admin/programs/${programId}` is invalidated). Pre-existing gap, unrelated to the audited egress problem, noted here rather than fixed (out of scope).

---

## 11. Verification Results

All run from the repo root, `infrastructure/backend-migration` branch, no live database available in this sandbox (verified by intentional connection failures below — the app's existing graceful-fallback `try/catch` pattern in every DB-backed function handled this correctly, which is also what made most of the new tests runnable without a database).

| Check | Command | Result |
|---|---|---|
| Prisma format | `prisma format` | ✅ `Formatted prisma/schema.prisma in 35ms` |
| Prisma validate | `prisma validate` | ✅ `The schema at prisma/schema.prisma is valid` |
| Prisma generate | `prisma generate` | ✅ Client regenerated, no errors |
| TypeScript | `tsc --noEmit` | ✅ 0 errors |
| ESLint | `eslint .` (touched files) | ✅ 0 errors, 0 warnings on every file this pass touched (pre-existing warnings on untouched files, e.g. `pyq-notes/page.tsx`'s unused `connection` import, are unrelated to this change and left alone) |
| Unit tests | `npm test` | ✅ 28/28 passing (22 pre-existing + 6 new files: `pyq-archive-pagination`, `rate-limit`, `search-suggestions`, `query-diagnostics`, `cache-tags`, `sitemap`) |
| Production build | `npm run build` | ✅ Exit code 0. Route table confirms the fix: `/subjects/[id]`, `/pyq-notes/[id]`, `/terms/[id]`, `/exam-sessions/[id]` all flipped from `ƒ` (server-rendered on demand) to `●` (SSG/ISR-eligible); `/sitemap.xml` shows `Revalidate: 1h`. |

**Compilation vs. database-dependent runtime distinction:** every `Can't reach database server at 127.0.0.1:5432` line seen during `npm run build` and `npm test` is the app's own pre-existing graceful-degradation path (`try { ...prisma... } catch { console.warn(...); return fallback }`) firing exactly as designed — not a build failure. The build and every test still exited 0. No real failure was hidden or bypassed; nothing here required `--force`, disabling type-checking, or skipping a step.

**Database-dependent tests not run in this sandbox:** none of the automated tests require a live database (the ones that touch data-layer code rely on the app's own fallback behavior against the real static catalog). What *is* only verifiable against a live Postgres and was **not** run here:
- That the new indexes actually apply cleanly (`prisma migrate deploy`).
- That `unstable_cache`/`revalidateTag` behave correctly inside a real Next.js server runtime (`unstable_cache` throws `Invariant: incrementalCache missing` outside that runtime — confirmed during `npm test`, and correctly caught by `searchSubjects`'s existing fallback, but this means the *cache-hit* path itself needs a real `next dev`/`next start` run to observe, not just a unit test).
- That ISR actually reduces real Postgres round trips end-to-end (would need `NOTEVAULT_QUERY_DIAGNOSTICS=1 next dev` against a real database, watching repeated visits to `/subjects/[id]` produce one query, not several).

---

## 12. Vercel Environment Scopes (current state — recorded, not changed)

Per your instruction to check but not modify. Output of `vercel env ls` against the linked `notevault` project:

| Variable | Environments | Assessment |
|---|---|---|
| `DATABASE_URL`, `DATABASE_URL_UNPOOLED` | **Production, Preview** | ⚠️ Same value in both — Preview deployments hit the production Neon database. No Development entry (local dev uses `.env.local`, not Vercel-injected). |
| `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `POSTGRES_*` (9 variants) | Production, Preview | Same issue — these are the Neon↔Vercel integration's auto-injected variants of the same underlying database. |
| `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL` | Production, Preview | Neon-integration metadata, same scope issue, low individual risk (not a connection string). |
| `R2_*` (6 vars: `ACCESS_KEY_ID`, `SECRET_ACCESS_KEY`, `ENDPOINT`, `BUCKET_NAME`, `ACCOUNT_ID`, `PUBLIC_URL`) | Production, Preview | Same R2 bucket for both — acceptable for now per the "R2 already working, don't touch it" decision; file storage isn't metered the same way Neon's transfer is. |
| `GROQ_API_KEY`, `ADMIN_SEED_PASSWORD`, `ADMIN_SEED_EMAIL`, `JWT_SECRET` | Production, Preview | Shared secrets across environments — standard risk for a project this size, not specific to the egress problem. |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview, **Development** | Legacy Vercel Blob fallback; only variable with a Development scope entry. |

### Recommended target scoping (once a Supabase staging project exists — Phase 2 decision: "create Supabase staging, after code fixes")

| Environment | Recommended database |
|---|---|
| Production | Production Supabase project |
| Preview | **Separate** staging Supabase project (or a Neon/Supabase branch database) — never production |
| Development | Local Postgres or a personal dev branch — never production |

This can't be done yet because no second database exists (per the Phase 2 decision to fix code first). The `src/lib/prisma.ts` warning added this pass is the interim guard: it'll fire in the Vercel deploy logs for any Preview/Development build the moment it's pointed at a non-localhost host, prompting a check of whether that host is production.

---

## 13. Rollback Instructions

Everything in this pass is additive/behavioral and lives entirely in this branch — nothing was deployed, no environment variable changed, no migration applied to any real database.

- **Full rollback:** `git checkout main -- .` (or simply don't merge this branch) — no external state to unwind.
- **Partial rollback of just the caching (if ISR ever serves visibly stale content):** remove the `export const revalidate = N` line from the affected page file(s) listed in §5; the underlying data-fetching code still works correctly without it (falls back to per-request dynamic rendering, exactly as before this pass).
- **Partial rollback of the search cache:** remove the `unstable_cache(...)` wrapper in `src/lib/data.ts`'s `getCachedSearchIndex` and inline the two Prisma calls directly in `searchSubjects` again (git history has the exact prior form).
- **Migration:** the new migration file was never applied anywhere. To *not* apply it, simply don't run `prisma migrate deploy` against it, or delete the migration folder before it's ever deployed (never `migrate resolve --rolled-back` against a database that already applied it, obviously — but that can't have happened here).
- **Rate limiting:** if the in-memory limiter ever misfires (false 429s under legitimate load spikes on one instance), raise the limits in `checkRateLimit(...)` calls in the two route files, or remove the `checkRateLimit` block entirely — it's a pure addition with no other code depending on it.

---

## 14. Supabase Staging Prerequisites (for Phase 2B — not started)

Per the Phase 2 decision sheet ("Create Supabase staging? Yes, after code fixes" and "Use existing Prisma schema? Yes, unless Claude finds necessary corrections"):

1. **No schema corrections were found necessary** — `prisma validate`/`prisma format` pass clean; the only schema change in this pass was the 4 additive indexes in §7, which are compatible with any Postgres target, Supabase included.
2. Provision a Supabase Postgres project (or branch) for **staging only** — not production yet, per the decision sheet.
3. Get its pooled + direct connection strings (Supabase's pgbouncer-style pooler + direct connection, mirroring the existing `DATABASE_URL`/`DATABASE_URL_UNPOOLED` split in `prisma/schema.prisma`).
4. Run `prisma migrate deploy` against that staging database — this will apply the full migration history including this pass's new index migration.
5. Point a **Preview** Vercel deployment (only) at the staging `DATABASE_URL`/`DATABASE_URL_UNPOOLED` — this simultaneously fixes remaining-risk #1 (§10) and gives a safe place to verify the caching/ISR behavior against a real Postgres instance before touching production.
6. Re-run the "database-dependent" verification items from §11 (§11's last bullet list) against that staging deployment before considering Phase 2B further.
