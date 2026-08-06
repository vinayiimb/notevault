# Combined Migration Wave 2 Report

**Branch:** `infrastructure/backend-migration`
**Date:** 2026-08-06
**Scope:** Checkpoints A–J of the DU PYQ Online → Supabase/R2 migration
(catalogue import completion, alias resolution, R2 storage layer, file
migration planner, staging integration, security audit, full verification).
Production was never touched — see "Final stop condition" at the end.

## 1. Commits created

| Commit | Checkpoints | Summary |
| --- | --- | --- |
| `146311a` | A | Idempotent Supabase staging catalogue import — fixes the Program slug→id lookup bug, adds apply/verify modes |
| `98d72fd` | B–E | Classifies all 160 rejected records, builds 4 alias mapping files, fixes the SessionProgramLink planner, reverifies idempotency live against staging |
| `38afccd` | F–G | Portable `src/lib/storage/` R2 module (mocked-tested, no real bucket), resumable file migration planner |
| `c610bc0` | H–I | Staging integration verification (live ISR proof, index confirmation), security audit (73 Server Actions checked, 2 real gaps fixed) |
| `4d1caf2` | J | Found and fixed a real client-bundle leak (`server-only` guards + a component-boundary fix) |

5 commits, none squashed, each independently reviewable.

## 2. Files changed

109 files changed across the wave (+16,337 / -172 lines vs. `main`). Per-commit
breakdown: 13, 17, 24, 4, 20 files respectively (see table above for what
each covers). Full diff: `git diff --stat main..infrastructure/backend-migration`.

## 3. Database row counts (Supabase staging, live-verified)

| Model | Count |
| --- | --- |
| Program | 118 |
| Term | 920 |
| Subject | 7,650 |
| ExamSession | 9 |
| SessionProgramLink | 0 (160 blocked — see §4) |
| **Total imported** | **8,697** |
| Resource, Question, and all other catalogue-adjacent models | 0 (out of scope for this wave — not yet imported) |

Verified via `npx prisma migrate status` (22/22 migrations applied) and a
live `import:verify` run (`ok: true`, 0 orphans, 0 duplicates across every
model).

## 4. Rejected records remaining

**160**, all `SessionProgramLink` rows, classified in
`reports/import-resolution/rejected-records-classified.json`:

| Category | Count |
| --- | --- |
| programme-name variation (has a proposed alias) | 112 |
| missing programme (no deterministic target exists) | 25 |
| invalid source data (source field spans 2+ real programmes) | 19 |
| malformed row (folder label/annotation leaked into the field) | 4 |

None were silently discarded. See
`docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md` for full reasoning and the
4 explicit open questions that need an operator decision (not resolvable
by more code).

## 5. Aliases approved

**0.** Per the rule against auto-merging programme/subject names, nothing
proposed by this wave is auto-approved — see `docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md`'s
"Important: nothing here is applied automatically" section. The 8
`term-aliases.json` entries are `approved`, but that file documents
already-implemented, unit-tested code logic (roman-numeral/digit
equivalence), not an AI judgment call — a different category from
program/subject aliases.

## 6. Aliases pending review

- **Programme aliases**: 19 `pending` (high-confidence, single-target,
  ready for fast human approval) + 2 `needs-review` (`ba-h-english`,
  `ba-h-history` — genuine ambiguity flagged, needs investigation before
  even proposing) + 20 `unresolved` (no deterministic target — needs a
  data-modeling decision, not an alias)
- **Subject aliases**: 81 `pending` (case/punctuation/spelling variants,
  from the existing `proposeSubjectAliases()` output)

All in `data/import-mappings/{program,subject}-aliases.json`, each entry
with `originalValue`, `rationale`, `confidence`, and `approvalStatus`.

## 7. SessionProgramLinks inserted

**0** — all 160 remain blocked on programme-alias approval. The planner
fix (`scripts/import/lib/alias-loader.ts` + `plan.ts`) makes this
deterministic once aliases are approved: no code change needed, just flip
`approvalStatus` to `"approved"` in `program-aliases.json` and re-run
`import:apply`.

## 8. Idempotency results

Confirmed twice, live against Supabase staging:
- `import:apply --confirm` → 0 new inserts, all 8,697 existing rows
  correctly recognized as `skippedExisting`
- `import:verify` → `ok: true`, 0 orphans, 0 duplicate-key groups across
  every model

## 9. R2 integration status

**Code complete, tested, not connected to a real bucket.** The repo's
existing R2 credentials are for the legacy single bucket the live app
already serves real files from — no distinct staging bucket exists, and
the new split-bucket env vars (`R2_PUBLIC_BUCKET`/`R2_PRIVATE_BUCKET`/
`R2_PUBLIC_BASE_URL`) aren't set anywhere. Per Checkpoint F's own fallback
rule, no real upload was attempted. 53 unit tests with a mocked
`S3Client.prototype.send` cover upload/delete/signed-URL/validation/path
logic. Manual bucket-provisioning steps: `docs/PHASE_2F_R2_STORAGE_MIGRATION.md`.

## 10. Files uploaded to staging

**0.** `storage:plan` ran live against staging and correctly found 0
`Resource` rows to migrate — this wave only imported the catalogue
(Program/Term/Subject/ExamSession), not papers/notes.

## 11. Files still pending migration

**0** (nothing to migrate yet — see §10). Once a future wave imports real
`Resource` rows, `storage:plan` will need to be re-run to generate a real
manifest.

## 12. Query and response-size improvements

