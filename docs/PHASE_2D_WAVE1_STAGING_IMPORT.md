# Phase 2D — Wave 1 Staging Import

**Date:** 2026-08-06
**Branch:** `infrastructure/backend-migration`
**Scope:** Apply the Phase 2C-validated Wave 1 catalogue data (Program/Term/Subject/ExamSession/SessionProgramLink) to the Supabase staging database, verify it, and prove idempotency with a second apply run. **Production Vercel/Neon untouched. No R2 objects touched. Not committed (per instructions).**

---

## 1. Source Snapshot / Checksum Information

| File | SHA-256 | Last commit before this phase |
|---|---|---|
| `src/lib/content/master-syllabus-data.ts` | `e4d408be92104545c7583f3ff10c8929971288b486e5521fe4c1879ddb8b0066` | `39fb382` (2026-08-02 20:38:00 +0530) |
| `src/data/exam-sessions-source.ts` | `0e6400bf514899d7551ace558306ce70fe35c7c8a236e96bb87a4de8b39ca49f` | `e398088` (2026-08-06, Phase 2C commit) |

`git status` was clean for both files at the start of this phase — no source-file drift since Phase 2C's `import:preview` was last generated.

---

## 2. Discrepancy Noted Before Proceeding

The Phase 2D brief stated **147 rejected / 63 proposed alias groups**. The actual, reproduced numbers — both in Phase 2C's original run and re-verified at the start of this phase — are **160 rejected / 81 proposed alias groups**. The scope-defining number, **8,697 estimated writes**, matched exactly. Since (a) re-running `import:validate`/`import:preview` this phase reproduced Phase 2C's 160/81 byte-for-byte (see §3), and (b) the approved import scope is defined functionally ("rows that passed validation"), not by a fixed count, this was treated as an inaccuracy in the brief's recollection rather than a sign of data drift, and the import proceeded on the verified 160/81 figures. Flagged here rather than silently reconciled.

---

## 3. Pre-Import Checkpoint

| Check | Result |
|---|---|
| `.env.supabase-staging.local` gitignored | ✅ `.gitignore:34` |
| Target is Supabase Mumbai staging | ✅ `aws-0-ap-south-1.pooler.supabase.com` (`ap-south-1` = AWS Mumbai) for both `DATABASE_URL` and `DATABASE_URL_UNPOOLED` |
| All 22 Prisma migrations applied | ✅ `prisma migrate status` → "Database schema is up to date!" |
| Pre-import row counts (Wave 1 models) | Program 0, Term 0, Subject 0, ExamSession 0, SessionProgramLink 0 — all as expected |
| Source files unchanged since Phase 2C | ✅ `git status` clean on both source files |
| `import:validate` re-run | Exit 1 (expected — 160 unresolved `SessionProgramLink` records are a known, correct rejection, not a new problem) |
| `import:preview` re-run vs. Phase 2C snapshot | **Byte-identical** (diffed with `generatedAt`/`mode` excluded) — confirmed twice, once before and once after a mid-phase code fix (§4) |

No unexpected count changes — checkpoint passed, proceeded to apply.

---

## 4. A Bug Found and Fixed Mid-Phase

The first apply run (§5) succeeded, but the **idempotency test (second apply run, §6) initially failed** with a Postgres unique-constraint violation (`P2002` on `Term(programId, order)`). Root cause: `scripts/import/lib/plan.ts`'s existing-row lookup for `Term` (and, on inspection, `Subject` and `SessionProgramLink` too) was written to accept Program **slugs** but called into a `db-lookup.ts` function that filters by real Postgres **`Program.id`** — so the "does this Term already exist" check silently always returned an empty set, regardless of what was actually in the database. On a fresh (empty) database this defect was invisible (nothing existed to detect either way); Phase 2C's own write-up had already flagged this exact code path as a "known limitation," but described it as "best-effort" rather than the hard failure it turned out to be.

