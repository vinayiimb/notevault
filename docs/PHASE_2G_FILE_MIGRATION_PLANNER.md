# Phase 2G — File Migration Planner

## What this is

A resumable, dry-run-by-default planner/uploader that migrates `Resource`
rows (the app's PDF/notes records) from wherever they currently live
(legacy R2 bucket, `@vercel/blob`, or a local `/uploads/...` path) onto the
new deterministic key scheme in `src/lib/storage/` (Phase 2F), only ever
updating Postgres after a confirmed-successful upload.

```
scripts/storage-migration/
  lib/types.ts       shared types
  lib/plan.ts         pure planning logic (11 unit tests, no I/O)
  lib/manifest.ts     manifest/state file read-write helpers
  run.ts              CLI: plan / upload / verify
  __tests__/
```

## Commands

```
npm run storage:plan     # read-only, default/safe — builds reports/storage-migration/plan-manifest.json
npm run storage:upload   # requires --confirm AND a configured R2 target; else refuses
npm run storage:verify   # read-only — compares the manifest against current DB state
```

All three go through `scripts/import/lib/target-guard.ts` first, same as
the catalogue importer — refuses to run against `neon.tech`, a non-Supabase
host (without the explicit local-test override), or `NODE_ENV=production`.

## How planning works

For each `Resource` row: builds the deterministic target key via
`buildObjectKey()` from `src/lib/storage/paths.ts`
(`papers/{programmeSlug}/{semester-N}/{subjectSlug}/{year}/{resourceId}.pdf`
for PYQs, `syllabus/...` for NOTES), classifies the current `fileUrl`'s
origin (`legacy-r2`, `vercel-blob`, `local-path`, `already-r2-new-layout`,
`unknown`), and buckets the row into one of four outcomes:

| Status | Meaning |
| --- | --- |
| `to-migrate` | Needs uploading to the new deterministic key |
| `already-migrated` | `fileUrl` already matches the new layout — no-op |
| `duplicate-skip` | Same `fileHash` (existing SHA-256 column) as an earlier planned row — never uploads the same bytes twice, even across different `Resource` rows pointing at the same PDF |
| `missing-metadata` | No `year`/programme/subject slug available — cannot build a deterministic key; flagged, never silently skipped or guessed |

## Resumability

`storage:upload` writes `reports/storage-migration/upload-state.json` after
**every single item**, not just at the end — an interrupted run (crash,
Ctrl-C, timeout) resumes exactly where it left off on the next invocation,
skipping anything already recorded as `"status": "uploaded"`. Failed items
stay in the state file and are retried on the next run.

## Postgres is only touched after a successful upload

`Resource.fileUrl` is updated in the same iteration as a successful
`uploadAsset()` call, never before, and never for a `failed` or
`duplicate-skip` entry. A `duplicate-skip` row is left pointing at its
original `fileUrl` — deduping the *upload*, not silently rewriting a
`Resource` row to point at bytes uploaded on behalf of a different row.

## Rollback

Nothing is deleted by this tool — `storage:upload` only ever adds a new R2
object and updates one `fileUrl` column per successful item. To roll back a
batch: restore `Resource.fileUrl` values from the pre-migration state
(the manifest's `entries[].currentFileUrl` is exactly that) via a scoped
`UPDATE`, and optionally delete the newly-created R2 objects with
`src/lib/storage/delete.ts::deleteAsset()`. No bulk/automatic rollback
command was built — a migration batch this consequential should be rolled
back deliberately, row by row or via a reviewed script, not a generic
`--rollback` flag.

## Current status (2026-08-06)

Ran `npm run storage:plan` for real against Supabase staging (read-only,
safe): **0 Resource rows exist yet** — this import wave only populated
Program/Term/Subject/ExamSession (see `docs/PHASE_2D_WAVE1_STAGING_IMPORT.md`),
not the paper/notes catalogue itself. The manifest correctly reports
`totalResources: 0`, proving the tool runs cleanly end-to-end against the
real database, but there is nothing to migrate until a future wave imports
actual `Resource` rows.

`storage:upload` was not run for real — per Phase 2F, no distinct R2
staging bucket exists yet (`isR2Configured()` returns `false` for the new
`R2_PUBLIC_BUCKET`/`R2_PRIVATE_BUCKET`/`R2_PUBLIC_BASE_URL` variables), and
`run.ts` refuses to proceed without them, exactly as designed.

## Test coverage

11 unit tests for the pure planning logic (`lib/plan.ts`) — origin
classification, deterministic key construction (including the
`PYQ`-vs-`NOTES` category split), missing-metadata detection, and
duplicate-by-hash detection (including the "no hash = never falsely
deduped" edge case). `run.ts`'s I/O-heavy paths (Prisma queries, `fetch`,
`uploadAsset`) are exercised by `storage:plan`/`storage:verify`'s live,
safe, read-only runs against Supabase staging rather than mocked — there
was nothing meaningful to mock with 0 `Resource` rows in the target
database.
