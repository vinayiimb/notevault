# SessionProgramLink Resolution — Applied

**Date:** 2026-08-07
**Branch:** `infrastructure/backend-migration`
**Target:** Supabase **staging** only (`aws-0-ap-south-1.pooler.supabase.com`,
verified via `target-guard.ts`'s hostname check before every command below —
refuses to run against any `neon.tech` host). **Production (Neon/Vercel) was
never touched** — no Vercel Production env vars, no DNS, no Neon writes, no
production cutover, no Resource/paper import.

This applies the decisions reviewed and approved in
`docs/MANUAL_DATA_DECISION_REVIEW.md`.

---

## 1. Newly approved programme aliases (23 entries, 124 rows originally +
2 rows recovered via source-data fix = 126 rows resolvable)

- **19 entries / 100 rows** — confirmed-real targets, approved as-is
  (`docs/MANUAL_DATA_DECISION_REVIEW.md` §1a).
- **"B.A. (H) English" (6 rows)** — target slug corrected from the
  nonexistent `ba-hons-english` to the real `b-a-hons-english` ("B. A.
  (Hons) English", 8 terms, 97 subjects, live-verified), then approved.
- **"B.A. (H) History" (6 rows)** — approved as-is; `history-honours`
  live-verified as the sole real History Honours Program (8 terms, 80
  subjects); slug intentionally **not** renamed (operator's explicit
  instruction — cosmetic-only change, out of scope for this pass).
- **"ALL GE" (9 rows)** and **"All DSE" (3 rows)** — mapped to the two
  newly created pool Programs (§3 below), approved.

All approvals carry `approvedBy`/`decidedAt` metadata in
`data/import-mappings/program-aliases.json`; original `sourceProgramSlug`/
`originalValue` values were never altered — only `targetProgramSlug`,
`approvalStatus`, and `rationale` changed where a decision required it.

## 2. Newly approved subject aliases (81 entries)

All 81 pending `subject-alias` entries in
`data/import-mappings/subject-aliases.json` approved — every one manually
re-verified as a cosmetic variant (54 case-only, 12 "&"-vs-"and", 9
dash/colon/quote punctuation, 3 trailing punctuation, 2 hyphen-vs-space, 1
extra whitespace) per `docs/MANUAL_DATA_DECISION_REVIEW.md` §3a, not blindly
trusted from the original proposer output. **No Subject-table merge was
executed** — this file remains a proposal record; approving it here is
documentation only, since no merge/apply tooling for `Subject` rows was run
as part of this pass (out of scope — not requested).

Confirmed **zero overlap** with programme aliases (different mapping types,
different source data) and **zero Subject-table changes**: `Subject` count
unchanged at 7,650 before and after this entire pass.

## 3. GE/DSE pool Programs created (2)

Created directly in Supabase staging (not part of any source file — a
catalogue-only addition, matching the pre-existing AEC/SEC/VAC pool
pattern):

| Slug | Name | Level | Summary |
|---|---|---|---|
| `university-wide-generic-elective-course-pool` | University-wide Generic Elective Course Pool | COLLEGE | Catalogue/exam-session pool, not a real degree programme — documents its purpose in the `summary` field (no schema field exists for this distinction; matches the pre-existing 3 pools, which also have no such field) |
| `university-wide-discipline-specific-elective-course-pool` | University-wide Discipline Specific Elective Course Pool | COLLEGE | Same pattern, for DSE |

No collision with any real degree programme slug (verified — 0 pre-existing
GE/DSE-named Programs). Only "ALL GE" and "All DSE" were mapped to these —
the vague "common group"/"BA Programme" bucket values were explicitly **not**
given a pool, per the operator's instruction not to invent catalogue
structure without real source backing (they remain excluded — see
`reports/import-resolution/bundled-programme-links-manual-reconstruction.md`
§§1–2).

## 4. Malformed rows repaired (2)

Source data corrected in `prisma/seed-historical-exam-sessions.ts` (true
source) and regenerated into `src/data/exam-sessions-source.ts` (extracted
copy, via `node scripts/import/tools/extract-exam-sessions.mjs`):

| Before | After |
|---|---|
| `B.A. (H) Hindi (Note:- all in one file)` | `B.A. (H) Hindi` |
| `B.A. (H) Sanskrit (Note:- all in one file)` | `B.A. (H) Sanskrit` |

Both now resolve automatically via the already-approved "B.A. (H) Hindi" →
`ba-hons-hindi` and "B.A. (H) Sanskrit" → `ba-hons-sanskrit` aliases (§1) —
confirmed via `slugify()` producing an exact match, and confirmed in the
final rejection list (these 2 source values no longer appear as rejected).
The original admin note was about the Drive folder's file layout, not the
programme identity — documented in a code comment at the edit site, not
discarded.

The other 2 "malformed row" entries ("Question papers mix+ Research
Methodology", "Question papers mix(All dates folder)") are **not**
repairable — no real programme is recoverable from a literal Drive folder
label. Left excluded (§6 below).

## 5. Issues found during application (not anticipated by the review doc)

**Three real bugs surfaced only when actually running the importer** — the
review doc's row-count analysis was based on static classification, not a
simulated apply, and didn't catch these:

1. **Planner couldn't see the new pool Programs.** `scripts/import/lib/plan.ts`
   only checked alias targets against Program slugs the *source data itself*
   declares (master-syllabus + exam-sessions) — the GE/DSE pools, created
   directly in the DB with no master-syllabus rows, were invisible to that
   check, so `import:preview` still reported them `unresolved_fk` even after
   approval. **Fixed**: `candidateProgramSlugs` now also includes every
   approved alias's target slug, so the existence check covers catalogue-only
   Programs too. One bounded, keyed `findExistingProgramSlugs` call — no
   unrestricted scans, consistent with `db-lookup.ts`'s existing rule.
2. **Same bug, second location, at apply-time.** `scripts/import/lib/apply.ts`'s
   `programIdBySlug` map had the identical gap — built only from
   source-declared `Program` outcomes. Would have thrown
   `"Apply-time invariant violation: missing parent for SessionProgramLink"`
   for every GE/DSE row. **Fixed**: after building the map, one extra bounded
   query fills in ids for any `SessionProgramLink` insert's `programSlug` not
   already covered.
3. **Real data collision, not a tool bug.** One exam session ("2023-24
   (Dec-Feb) Question Papers") has *two separate* real Drive folders — "ALL
   AEC" and "ALL AECC" — both approved to alias onto the same target Program.
   Applying both would violate `SessionProgramLink`'s
   `@@unique([sessionId, programId, variantLabel])` constraint (every row's
   `variantLabel` is hardcoded `""` by the source adapter — no existing
   mechanism to disambiguate). **Not assumed to be duplicate content** (Drive
   folders weren't opened/compared) — "ALL AEC" kept, "ALL AECC" excluded for
   this one session only (its other 3 occurrences elsewhere resolved
   normally); original row preserved as a comment in
   `prisma/seed-historical-exam-sessions.ts`, full detail in
   `reports/import-resolution/bundled-programme-links-manual-reconstruction.md`
   §6.

This surfaced an important gap in the importer's own design (Checkpoint D's
promise — "once an operator approves an alias... no code change required" —
didn't hold for catalogue-only alias targets); the fix is general (works for
any future catalogue-only Program, not special-cased to GE/DSE) and was
applied to the shared `plan.ts`/`apply.ts` used identically by
preview/validate/apply modes, so all three modes now agree.

## 6. SessionProgramLink rows inserted

**75** on the (second, successful) `import:apply --confirm` run.

Context: a first `import:apply` attempt (before the collision above was
found) partially succeeded — its first 50-row chunk committed before hitting
the collision on the 51st row and rolling back that chunk (each 50-row batch
is its own transaction, per `apply.ts`'s existing design — this is expected,
safe chunking behavior, not corruption). After fixing the collision and the
two planner bugs, the corrected apply run correctly recognized those 50 as
already-existing (`skippedExisting`) and inserted the remaining 75 — for
**125 total** `SessionProgramLink` rows in staging.

```
Apply complete. Total inserted: 75
  Program: inserted=0 skippedExisting=118 rejected=0 unresolvedFk=0
  Term: inserted=0 skippedExisting=920 rejected=0 unresolvedFk=0
  Subject: inserted=0 skippedExisting=7650 rejected=0 unresolvedFk=0
  ExamSession: inserted=0 skippedExisting=9 rejected=0 unresolvedFk=0
  SessionProgramLink: inserted=75 skippedExisting=50 rejected=0 unresolvedFk=34
```

## 7. Rows still unresolved (34, deliberately excluded)

| Category | Rows | Detail |
|---|---:|---|
| Vague missing-programme bucket | 4 | `reports/.../bundled-programme-links-manual-reconstruction.md` §1 |
| "B.A. (Programme)" generic bucket | 9 | §2 |
| Bundled/multiple programmes | 19 | §3 |
| Malformed Drive-folder labels | 2 | §4 |

Plus **1 additional row** (the "ALL AECC" / 2023-24 session collision, §5
above) excluded for a different reason (target collision, not
missing/bundled/malformed) — bringing the true total of rows needing future
manual work to **35**, all catalogued in
`reports/import-resolution/bundled-programme-links-manual-reconstruction.md`.
Every one of these rows' `approvalStatus` is `"excluded"` (program-aliases.json)
or preserved as a source comment (the collision row) — none silently dropped,
none guessed at.

## 8. Second-run idempotency result

```
Apply complete. Total inserted: 0
  Program: inserted=0 skippedExisting=118 rejected=0 unresolvedFk=0
  Term: inserted=0 skippedExisting=920 rejected=0 unresolvedFk=0
  Subject: inserted=0 skippedExisting=7650 rejected=0 unresolvedFk=0
  ExamSession: inserted=0 skippedExisting=9 rejected=0 unresolvedFk=0
  SessionProgramLink: inserted=0 skippedExisting=125 rejected=0 unresolvedFk=34
```

**0 new inserts**, all 125 correctly recognized as already existing, all 34
still correctly excluded/unresolved. Idempotency confirmed.

## 9. Verification results

`import:verify` + direct staging queries:

| Check | Result |
|---|---|
| Orphan Terms/Subjects/SessionProgramLinks | 0 / 0 / 0 |
| Duplicate Program slugs / Term keys / Subject keys / ExamSession labels / SessionProgramLink keys | 0 / 0 / 0 / 0 / 0 |
| Program row count | 120 (118 pre-existing + 2 new pools) — 120 distinct slugs = 120 rows, no accidental merges |
| Term count | 920 (unchanged) |
| Subject count | 7,650 (unchanged — no subject collisions, no merges executed) |
| SessionProgramLink count | 125 |
| GE pool Program referenced by | exactly 9 links, all from "ALL GE" source rows, nothing else |
| DSE pool Program referenced by | exactly 3 links, all from "All DSE" source rows, nothing else |
| Excluded rows remain unresolved | Yes — all 34 (+1 collision row) confirmed still `unresolved_fk` on the final preview |

`import:verify`'s `ok: false` result is **unrelated to this work** — it
flags 1 pre-existing row each in `Admin`/`Student`/`OrangeEvent` (leftover
from earlier, unrelated staging smoke-testing, not touched or created by
this pass).

## 10. Final staging row counts

| Model | Count |
|---|---:|
| Program | 120 |
| Term | 920 |
| Subject | 7,650 |
| ExamSession | 9 |
| SessionProgramLink | 125 |
| Resource / Question / all other catalogue-adjacent models | 0 (out of scope — not imported in this pass, per instruction) |

---

## Files changed this pass

- `data/import-mappings/program-aliases.json` — 23 entries approved, 18 excluded, all with rationale + approvedBy/decidedAt
- `data/import-mappings/subject-aliases.json` — 81 entries approved
- `prisma/seed-historical-exam-sessions.ts` — 2 rows' annotation stripped (Hindi/Sanskrit), 1 row commented out (AECC collision)
- `src/data/exam-sessions-source.ts` — regenerated from the above via its own extraction tool (no manual edits)
- `scripts/import/lib/plan.ts` — bug fix: alias-target Program existence check now covers catalogue-only Programs
- `scripts/import/lib/apply.ts` — matching bug fix at apply-time
- `docs/MANUAL_DATA_DECISION_REVIEW.md` — marked applied, addendum added
- `docs/SESSION_PROGRAM_RESOLUTION_APPLIED.md` — this file (new)
- `reports/import-resolution/bundled-programme-links-manual-reconstruction.md` — new

**Database changes:** Supabase staging only — 2 Program rows created, 75
SessionProgramLink rows inserted (125 total after counting the earlier
partial-apply's 50). **Zero** production (Neon) writes, **zero** Vercel
Production/DNS changes, **zero** Resource/paper imports.
