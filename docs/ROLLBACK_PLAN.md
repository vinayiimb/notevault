# Rollback Plan

Covers two scopes: rolling back *this branch's work* (if it's never
merged, or merged and needs reverting before any production cutover), and
rolling back an *actual production cutover* (if `docs/PRODUCTION_CUTOVER_PLAN.md`
was executed and needs undoing).

## Scope 1: This branch (`infrastructure/backend-migration`)

Nothing in Checkpoints A–J touched production. Everything lives in this
branch and in the Supabase **staging** database. Rollback is simple:

- **Don't merge the branch.** No external state changes if it's never
  merged — the safest rollback of all.
- **Full code rollback** (if already merged): `git revert` the merge
  commit, or `git reset` to the pre-merge commit on `main` if it hasn't
  been pushed anywhere else yet. Never force-push over a shared branch
  without confirming with the user first.
- **Staging database rollback**: the 8,697 imported rows
  (118 Programs, 920 Terms, 7,650 Subjects, 9 ExamSessions) can be removed
  with `TRUNCATE "Program" CASCADE;` against the staging database only
  (cascades through Term/Subject/SessionProgramLink via their FK
  constraints) — **never run this against production**, and confirm the
  target hostname first (`echo $DATABASE_URL` piped through
  `node -e "console.log(new URL(require('fs').readFileSync(0,'utf8').trim()).hostname)"`,
  or just trust `target-guard.ts`'s own check by running any `import:*`
  command first and reading its `[target]` log line).
- **Migrations**: the 3 index-adding migrations
  (`20260806120000_add_phase2a_query_performance_indexes` and any
  migration after it in this branch) can be rolled back with
  `prisma migrate resolve --rolled-back <migration_name>` against staging
  followed by manually dropping the indexes, or simply left in place —
  they're additive and harmless even unused.

## Scope 2: A completed production cutover

If `docs/PRODUCTION_CUTOVER_PLAN.md` was executed and needs to be undone:

### 1. Vercel Production environment variables
Revert `DATABASE_URL`/`DATABASE_URL_UNPOOLED`/`R2_PUBLIC_BUCKET`/
`R2_PRIVATE_BUCKET`/`R2_PUBLIC_BASE_URL` back to the pre-cutover values
(Neon + the legacy single R2 bucket) in the Vercel dashboard. This alone
restores the app to its pre-cutover data source **without needing to touch
the new Supabase/R2 resources at all** — the old Neon database and legacy
R2 bucket are untouched by this entire migration wave (nothing in
Checkpoints A–J writes to them).

### 2. Redeploy
Trigger a new Vercel deployment after the environment-variable revert (a
redeploy is required for the new env values to take effect — env var
changes alone don't affect already-running instances).

### 3. Confirm rollback
Repeat the smoke tests from the cutover plan's step 8 against the
now-reverted production — confirm `/subjects/[id]` etc. render using the
old Neon data.

### 4. Data divergence warning
Anything written to the *new* production database between cutover and
rollback (new resource uploads, new student records, admin edits) is
**not** automatically carried back to Neon. If the cutover window was
longer than trivial, reconcile manually before attempting cutover again —
this migration wave includes no bidirectional sync tooling (out of scope,
consistent with "no automatic rollback command" reasoning in
`docs/PHASE_2G_FILE_MIGRATION_PLANNER.md`).

### 5. R2 rollback
New objects uploaded to the production R2 bucket during the cutover window
are not automatically deleted by an environment-variable revert (the old
legacy bucket is what's live again, not the new one — the new bucket's
objects just become unreferenced, not deleted). Clean up manually via
`src/lib/storage/delete.ts::deleteAsset()` per-object, or leave them (R2
storage cost for unreferenced objects is minor) until a deliberate cleanup
pass.

### 6. Migration rollback
Production migrations applied in step 3 of the cutover plan are **not**
automatically reverted by an environment-variable rollback (Neon's schema
is untouched, since production never pointed at Neon during this
migration's `prisma migrate deploy` — that ran against the *new* Supabase
production project only). No action needed here unless the new Supabase
production project itself needs decommissioning.

## What this migration wave does NOT provide

- No automated "one command" rollback — per Checkpoint G's own design
  decision, a migration this consequential should be rolled back
  deliberately, not via a generic flag that could itself mask a mistake.
- No bidirectional data sync between Neon/legacy-R2 and Supabase/new-R2 —
  the cutover is a one-way switch of which datastore is live, not a
  dual-write period.
