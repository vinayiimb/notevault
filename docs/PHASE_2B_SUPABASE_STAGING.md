# Phase 2B — Supabase Staging Schema Deployment

**Date:** 2026-08-06
**Branch:** `infrastructure/backend-migration`
**Scope:** Deploy the existing Prisma schema (unchanged, Phase 2A indexes included) to a **staging-only** Supabase Postgres project. No production traffic, no DNS, no Vercel config, no data import. Neon remains the live production database — untouched.

---

## 1. Target

| | |
|---|---|
| Provider | Supabase |
| Hostname | `aws-0-ap-south-1.pooler.supabase.com` (verified `pooler.supabase.com`, verified **not** `neon.tech`, twice — once pre-flight, once immediately before `migrate deploy`) |
| Database name | `postgres` |
| `DATABASE_URL` | Transaction-mode pooler, port 6543, `pgbouncer=true` |
| `DATABASE_URL_UNPOOLED` | Session-mode pooler, port 5432 (used for migrations) |
| Credentials source | `.env.supabase-staging.local` (gitignored, never copied into `.env.local`, never printed in full in any command output this session) |
| Postgres version | 17.6 |

---

## 2. Migration Commands Used (in order)

```
npx prisma format
npx prisma validate
npx prisma migrate status      # before: 22 pending, 0 applied
npx prisma migrate deploy      # applied all 22
npx prisma generate
npx prisma migrate status      # after: "Database schema is up to date!"
```

Env vars were loaded per-command via `set -a; source .env.supabase-staging.local; set +a; <command>` in a single shell invocation each time — never persisted across commands, never echoed, never written into `.env.local` or any tracked file.

**Migration count:** 22 (21 pre-existing + `20260806120000_add_phase2a_query_performance_indexes` from Phase 2A). All 22 applied successfully, all 22 recorded in `_prisma_migrations`.

---

## 3. Application Tables Created (32)

```
Admin, CatalogPaperUpload, CatalogSubjectOverride, ContentBlock, CourseMatchMemory,
DriveFileMatch, DriveSubject, ExamSession, FailedUpload, Feedback, NoteTheme,
NoteThemeVersion, OrangeEvent, Program, Question, Resource, ScanRun,
SessionProgramLink, SiteSettings, Student, StudentExamDate, Subject, SubjectAlias,
SubjectAnalysis, SubjectMatchMemory, SubjectMergeLog, SubjectMergeSuggestion,
SubjectNotes, Term, TermPaper, UploadBatch
```

(31 application tables + `_prisma_migrations` = 32 total relations in `public`.)