**Fix:** `plan.ts` now resolves candidate Program slugs to real ids first (`getProgramIdsBySlug`), performs the id-keyed existing-row lookups, then translates the results back into the same slug/label-based natural-key format used everywhere else in the plan — applied consistently for `Term`, `Subject`, and `SessionProgramLink` (the last of which had the identical latent bug, unexercised only because all 160 of this dataset's link rows are unresolved regardless). Re-ran `preview` against the now-populated staging database afterward and confirmed all 8,697 rows correctly reported as `alreadyExists` before retrying the idempotency test — see §6.

This is exactly the kind of defect the idempotency-test requirement exists to catch, and it did.

---

## 5. First Apply Run

Command: `import:apply` with `--confirm`, `DATABASE_URL`/`DATABASE_URL_UNPOOLED` loaded from `.env.supabase-staging.local` via `set -a; source .env.supabase-staging.local; set +a` (never printed; target-guard confirmed `host=aws-0-ap-south-1.pooler.supabase.com` before any write).

| Model | Inserted | Skipped (existing) | Rejected | Unresolved FK |
|---|---|---|---|---|
| Program | 118 | 0 | 0 | 0 |
| Term | 920 | 0 | 0 | 0 |
| Subject | 7,650 | 0 | 0 | 0 |
| ExamSession | 9 | 0 | 0 | 0 |
| SessionProgramLink | 0 | 0 | 0 | 160 |
| **Total inserted** | **8,697** | | | |

Matches the Phase 2C estimate exactly. No rejected SessionProgramLink rows were force-inserted; no foreign keys were fabricated.

---

## 6. Second Apply Run (Idempotency Test)

Same command, same target, immediately after the fix in §4.

| Model | Inserted | Skipped (existing) | Rejected | Unresolved FK |
|---|---|---|---|---|
| Program | 0 | 118 | 0 | 0 |
| Term | 0 | 920 | 0 | 0 |
| Subject | 0 | 7,650 | 0 | 0 |
| ExamSession | 0 | 9 | 0 | 0 |
| SessionProgramLink | 0 | 0 | 0 | 160 |
| **Total inserted** | **0** | | | |

**Zero new records, zero duplicates, every row correctly reported as already-existing.** Original IDs preserved (nothing was deleted/recreated — `create()` was never called for anything already present, so the cuids from the first run are untouched). No new rejected rows appeared. The 160 unresolved links are the same 160 both runs (same source data, same resolution logic).

---

## 7. Post-Import Verification (`import:verify`)

Run identically after both apply runs — results were the same both times (i.e., row counts didn't grow from run 1 to run 2, confirming idempotency at the database level, not just at the importer's self-reported level):

```json
{
  "counts": { "Program": 118, "Term": 920, "Subject": 7650, "ExamSession": 9, "SessionProgramLink": 0 },
  "orphanTerms": 0, "orphanSubjects": 0, "orphanSessionLinks": 0,
  "duplicateProgramSlugs": 0, "duplicateTermKeys": 0,
  "duplicateSubjectKeysWithinTerm": 0, "duplicateExamSessionLabels": 0, "duplicateSessionLinkKeys": 0,
  "ok": true, "issues": []
}
```

- **Foreign-key integrity:** verified with explicit `LEFT JOIN ... WHERE parent.id IS NULL` queries (not just trusted from the schema's `ON DELETE CASCADE` constraints) — zero orphan Terms, Subjects, or SessionProgramLinks.
- **Unique-constraint integrity:** verified with explicit `GROUP BY ... HAVING count(*) > 1` queries on every Wave 1 unique key (`Program.slug`, `Term(programId, order)`, `Subject(termId, slug)`, `ExamSession.label`, `SessionProgramLink(sessionId, programId, variantLabel)`) — zero duplicates found in every case.
- **No exact duplicate subjects within scope:** the same check that produced 0 `duplicateSubjectKeysWithinTerm` covers this directly (a duplicate subject *within its intended scope* is precisely a repeated `(termId, slug)` pair).
- **Excluded models:** `resource`, `question`, `contentBlock`, `subjectAnalysis`, `subjectAlias`, `subjectNotes`, `noteTheme`, `catalogPaperUpload`, `catalogSubjectOverride`, `driveSubject`, `driveFileMatch`, `admin`, `student`, `studentExamDate`, `orangeEvent`, `feedback`, `failedUpload`, `scanRun`, `subjectMergeSuggestion`, `subjectMergeLog` — **all confirmed 0 rows**. No user/authentication data was inserted; nothing outside the approved Wave 1 scope was touched.

---

## 8. Query & Application Smoke Tests

Ran `scripts/import/tools/smoke-test.ts` — exercises the **live app's own** `src/lib/data.ts` functions (not test-only code) against staging:

| Check | Result |
|---|---|
| Programme listing (`getProgramsByLevel("COLLEGE")`) | 118 programmes returned ✅ |
| Terms for a programme (`getProgramBySlug`) | 8 terms for the sampled programme ✅ |
| Subjects for a term (`getTermById`) | 5 subjects returned for the sampled term ✅ |
| Exam sessions (direct count via pooled `DATABASE_URL`) | 9 ✅ |
| Subjects (direct count via unpooled `DATABASE_URL_UNPOOLED`) | 7,650 ✅ — **both pooled and unpooled Prisma connections confirmed working** |
| No unrestricted archive query triggered | ✅ by construction — `getProgramsByLevel`/`getProgramBySlug`/`getTermById` only ever query `Program`/`Term`/`Subject` scoped by level/slug/id; Wave 1 never touched `Resource`/`CatalogPaperUpload`/`DriveFileMatch` (the tables Phase 2A flagged), so there's nothing new for `getUnifiedPyqArchive()`-style full-archive queries to scan |

As expected and stated up front: paper/resource pages are **not** expected to show real content yet — `Resource` is intentionally empty this wave (see §9).

---

## 9. Models Intentionally Left Empty

Confirmed 0 rows (§7): `Resource`, `Question`, `ContentBlock`, `SubjectAnalysis`, `SubjectAlias`, `SubjectNotes`, `NoteTheme`, `CatalogPaperUpload`, `CatalogSubjectOverride`, `DriveSubject`, `DriveFileMatch`, `Admin`, `Student`, `StudentExamDate`, `OrangeEvent`, `Feedback`, `FailedUpload`, `ScanRun`, `SubjectMergeSuggestion`, `SubjectMergeLog`, plus `SiteSettings`, `SubjectMatchMemory`, `CourseMatchMemory`, `UploadBatch` (not separately re-verified this phase; unaffected by this wave's writes, consistent with the Phase 2C plan §2's classification).

---

## 10. The 160 Unresolved SessionProgramLink Rows

Not imported, per explicit instruction. All 160 fail for the same documented reason (Phase 2C §7, §4.4): the exam-session source's course names ("B.A. (Programme)", "B.A. (H) Economics") don't exact-slug-match `master-syllabus`'s course names ("B. A Program Sociology", etc.) — two different naming conventions for the same real-world programmes. Full per-row detail (model/naturalKey/source/reason) is in `reports/import-rejections.csv`, regenerated by this phase's final `preview` run. Resolving these needs either a deterministic name-mapping adapter or an explicitly-approved AI-assisted matching pass (Phase 2C §5's boundary) — not attempted this phase.

---

## 11. The 81 Proposed Alias Groups

Not merged, per explicit instruction ("Do not automatically merge probable subject aliases"). All 81 groups (case/punctuation variants of the same paper, e.g. "Research Methodology" / "RESEARCH METHODOLOGY" / "Research methodology") are recorded in `reports/proposed-subject-aliases.csv` for admin review — no `Subject.mergedIntoId`/`parentSubjectId` was touched by this import, and no `SubjectAlias` row was created.

---

## 12. Remaining Data Gaps

Unchanged from Phase 2C's assessment (`docs/PHASE_2C_DATA_IMPORT_PLAN.md` §6, §9): every model in §9 above requires either a genuine Neon export (Class C data — admin-authored content, real user data) or a separate, explicitly-approved future wave (fuzzy-matched SessionProgramLinks, NoteTheme presets, ContentBlock demo rows, etc.). Nothing new was learned about these gaps this phase beyond confirming Wave 1's boundaries hold exactly as planned.

---

## 13. Rollback Procedure

- **Staging only** — production Neon was never connected to this phase; nothing to roll back there.
- **To remove everything this wave wrote:** delete in reverse dependency order (`SessionProgramLink` → `Subject` → `Term` → `Program`; `ExamSession` has no dependents left since no links were created) — or simply drop and recreate the 5 Wave 1 tables' rows via `TRUNCATE ... CASCADE` from `Program` and `ExamSession` downward, since staging currently has no other data depending on them (confirmed by §7's excluded-model zero counts).
- **Simplest full rollback:** the staging database can be deleted/recreated from the Supabase dashboard (as noted in Phase 2B) and `prisma migrate deploy` + `import:apply` re-run from scratch — everything this wave wrote is fully reproducible from the same two committed source files (§1).
- **Partial rollback (undo just this wave, keep the schema):** `DELETE FROM "Subject"; DELETE FROM "Term"; DELETE FROM "Program"; DELETE FROM "ExamSession";` run directly against staging (not via this importer, which has no delete mode by design) — safe only because §7 confirms nothing else references these rows yet.
- **Code rollback:** `git diff` shows the `plan.ts` fix (§4) and the new `apply.ts`/`verify.ts`/`smoke-test.ts` files — reverting the branch to the Phase 2C commit (`e398088`) would restore the Phase-2C-only (preview/validate-only, apply/verify hard-stopped) behavior.

---

## 14. Exact Phase 2E Prerequisites

1. **Decide how to resolve the 160 unresolved SessionProgramLink rows** — deterministic name-mapping adapter (extending `scripts/import/sources/exam-sessions.ts`) vs. an explicitly-approved AI-assisted pass, before those rows can be imported.
2. **Decide on the 81 proposed subject aliases** — admin review of `reports/proposed-subject-aliases.csv`, then either explicit approval to create `SubjectAlias` rows or to leave them as separate Subject rows.
3. **A genuine Neon export** — required before any Class C model (`Resource`, `Question`, `SubjectAnalysis`, `SubjectNotes`, `NoteTheme`, `CatalogPaperUpload`, `CatalogSubjectOverride`, `DriveSubject`, `DriveFileMatch`) can be populated; not attempted through Phase 2D.
4. **Vercel Preview environment scoping** — per `docs/PHASE_2_QUERY_REMEDIATION.md` §12, still pointing Preview at production Neon; switching it to this Supabase staging project is a prerequisite for using staging as a real preview target, and was explicitly not done this phase ("do not configure Vercel Preview").
5. **A decision on Wave 2 scope** — `seed-note-themes.ts`'s 5 presets and `seed-demo-content-blocks.ts`'s demo blocks were flagged in Phase 2C as good next candidates (additive, idempotent, no fuzzy-matching needed).