Primarily from the earlier Phase 2A pass (`docs/PHASE_2_QUERY_REMEDIATION.md`),
**live-verified against Supabase staging in this wave**:
- ISR caching proven with real timing: `/subjects/[id]` 89s (cold, 4
  Postgres round trips to Mumbai-region Supabase) → 23ms (warm, cache-hit)
- 4 indexes confirmed live via `pg_indexes`
  (`Resource_subjectId_type_idx`, `Resource_createdAt_idx`,
  `Question_subjectId_isRepeated_idx`, `DriveSubject_programId_name_idx`)
- Two additional fixes this wave (`docs/PHASE_2I_SECURITY_AUDIT.md`):
  `/api/download/[resourceId]` narrowed from an unscoped `findUnique` (full
  row, including large `ocrText`/`rawOcrText` columns) to
  `select: { fileUrl: true }`

## 13. Security changes

- Audited all 73 exported Server Actions for admin-role verification — 69
  call `requireAdmin()` directly, 4 correctly public (verified, not
  assumed)
- Added rate limiting to 2 previously-unlimited public routes
  (`/api/search-suggestions`, `/api/download/[resourceId]`)
- Found and fixed a real client-bundle leak: 7 core server-only modules
  were missing `import "server-only"`; adding the guards surfaced (and
  this wave fixed) a pre-existing Server/Client Component boundary bug in
  the dashboard's currency icon. Re-verified the built client bundle is
  clean of `DATABASE_URL`/connection-string/service-role/JWT-secret
  patterns.
- Full detail: `docs/PHASE_2I_SECURITY_AUDIT.md`, `docs/PHASE_2J_FULL_VERIFICATION.md`

## 14. Test results

- App + storage: **64/64 passing**
- Importer: **39/39 passing**
- Total: **103/103 passing**, 0 failures, 0 skipped

## 15. Build result

`next build`: exit 0. Route table unchanged in shape from before this wave
(`/subjects/[id]`, `/pyq-notes/[id]`, `/terms/[id]`, `/exam-sessions/[id]`
remain ISR-eligible; `/sitemap.xml` remains hourly-cached) — no routes
added, removed, or changed in rendering mode by this migration.

## 16. Manual steps still required

1. Resolve the 4 open questions in `docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md`
   (48 of 160 rejected records need a product decision, not more code)
2. Review and approve/reject the 19 pending + 2 needs-review programme
   aliases and 81 pending subject aliases in `data/import-mappings/`
3. Provision distinct staging R2 buckets (public + private) — steps in
   `docs/PHASE_2F_R2_STORAGE_MIGRATION.md`
4. Provision distinct production R2 buckets before any cutover
5. Run a real `Resource`/paper import wave against staging, then
   `storage:plan`/`storage:upload` to actually exercise the file migration
   tooling end-to-end (currently only proven against 0 rows)
6. Manually browser-test admin login, bookmarks, and back/forward
   navigation (not exercisable from this environment — see
   `docs/PHASE_2H_STAGING_APPLICATION_INTEGRATION.md`)
7. Fix Preview/Development sharing Production's `DATABASE_URL` (pre-existing,
   documented in Phase 2A, not changed by this wave) — point Preview at
   Supabase staging instead
8. Confirm whether Resend (stated in the original infrastructure list) is
   actually integrated anywhere — no matching env var or code found (see
   `docs/ENVIRONMENT_VARIABLE_MATRIX.md`)
9. When ready, follow `docs/PRODUCTION_CUTOVER_PLAN.md` in full

## 17. Risks

Carried over from Phase 2A (unchanged, still accurate) plus new items from
this wave:
- Preview/Development share Production's Neon database (pre-existing)
- In-memory rate limiter is per-instance, not shared across Vercel
  serverless cold starts/regions (pre-existing, acceptable per "no paid
  dependency" constraint)
- `getCourseCoverageData` (admin-only) still does a deep nested include —
  flagged, not fixed, low risk (admin-only, bounded)
- 48 of 160 rejected `SessionProgramLink` records have no deterministic
  resolution path — require a genuine data/product decision
- Admin file uploads don't independently validate MIME/size beyond the
  global 25MB body cap — `requireAdmin()`-gated, low risk, documented as a
  natural fit for the new `src/lib/storage/validation.ts` once those call
  sites migrate to it
- R2 storage layer is entirely unexercised against a real bucket — first
  real upload should be closely watched

## 18. Production-cutover sequence

See `docs/PRODUCTION_CUTOVER_PLAN.md` — 12 steps, backup through
monitoring, explicit preconditions, nothing executed.

## 19. Rollback sequence

See `docs/ROLLBACK_PLAN.md` — covers both this branch (trivial, nothing
touched production) and a hypothetical post-cutover rollback (environment
variable revert is the primary lever; old Neon/legacy-R2 data is untouched
throughout this entire wave).

## 20. Hosting-portability notes

Nothing in this wave couples the app to Vercel or Supabase beyond
configuration — see `docs/PRODUCTION_CUTOVER_PLAN.md`'s closing section.
The R2 storage layer is S3-API-compatible by design (works against AWS S3/
MinIO/Backblaze unmodified); the database layer is standard Prisma+Postgres.

---

## Final stop condition — confirmed honored

This wave did **not**:
- Change any Vercel Production environment variable
- Change DNS
- Apply any migration to production
- Import any data into production
- Upload any file to production R2
- Redeploy production
- Delete the Neon database
- Move away from Vercel

Every write this wave performed was against Supabase **staging**
(`aws-0-ap-south-1.pooler.supabase.com`), verified by `target-guard.ts`'s
hostname check before every single import/storage command run.