- **Primary key constraints:** 32 (one per table, as expected)
- **Foreign key constraints:** 26
- **Unique indexes** (Prisma's `@unique`/`@@unique` — these are created as `CREATE UNIQUE INDEX`, not `ADD CONSTRAINT UNIQUE`, so they show up under `pg_indexes`, not `information_schema.table_constraints`): **50** — 32 primary-key indexes + 18 named unique indexes (e.g. `Program_slug_key`, `Subject_termId_slug_key`, `SessionProgramLink_sessionId_programId_variantLabel_key`). All match the schema exactly.

---

## 4. Indexes Verified

All 4 Phase 2A performance indexes confirmed present via `pg_indexes`:

- `Resource_subjectId_type_idx`
- `Resource_createdAt_idx`
- `Question_subjectId_isRepeated_idx`
- `DriveSubject_programId_name_idx`

---

## 5. Row-Count Summary

Every application table: **0 rows.** `_prisma_migrations`: **22 rows** (one per applied migration). Confirms this is a clean schema-only deployment — no Excel/CSV/JSON/application data was imported, consistent with the "do not import data" instruction.

---

## 6. RLS Status

**Every one of the 32 tables has `relrowsecurity = true` (RLS enabled), with `relforcerowsecurity = false`, and 0 rows in `pg_policies` for the `public` schema.**

This was **not** set by any migration (verified: no migration file contains any RLS/`ENABLE ROW LEVEL SECURITY`/policy statement — this schema was audited in Phase 2A) and was **not** set by this deployment — Supabase enables RLS by default on new tables in the `public` schema at the platform level. No RLS policies or privilege changes were made this phase, per instruction.

**Why reads/writes still worked:** the connecting role (`postgres`) has `rolbypassrls = true` (a Supabase-granted attribute on the project's owner role, distinct from true Postgres superuser — `rolsuper = false`). Table owner is also `postgres`. RLS-enabled-with-zero-policies means **any other role without `BYPASSRLS`** (e.g., a future scoped `service_role`/`authenticated`/`anon` connection) **would currently be denied all access** to every table. This is an important, unresolved item for whenever the app's runtime connection role changes — flagged here, not fixed, per "do not add RLS policies or alter privileges during this phase."

---

## 7. Pooled and Migration Connection Verification

- **`DATABASE_URL_UNPOOLED` (session pooler, 5432):** connected successfully, ran read queries successfully. Used for `migrate deploy` and all verification queries.
- **`DATABASE_URL` (transaction pooler, 6543, `pgbouncer=true`):** connected successfully, ran a read query successfully (`SELECT current_database()`), confirming the pgbouncer-fronted pooled connection works correctly with the current Prisma Client configuration (`prisma-client-js` provider, `postgresql` datasource) — no `prepared statement` errors or pgbouncer-mode incompatibilities observed.
- **Server-side Prisma access role:** `current_user = postgres`, `session_user = postgres` — confirms the current database role can read/write through Prisma as expected. `rolbypassrls = true` explains why this role isn't blocked by the RLS-enabled-with-no-policies state above.

---

## 8. Supabase-Managed Schemas

Confirmed present, untouched: `auth`, `extensions`, `graphql`, `graphql_public`, `pgbouncer`, `realtime`, `storage`, `vault`. No migration referenced any of these (grepped every `migration.sql` for `auth.`, `storage.`, `realtime.`, `extensions.`, `pg_catalog` — zero matches). Nothing in this deployment touched them.

---

## 9. Test / Build Results

| Check | Result |
|---|---|
| `npx tsc --noEmit` | ✅ 0 errors |
| `npx eslint .` | ✅ 0 errors, 12 pre-existing warnings (unrelated files, unchanged from before Phase 2A — unused imports in `prisma/import-nested-drive-pyqs.ts`, `prisma/process-qp-pdf.ts`, `pyq-notes/page.tsx`, `master-syllabus/page.tsx`, `master-syllabus-inspector.tsx`, `drive-archive-browser.tsx`) |
| `npm test` (28 tests, includes all 6 Phase 2A test files) | ✅ 28/28 passing |
| `npm run build` | ✅ exit 0 |

These were run **without** the Supabase env loaded (using the existing local-fallback `DATABASE_URL`), per the instruction not to make the staging database the default dev connection — they validate the code, and none of them require a live database (confirmed in Phase 2A: every DB-backed function has a graceful `try/catch` fallback).

---

## 10. Failures or Warnings

**None blocking.** Two things worth tracking, not failures:

1. **RLS-enabled-with-zero-policies on all 32 tables** (§6) — currently harmless only because the connecting role has `BYPASSRLS`. Needs a decision before any non-owner role ever connects to this database.
2. **12 pre-existing ESLint warnings** in files unrelated to this work (unused imports) — not introduced by Phase 2A or 2B, listed above for completeness.

---

## 11. Rollback Procedure

- **This deployment only affects the Supabase staging project** — Neon production is completely untouched (different `DATABASE_URL`, never connected to during this phase).
- **To roll back the schema:** the staging database can simply be deleted/recreated from the Supabase dashboard — there is no data in it (§5), so there's nothing to lose.
- **To reapply cleanly:** re-run `prisma migrate deploy` against a fresh empty staging database; all 22 migrations are idempotent-safe to run against an empty schema (verified this run).
- **Nothing to revert in the codebase** — no schema file changes were made this phase (Phase 2A's index migration was already committed at `35f84a1`). `.env.supabase-staging.local` can be deleted locally at any time; it was never committed (see §12).
- **If RLS blocks a future connection:** either grant the connecting role `BYPASSRLS` (matches current `postgres` role behavior) or add explicit `CREATE POLICY` statements per table — deliberately not done this phase.

---

## 12. Exact Prerequisites for Phase 2C (Data Import) — Not Started

1. **Decide the RLS posture** (§6) before importing real data — if any future non-owner role will read this database, policies need to exist first; importing data into an RLS-locked-with-no-policies table is safe (data isn't exposed to blocked roles) but inconvenient to later query without fixing RLS.
2. **Confirm the source of truth for the import** — Phase 1's audit (`docs/INFRASTRUCTURE_AUDIT.md` §7) found no `pg_dump`/export step currently wired up against Neon; one needs to be produced (e.g. `pg_dump --data-only` from Neon, or a Prisma-based seed replay) before Phase 2C can run.
3. **Row-count baseline from Neon** — capture actual production table counts from Neon before import, to validate the import completed correctly (compare against Neon, not against this now-empty staging DB).
4. **A maintenance/consistency window decision** — since Neon is still the live production database (per the Phase 2 decision sheet: "Replace Neon immediately? Not in production yet"), Phase 2C should target only this staging database, not production, until explicitly approved.
5. **Vercel Preview environment scoping decision** — per `docs/PHASE_2_QUERY_REMEDIATION.md` §12, Preview currently shares Neon with Production; before staging is useful for real preview testing, Preview's `DATABASE_URL`/`DATABASE_URL_UNPOOLED` should point at this Supabase staging project instead (not done this phase — explicitly "do not configure Vercel").
