# Phase 2H — Staging Application Integration

## Summary

Most of this checkpoint's substance (explicit `select` fields, default/max
pagination, no unrestricted `findMany`, no N+1, ISR caching with
`revalidatePath`/`revalidateTag` invalidation, admin/user data never
publicly cached) was already built and documented in an earlier pass —
`docs/PHASE_2_QUERY_REMEDIATION.md` ("Phase 2A"). That work happened
*before* a live database was reachable from this environment, so several
of its own findings were explicitly flagged as unverified ("database-
dependent tests not run in this sandbox"). This checkpoint's job was to
close that gap: connect to the real thing (Supabase staging, now live
after Phase 2D) and verify Phase 2A's claims for real, plus a few items
Phase 2A didn't cover.

## What was live-verified against Supabase staging (2026-08-06)

### Indexes actually apply
`npx prisma migrate status` against the staging database: **"Database
schema is up to date"** — all 22 migrations applied, including Phase 2A's
hand-authored index migration. Directly confirmed via `pg_indexes`:
`Resource_subjectId_type_idx`, `Resource_createdAt_idx`,
`Question_subjectId_isRepeated_idx`, `DriveSubject_programId_name_idx` all
exist on the live database. (Phase 2A's own doc flagged this migration as
"hand-authored, not `prisma migrate dev`-generated... should be double-
checked" — done, and it's correct.)

### ISR caching actually reduces round trips — proven, not assumed
Phase 2A's doc explicitly noted `unstable_cache`/ISR behavior can't be
observed via unit tests (`next dev` doesn't exercise the production cache
path at all). Verified with a real `next build && next start` against
staging:

```
GET /subjects/[id]  (1st hit, cold)   200  in  89s   [4 Postgres round trips, Mumbai-region latency]
GET /subjects/[id]  (2nd hit, warm)   200  in  0.023s [servedfrom ISR cache, zero new queries]

GET /sitemap.xml    (1st hit)         200  in  0.083s
GET /sitemap.xml    (2nd hit)         200  in  0.005s
```

The ~4,000x speedup on the second hit is unambiguous — `NOTEVAULT_QUERY_DIAGNOSTICS`
correctly logs nothing in production mode (`NODE_ENV !== "production"` gate,
by design — see Phase 2A §8), so the timing delta is the evidence, not the
query log.

**Correctness detail worth recording**: `next dev` was tried first and
*appeared* to show no caching (every hit re-ran all 4 queries) — this is
expected Next.js dev-mode behavior (ISR/data cache is intentionally
disabled in `next dev` so edits are always reflected), not a bug. Re-ran
against `next start` (real production rendering mode) to get a valid
signal. Worth remembering for any future "is caching working?" check —
`next dev` will always give a false negative.

### Confirmed not accidentally hitting production
Both runs' `getUnifiedPyqArchive` returned exactly 3,118 rows (the bundled
static catalog's fixed size) and `getPyqArchiveIndex`/`getFullDriveArchiveIndex`
returned 0 (matching staging's real state — this wave hasn't imported
`Resource`/`DriveFileMatch` rows yet). Both facts independently confirm the
staging-scoped `DATABASE_URL` was actually used, not a stray production
connection.

### robots.txt / sitemap / canonical URLs
- `public/robots.txt` exists, disallows `/admin/` and `/dashboard/`,
  correctly points `Sitemap:` at `https://www.dupyq.online/sitemap.xml` —
  confirms `dupyq.online` is already the intended production domain
  elsewhere in the codebase, consistent with this migration's target.
- `metadataBase` is set in `src/app/layout.tsx`, so every page's relative
  `alternates: { canonical: "..." }` resolves to an absolute URL correctly.
- `src/app/sitemap.ts` — confirmed cached (`revalidate = 3600`, per above).

## Corrections to the stated infrastructure list

**Authentication is not Auth.js/NextAuth.** `src/lib/auth.ts` implements a
custom session system: `bcryptjs` password hashing + `jsonwebtoken` signed
session tokens in an httpOnly cookie (`notevault_session`). There is no
`next-auth`/`@auth/*` dependency anywhere in `package.json`. This is a
factual correction, not something changed by this pass — rewriting working
auth to adopt NextAuth would be a large, unrequested, high-risk change
(global rule 11: don't merge unrelated changes into migration commits) and
was not done. If a NextAuth migration is actually wanted, it should be its
own separately-scoped piece of work.

## Checkpoint H items not verifiable from this environment

The following require an interactive browser and were not (and could not
safely be) exercised here — this is a tooling limitation being reported
honestly, not a claim that they work or don't:

- Admin login UI flow, admin authorization on protected pages (code-level
  authorization checks *are* covered in `docs/PHASE_2I_SECURITY_AUDIT.md`,
  which doesn't require a browser — this item is specifically about the
  click-through UX)
- Bookmarks (if present) — UI interaction
- Browser back/forward navigation behavior
- Search-suggestions debounce as experienced in a real browser (the
  server-side contract — min 2 chars, max 20 results, server-side limit —
  is unit-tested in `src/lib/__tests__/search-suggestions.test.ts`,
  already passing; only the client debounce timing itself needs a browser)

**Recommendation**: run these manually against a `next start` build
pointed at staging (exactly the setup used above) before production
cutover, or set up a headless-browser smoke test as a follow-up.

## Database/search/cache requirements — status

| Requirement | Status |
| --- | --- |
| Explicit `select` fields, no unrestricted `findMany` | ✅ Done in Phase 2A |
| Default page size 20, max 50 | ✅ `getPaginatedPyqArchive` (Phase 2A §9) — clamped, not rejected |
| No full archive dataset sent to browser | ✅ Scoped queries (Phase 2A §3) |
| No DB calls inside render loops / N+1 | ✅ Fixed for public paths in Phase 2A; one known admin-only N+1 left deliberately (`scanForDuplicateSubjects`, bounded, not public egress — Phase 2A §10 risk 5) |
| Search: min 2-3 chars, max 20 results, debounced, server-side limits | ✅ `search-suggestions` route + tests (Phase 2A) |
| Indexed filter columns | ✅ Live-verified this pass |
| Programme/term/subject metadata cached | ✅ ISR, live-verified this pass |
| Archive pages revalidated | ✅ `/pyq-notes` hourly ISR (pre-existing) |
| Admin changes invalidate relevant tags | ✅ `revalidatePath`/`revalidateTag` wired (Phase 2A §5) |
| User/admin data never publicly cached | ✅ Confirmed untouched by Phase 2A, still true |

## Not done, deliberately (carried over from Phase 2A, still correct not to do)

- `getPaginatedPyqArchive` is not wired into `/pyq-notes`'s UI — doing so
  means rewriting `CatalogArchiveBrowser`'s 735-line client-side
  grouping/filtering, which is a real UI redesign explicitly out of scope
  (global rule 10: preserve existing UI). The primitive is ready whenever
  that's separately greenlit.
- Vercel Preview/Development environment variables still point at the same
  database as Production (Phase 2A §10 risk 1) — **not changed here**,
  per "do not change Vercel Production environment variables" and because
  changing *Preview* scoping is itself a shared-infrastructure change
  that deserves its own explicit go-ahead. Documented as a required manual
  step in `docs/PRODUCTION_CUTOVER_PLAN.md` instead.
