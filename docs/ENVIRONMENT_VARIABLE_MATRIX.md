# Environment Variable Matrix

Snapshot as of 2026-08-06, `infrastructure/backend-migration` branch. No
values are recorded here — only which variables exist, what they're for,
and which environments currently have them (per `vercel env ls`, recorded
in `docs/PHASE_2_QUERY_REMEDIATION.md` §12, cross-checked against
`.env`/`.env.local`/`.env.supabase-staging.local` for local development).

## Database (Postgres)

| Variable | Current (Vercel Production, Preview) | Current (local dev) | Target after cutover |
| --- | --- | --- | --- |
| `DATABASE_URL` | Neon (production) | Neon (via `.env.local`) or Supabase staging (via `.env.supabase-staging.local`, sourced manually) | Production: Supabase production project. Preview: **separate** Supabase staging project (never production) |
| `DATABASE_URL_UNPOOLED` | Neon (production) | same as above | same split as `DATABASE_URL` |
| `PGHOST`, `PGHOST_UNPOOLED`, `PGUSER`, `PGPASSWORD`, `PGDATABASE`, `POSTGRES_*` (9 variants) | Neon-injected, Production+Preview | Not used locally (Prisma only) | Retire once off Neon — these are Neon/Vercel-integration-specific, not portable to Supabase |
| `NEON_PROJECT_ID`, `NEON_AUTH_BASE_URL`, `VITE_NEON_AUTH_URL` | Production, Preview | Not used | Retire with the Neon integration |

**Known pre-existing risk (documented in Phase 2A, unchanged by this
wave)**: Preview and Development currently share Production's exact
`DATABASE_URL`. Every PR preview deployment adds to production Neon's
egress. Fixing this requires actually pointing Preview at the new Supabase
staging project — a Vercel dashboard change, not done automatically by
this migration (see "Manual steps" in
`docs/COMBINED_MIGRATION_WAVE_2_REPORT.md`).

## Cloudflare R2 (file storage)

### Legacy (currently deployed, single bucket — `src/lib/storage.ts`)

| Variable | Current (Vercel) | Notes |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Production, Preview | Same bucket for both |
| `R2_ACCESS_KEY_ID` | Production, Preview | |
| `R2_SECRET_ACCESS_KEY` | Production, Preview | |
| `R2_ENDPOINT` | Production, Preview | |
| `R2_BUCKET_NAME` | Production, Preview | Single bucket, all categories mixed |
| `R2_PUBLIC_URL` | Production, Preview | |
| `BLOB_READ_WRITE_TOKEN` | Production, Preview, **Development** | Legacy `@vercel/blob` fallback, only var with a Development scope entry |

### New (Phase 2F/G, `src/lib/storage/`) — not yet provisioned anywhere

| Variable | Current | Purpose |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Not set (new var namespace, same name as legacy — see note) | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | Not set | |
| `R2_SECRET_ACCESS_KEY` | Not set | |
| `R2_ENDPOINT` | Not set | |
| `R2_PUBLIC_BUCKET` | **Not set anywhere** | New public bucket: papers/thumbnails/blog-images/syllabus |
| `R2_PRIVATE_BUCKET` | **Not set anywhere** | New private bucket: backups/original-source-files/rejected-imports/temp-admin-uploads |
| `R2_PUBLIC_BASE_URL` | **Not set anywhere** | Configured custom domain — never a bare `*.r2.dev` URL |

**`R2_ACCOUNT_ID`/`R2_ACCESS_KEY_ID`/`R2_SECRET_ACCESS_KEY`/`R2_ENDPOINT`
are reused by name between the legacy and new modules** — they can share
the same Cloudflare account credentials (an API token scoped to both
buckets) once `R2_PUBLIC_BUCKET`/`R2_PRIVATE_BUCKET` are provisioned; see
`docs/PHASE_2F_R2_STORAGE_MIGRATION.md`'s manual setup steps for exact
instructions.

## Authentication

| Variable | Current (Vercel) | Notes |
| --- | --- | --- |
| `JWT_SECRET` | Production, Preview (shared) | Custom JWT session signing (`src/lib/auth.ts`) — **not** NextAuth/Auth.js despite the originally-stated infrastructure list; see `docs/PHASE_2H_STAGING_APPLICATION_INTEGRATION.md`'s correction |
| `ADMIN_SEED_EMAIL`, `ADMIN_SEED_PASSWORD` | Production, Preview (shared) | Used by an admin-seeding script, not at runtime |

## Third-party services

| Variable | Current | Notes |
| --- | --- | --- |
| `GROQ_API_KEY` | Production, Preview (shared) | AI features (`src/lib/ai.ts`) |
| `RESEND_*` | Not found in current `vercel env ls` or local `.env*` | Stated in the infrastructure list as "Email: Resend" but no matching variable exists in this codebase today — either not yet integrated, or using a different mechanism. Not something this migration wave introduced or should fabricate; flagged for the operator to confirm. |
| `UPSTASH_*` | Not set anywhere | Rate limiting is currently the in-memory `src/lib/rate-limit.ts` (Phase 2A/2I) — correct per the "no paid dependency unless necessary" instruction. Add only if real cross-instance abuse is observed. |

## Diagnostics / internal

| Variable | Current | Notes |
| --- | --- | --- |
| `NOTEVAULT_QUERY_DIAGNOSTICS` | Not set (opt-in, local only) | `src/lib/query-diagnostics.ts` — only logs when `NODE_ENV !== "production"` AND this is `"1"`. Never set in any deployed environment. |
| `ALLOW_NON_SUPABASE_HOST` | Not set (opt-in, local test only) | `scripts/import/lib/target-guard.ts` — only for pointing the importer at a local test Postgres; never set in any deployed environment. |

## Recommended target scoping (post-cutover)

| Environment | Database | R2 (new module) | Notes |
| --- | --- | --- | --- |
| Production | Supabase production project | Production public+private buckets | Never shared with Preview/Development |
| Preview | Supabase **staging** project (already exists — see `.env.supabase-staging.local`) | Staging public+private buckets (not yet provisioned) | Currently still shares Production's `DATABASE_URL` — the #1 pre-existing risk this cutover should fix |
| Development | Local Postgres, or the same Supabase staging project | Staging buckets, or local-filesystem fallback (`src/lib/storage.ts` already does this when R2 isn't configured) | |
