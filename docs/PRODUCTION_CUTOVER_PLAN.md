# Production Cutover Plan

**Status: prepared, not executed.** Nothing in this document has been run
against production. Every step here requires an explicit, separate go-ahead
— this migration wave's own stop condition is "before changing Vercel
Production variables, changing DNS, applying production migrations,
importing production data, uploading production R2 files, redeploying
production."

## Preconditions before starting this sequence

- [ ] All open items in `docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md`'s
      "Open questions for the operator" resolved (25 `missing programme` +
      19 `invalid source data` + 4 `malformed row` records — 48 of 160
      rejected `SessionProgramLink` rows need an actual decision, not just
      code)
- [ ] `data/import-mappings/program-aliases.json`'s 19 `pending` + 2
      `needs-review` entries reviewed and flipped to `approved` (or
      rejected) by a human — see Checkpoint C's rules; nothing here should
      be bulk-approved without reading each rationale
- [ ] `data/import-mappings/subject-aliases.json`'s 81 `pending` entries
      reviewed the same way
- [ ] A distinct **production** R2 account/token provisioned (separate
      from whatever staging ends up using) — see
      `docs/PHASE_2F_R2_STORAGE_MIGRATION.md`'s manual setup steps,
      repeated for production buckets
- [ ] A real `Resource` import wave has run against staging (this wave
      only populated Program/Term/Subject/ExamSession — 0 papers exist in
      staging yet, so `storage:plan`/`storage:upload` have never moved a
      real file) and `storage:verify` confirms 0 pending
- [ ] Staging smoke tests from `docs/PHASE_2H_STAGING_APPLICATION_INTEGRATION.md`'s
      "not verifiable from this environment" list actually run in a real
      browser (admin login, bookmarks, back/forward nav)

## Sequence

### 1. Final staging backup
```
# Supabase: use the dashboard's built-in point-in-time-recovery / manual
# backup, or:
pg_dump "$STAGING_DATABASE_URL_UNPOOLED" -Fc -f staging-backup-$(date +%Y%m%d).dump
```
Store outside the repo (private R2 bucket's `database-backups` category is
the intended home once that bucket exists — see Phase 2F).

### 2. Final import preview against staging
```
set -a; source .env.supabase-staging.local; set +a
npm run import:validate
```
Must exit 0 (no rejected/unresolved records) before proceeding — if
anything is still rejected/unresolved at this point, stop and resolve it
in staging first, not production.

### 3. Production Supabase migration
```
set -a; source .env.production-supabase.local; set +a   # does not exist yet — create it
npx prisma migrate deploy
npx prisma migrate status   # confirm "up to date"
```
Uses the exact same migration history already proven against staging
(22 migrations, including the Phase 2A index migration — already
confirmed applying cleanly, per `docs/PHASE_2H_STAGING_APPLICATION_INTEGRATION.md`).

### 4. Production catalogue import
```
npm run import:apply -- --confirm
npm run import:verify
```
`target-guard.ts` will refuse to run this against anything whose hostname
doesn't end in `pooler.supabase.com` or contains `neon.tech` — confirm the
sourced env file is genuinely the production Supabase project before
running.

### 5. R2 production upload
```
set -a; source .env.production-r2.local; set +a   # does not exist yet — create it
npm run storage:plan
# review reports/storage-migration/plan-manifest.json
npm run storage:upload -- --confirm
npm run storage:verify
```

### 6. Vercel Production environment-variable update
Update in the Vercel dashboard (not via this repo — no `.env` file should
ever contain production credentials):
- `DATABASE_URL`, `DATABASE_URL_UNPOOLED` → production Supabase
- `R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL` → production R2
- Also fix the pre-existing Preview-shares-Production-database issue while
  here: point **Preview** at the Supabase *staging* project, not
  production — see `docs/ENVIRONMENT_VARIABLE_MATRIX.md`

### 7. Production deployment
Standard Vercel deploy (push to the branch Production tracks, or
`vercel --prod`). Confirm the build log shows the same route table as the
staging build (`docs/PHASE_2J_FULL_VERIFICATION.md`'s verification table).

### 8. Smoke testing
Repeat the live checks already proven against staging in this wave:
- `npx prisma migrate status` → up to date
- Hit `/subjects/[id]` twice, confirm the second is fast (ISR cache-hit)
- Hit `/sitemap.xml`, confirm valid XML and fast second hit
- Confirm `/admin` redirects to `/login` when logged out
- Confirm a real admin login succeeds and an admin mutation works

### 9. Cache invalidation
Not applicable as a separate step — this is a fresh deploy, so there's no
stale ISR cache to invalidate. If cutover happens without a full redeploy
(unlikely), call `revalidatePath`/`revalidateTag` for every route in
`docs/PHASE_2_QUERY_REMEDIATION.md` §5's cache table.

### 10. Search Console and sitemap verification
- Submit/re-verify `https://www.dupyq.online/sitemap.xml` in Google Search
  Console (`public/robots.txt` already points at this URL)
- Spot-check a handful of `/subjects/[id]`, `/programs/[slug]` URLs render
  correctly and match their pre-cutover canonical URLs (no URL structure
  changed by this migration — global rule 10)

### 11. Monitoring
- Watch Vercel function logs for the first hour post-cutover for any
  `[db-safety]` warnings (would indicate a non-production environment
  accidentally pointed at the new production database, or vice versa)
- Watch Supabase's dashboard for connection-pool saturation and query
  latency in the first hour
- Confirm `NOTEVAULT_QUERY_DIAGNOSTICS` is **not** set in Production (it
  should never be — verify via `vercel env ls`)

### 12. Rollback criteria
Trigger `docs/ROLLBACK_PLAN.md` if, within the first hour:
- Error rate on any core route (`/`, `/subjects/[id]`, `/programs/[slug]`,
  `/pyq-notes`) exceeds baseline
- `prisma migrate status` on production shows anything other than "up to
  date"
- Admin login stops working
- Real user-facing PDFs 404 that didn't before (R2 migration issue)

## Hosting-portability notes

Nothing in this migration wave couples the app to Vercel or Supabase
specifically beyond configuration:
- **Database**: standard Prisma + Postgres. Moving off Supabase means
  changing `DATABASE_URL`/`DATABASE_URL_UNPOOLED` and re-running
  `prisma migrate deploy` against the new target — no Supabase-specific
  APIs are used anywhere in the schema or application code.
- **File storage**: `src/lib/storage/` is deliberately S3-API-compatible,
  not Cloudflare-specific (see `docs/PHASE_2F_R2_STORAGE_MIGRATION.md`) —
  works unmodified against AWS S3, MinIO, or Backblaze B2's S3 endpoint by
  changing `R2_ENDPOINT` and credentials.
- **Hosting**: standard Next.js — no Vercel-specific APIs beyond the
  `VERCEL_ENV` check in `target-guard.ts`/`src/lib/prisma.ts`'s db-safety
  warning (both fail safe — treat an unset `VERCEL_ENV` as non-production,
  never as a bypass).
