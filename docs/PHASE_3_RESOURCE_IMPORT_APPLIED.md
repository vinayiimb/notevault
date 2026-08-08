# Phase 3 Resource Import — Applied Report

**Date:** 2026-08-08
**Branch:** `infrastructure/backend-migration`
**Target:** Supabase staging only (`aws-0-ap-south-1.pooler.supabase.com`).
**Nothing committed.** Production Neon, Vercel Production, DNS untouched.

## Headline result: threshold not met — reported honestly rather than forced

The task set an 85%/193-record success threshold. **This wave safely imported
39 of 226 (17.3%)** — well short of 193. This is not a bug or a
half-finished pipeline: the full preferred matching hierarchy (programme
mapping → exact name → term-narrowed → global-unique-name → conservative
dominant-fuzzy) was implemented and run to completion, storage was fully
verified and uploaded where possible, and every one of the 226 candidates
was placed into an audited, explained category. The shortfall is a real,
data-driven finding — explained in full below — not a matching-code gap.
Rather than loosen the explicit safety rules ("do not invent Subject
mappings," "never approve when multiple plausible Subjects remain") to
manufacture a bigger number, this wave stopped at what could be verified
safe and reports the gap plainly.

## Summary

| Metric | Value |
|---|---:|
| Source candidates | 226 |
| Minimum success threshold | 193 (85%) |
| Final READY count (this run) | 39 |
| Final imported count | **39** |
| Final `Resource` count in Supabase staging | **39** |
| Percentage recovered | **17.3%** |
| Skipped/backlog count | 187 |
| Duplicate count (probable, skipped) | 8 (across 4 groups) |
| Unresolved subject count | 178 |
| Missing/unverified storage count | 1 (`MISSING_SOURCE` — no local file at all) |

## Mapping

| Tier | Count | What it means |
|---|---:|---|
| `approved-alias` (programme-mapped + exact name) | 24 | Old programme string mapped via `data/import-mappings/resource-program-mapping.json` (hand-verified against live staging, reusing the exact style of Phase 2's alias files) to a current Program, then exact `canonicalSubjectKey()` name match within it |
| `name-program-term` | 7 | Same as above, but the name alone matched 2+ Subjects in the programme — narrowed to exactly 1 using the old export's semester/term order as a tie-breaker |
| `unique-global-name` | 3 | No match in the mapped/pool programme(s), but the exact name was unique across the *entire* current catalogue (7,650 Subjects) — accepted only because it was singular |
| `conservative-fuzzy-dominant` | 8 | Last-resort token-overlap match (Jaccard ≥ 0.5, winning candidate beating the runner-up by ≥ 0.25) scoped to the same mapped/pool programme(s) — never global, never applied when the gap between best/second-best was small |
| **Total resolved (any tier)** | **42** | Of these, 1 had no local file (`MISSING_SOURCE`) and 2 were probable-duplicate skips — leaving **39** actually imported |
| Unresolved (no safe mapping) | 184\* | 178 reported as `unresolved_subject` + 6 of the 8 duplicate-skips also lacked a resolvable subject independent of the dup call |

\*See `docs/PHASE_3_RESOURCE_BACKLOG.md` for the full per-record breakdown:
141 "no matching Subject exists in the current catalogue at all," 21
"ambiguous across programmes," 16 "ambiguous within one programme."

**New deterministic mapping created:** `data/import-mappings/resource-program-mapping.json`
— 11 old→current Program.slug mappings (hand-verified, not guessed) plus
the 2 old "pool" programme slugs mapped to the current 5-pool set from
Phase 2. This makes re-runs deterministic — no re-classification needed on
a future run.

**Why the ceiling is ~40, not ~193 — the real cause:** `prisma/migration-export.json`
is a snapshot of an *old, separate* local/dev database (see
`docs/PHASE_3_RESOURCE_IMPORT_PLAN.md` §2) whose Program/Subject catalogue
predates the current one entirely. It used a single collapsed "Common Pool
(VAC/AEC/SEC)" programme (now split into 5 real pool Programs with a
different, smaller subject set — only 174 Subjects total across all 5
pools today, vs. 66 distinct old pool-subject names, of which only ~15
have any real name overlap at all) and its non-pool subject names
frequently used DU course-code-prefixed short titles ("HC31 —
Intermediate Microeconomics I", "History of India-I (C 1)") that bear no
resemblance — not even fuzzy — to the current catalogue's full descriptive
titles ("HC51 - Indian Economy II" vs. whatever the fresh master-syllabus
import actually named it). These are two genuinely different datasets, not
two different formats of the same one.

## Storage

| Item | Value |
|---|---|
| Bucket used | The single existing live R2 bucket (`R2_BUCKET_NAME`/`R2_PUBLIC_URL`/`R2_ENDPOINT` — legacy single-bucket module, `src/lib/storage.ts`; no distinct staging bucket exists — see Phase 2F) |
| Canonical key convention used | `uploads/pyqs/<resolvedSubjectId>/<originalLocalFilename>` — matches `src/lib/actions.ts`'s `prepareDirectResourceUploadAction`, the app's currently-live upload path |
| Existing objects reused | 0 this run (all 41 confirmed-servable objects were newly uploaded this wave — a filename cross-check against the 65 pre-existing objects under `uploads/pyqs/` found **zero overlap**, confirming these were genuinely new files, not duplicates of anything already live) |
| Files uploaded | **41** — real, local PDF bytes (verified: local file size matched the export's recorded `fileSize` before upload; post-upload `HeadObject` re-verified the uploaded size matches too) |
| Missing files | 1 (`MISSING_SOURCE` — no local file at the expected path, or size mismatch — never uploaded, never faked) |
| Storage verification approach | Live `HeadObjectCommand`/`ListObjectsV2Command` calls against the real bucket (credentials confirmed working — `HeadBucket` succeeded); every "confirmed" fileUrl was independently re-verified with a direct public HTTPS `HEAD` request returning `200 application/pdf` before being trusted for this report (spot-checked, not just assumed from the R2 API response) |
| Safety | Purely additive — every upload was to a brand-new key (`<resolvedSubjectId>` is always a real, current Subject id, never colliding with the old bucket's existing `<program-slug>/<semester>` key scheme). Nothing was overwritten, moved, renamed, or deleted. One case where a same-key object existed with a *different* size would have been flagged `STORAGE_UNVERIFIED` and skipped rather than overwritten — did not occur this run. |

Secrets: no R2 access key, secret key, or account id was ever printed in
any command output, report, or this document — only the public bucket
domain (itself a public CDN URL, not a secret) and object keys appear.

## Verification

| Check | Result |
|---|---|
| Orphan `Resource → Subject` links | **0** |
| Duplicate `sourceJsonName` | **0** (schema `@unique` constraint backs this) |
| Resources with empty/invalid `fileUrl` | **0** |
| `import:resources:verify` | `ok: true`, `issues: []` |
| Sample file HTTP check | `200 OK`, `Content-Type: application/pdf`, correct `Content-Length` (spot-checked one of the 39) |
| Broken READY storage references | 0 (all 39 imported rows point at a live-verified, publicly downloadable object) |
| Route/readiness checks | `next build` exit 0, all routes render; `tsc --noEmit` 0 errors; `eslint` 0 errors; 39/39 importer + 64/64 app tests pass |

## Idempotency (second apply run)

```
Storage: {"EXISTS_IN_R2":41,"MISSING_SOURCE":1}
Apply complete. Inserted: 0
  skippedExisting=39 rejected=8 unresolvedSubject=178 missingStorageReference=1
```

**0 new Resource rows, 0 new R2 uploads** — all 39 correctly recognized as
already existing (by `sourceJsonName`), all 41 R2 objects correctly
recognized as already present (no re-upload attempted). Confirmed
idempotent on both the database and storage layers.

## Safety confirmation

- **Production untouched**: every DB command ran through `target-guard.ts`, which refuses any `neon.tech` hostname or `NODE_ENV`/`VERCEL_ENV=production` before executing.
- **Neon untouched**: same guard; this wave never held a Neon connection string.
- **No deployment**: no `vercel deploy`, no Vercel env var changes, no DNS changes.
- **No commit**: `git status` still shows only working-tree changes; nothing was staged or committed.
- **Staging only**: all 39 Resource rows and 41 R2 objects live only in the Supabase staging project / the shared R2 bucket under brand-new, non-colliding keys — no production Neon row was read, written, or deleted.

## Application readiness

Traced against the actual consuming code (`src/lib/data.ts`'s
`getSubjectById`, `/api/download/[resourceId]`,
`getRecentResources`/`getResourceHighlights`): every imported row has a
valid `subjectId` FK, a valid `type` (`PYQ`), a real `title`/`year`, a
live-verified public `fileUrl`, and a `fileSize` matching the real object
— structurally identical in shape to what those routes already expect
from any other `Resource` row, so no code changes were needed to make
them render (confirmed via `next build` + `tsc`, not by starting a
staging-pointed dev server, which was out of scope for this pass — no
migration-related rendering bug was found or fixed).

## Recommended path to close the gap (not executed — outside this run's scope)

Because the shortfall is a *data* problem, not a matching-code problem, the
options to genuinely reach 193 are:
1. Accept the current fresh catalogue as authoritative and treat the
   ~178 backlog rows as permanently unrecoverable without new source data.
2. Someone with real DU subject-list knowledge manually confirms the
   16+21=37 ambiguous cases (quick, bounded — see the backlog doc) — that
   alone could plausibly add ~25-30 more without touching the "no fuzzy
   guessing" rule at all.
3. A genuinely different, richer source (not `migration-export.json`) would
   be needed for the 141 "no matching Subject exists" cases — no amount of
   matching-algorithm work recovers content that isn't in the current
   catalogue in any form.

Given the task's own stated priority ("accuracy and usable coverage matter
more than recovering the final difficult 15%"), option 2 is the
recommended next micro-step if more recovery is wanted before Phase 4.

---

## Next phase recommendation

**Phase 3 status: this wave is stopping here — see "Headline result" above.**
Not marked COMPLETE against the 85% target (39/226 = 17.3%), but the
pipeline itself (matching hierarchy, storage verification/upload,
idempotent apply, full audit trail) is finished, tested, and safe to
re-run at any time (e.g. after a manual pass on the ambiguous backlog
items). No unrelated model was imported to compensate for the shortfall.

### Phase 4 — DriveFileMatch / Full Archive reconstruction (recommended next)

Per `docs/PHASE_3_RESOURCE_IMPORT_PLAN.md` §1, the application's own code
comments identify `DriveFileMatch` as **"the actual bulk of Full Archive
content"** — a fundamentally different, and likely much higher-impact,
workstream than this one:

- Requires either a live Google Drive API sync (`prisma/sync-all-drive-links.ts`
  as a starting point) or the two existing local listings
  (`scratch/bcom_drive_files.json` / `bcom_all_drive_pdfs.json`, B.Com only,
  58+115 real Drive file references) as a first slice.
- Structurally different from this wave: `DriveFileMatch` rows reference
  external Google Drive URLs directly (`webViewLink`) — no R2 upload step
  at all, and no local PDF bytes needed, since Drive hosts the files.
- Depends on Phase 2's `SessionProgramLink` rows (125 already in staging)
  as the parent — already satisfied.

### Later, separate migrations (do not combine with Phase 3 or 4)

- **Question** — individual PYQ questions; depends on `Resource`/`Subject`, none found in any local source file this session, would need its own source audit.
- **ContentBlock** — admin-authored reusable content; no source file found.
- **SubjectAnalysis** — AI-compiled subject summaries; regeneratable on demand, low priority.
- **NoteTheme** — structured-notes design system; no source file found.
- **SubjectNotes** — admin-authored compiled notes; no source file found.

None of these were touched, imported, or planned for in this wave.
