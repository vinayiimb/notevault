# Phase 2E — Rejected Record Resolution

Classifies all 160 records rejected by the Phase 2D staging import (see
`docs/PHASE_2D_WAVE1_STAGING_IMPORT.md`). Every rejected record is a
`SessionProgramLink` row — the only model with rejections in this wave —
whose source `course` field (from `src/data/exam-sessions-source.ts`) did
not exactly match any Program slug after `deterministicSlug()` normalization.

`scripts/import/sources/exam-sessions.ts` is deliberately exact-match-only
(see its header comment): it never fuzzy-guesses a Program, so anything that
doesn't match becomes an `unresolved_fk` rejection rather than a silent
wrong link. This phase turns those rejections into reviewed, versioned
proposals — it does not apply anything.

## Method

1. Loaded `EXAM_SESSIONS_SOURCE` and re-derived each row's `programSlug` the
   same way the importer does (`deterministicSlug(normalizeWhitespaceAndUnicode(row.course))`).
2. Diffed the resulting slug set against the 118 real Program slugs derived
   from `MASTER_SYLLABUS_ROWS` (`src/lib/content/master-syllabus-data.ts`) —
   41 distinct missing slugs account for all 160 rejected rows.
3. Hand-reviewed each of the 41 missing slugs against the real catalogue
   (`scripts/import/tools/classify-rejections.ts` holds the reviewed map)
   and assigned a category, a proposed target (if any), a confidence score,
   and whether it's safe to even *propose* as a pending alias.
4. Ran the classifier against the live rejection set and confirmed an exact
   1:1 match against `reports/import-rejections.csv` — same 160
   `sourceRowRef` values, nothing invented, nothing dropped.

Regenerate with:

```
npx tsx scripts/import/tools/classify-rejections.ts
```

Output:
- `reports/import-resolution/rejected-records-classified.json`
- `reports/import-resolution/rejected-records-classified.csv`

## Category totals (sum to exactly 160)

| Category | Count | Auto-safe to propose | Meaning |
| --- | ---: | :---: | --- |
| programme-name variation | 112 | mostly yes (2 held back) | Abbreviation/spelling difference from a single real Program (e.g. "B.Com. (H)" → `bcom-hons`) |
| missing programme | 25 | no | No Program row exists or should be auto-created — DU pool concepts (GE, DSE, "common group") that aren't modeled as a catalogue Program, or a generic bucket ("B.A. (Programme)") the real catalogue only models per-major |
| invalid source data | 19 | no | The source `course` field itself conflates 2+ real programmes (e.g. "B.Sc. Life Sciences+PHY SC.") — not splittable without the original per-paper metadata |
| malformed row | 4 | no | The `course` field contains a Drive folder label or admin note, not a programme name |

## Important: nothing here is applied automatically

Per the global rule against auto-merging programmes, **every** proposal
below — including the 110 "high confidence" abbreviation matches — is
written to `data/import-mappings/program-aliases.json` (Checkpoint C) with
`approvalStatus: "pending"`. None are auto-approved. `automaticResolutionSafe`
in the classification report means "safe to *propose* for one-click human
approval," not "safe to write as canonical without review."

Two "programme-name variation" rows are held back even from that fast-track:

- **`ba-h-english`** (6 rows) — the catalogue has two near-duplicate
  Programs for English Honours (`ba-hons-english` and `b-a-hons-english`,
  different slugs from a spacing variant of the same course name during the
  original master-syllabus import). Proposing an alias here would paper
  over a duplicate-Program data-quality issue instead of surfacing it.
- **`ba-h-history`** (6 rows) — the plausible target (`history-honours`)
  breaks the `ba-hons-*` naming convention every other Honours programme
  follows. Worth confirming it's the same programme, not a differently-
  scoped catalogue entry, before proposing.

## missing programme (25 rows) — needs a data-modeling decision, not an alias

| Slug | Rows | Note |
| --- | ---: | --- |
| `ba-programme` | 9 | Real catalogue only has BA Programme per-major (`ba-prog-economics-as-major`, etc.), no generic bucket |
| `all-ge` | 9 | Generic Elective papers aren't modeled as their own Program |
| `all-dse` | 3 | Discipline Specific Elective papers belong to individual departments |
| `all-common-group-programme` | 2 | Bundled "Programme students' shared AEC/SEC/VAC" concept, no Program row |
| `all-common-prog-group` | 1 | Same concept, different source spelling |
| `all-common-prog-group-aec` | 1 | AEC-specific variant of the same bundled concept |

These need a product decision (create umbrella Programs? split by known
major elsewhere in the data? drop permanently?) before any resolution is
possible — see "Open questions" below.

## invalid source data (19 rows) — bundle folders spanning multiple programmes

`bsc-life-sciencesphy-sc` (8), `bsc-prog-life-sciencesphy-sc` (1),
`bscprog-physical-sciencelife-science` (1), `bscprog-physical-scienceba` (1),
`babsc-prog` (1), `bsc-hprog` (1), `bscprog-physical-science` (1),
`bsc-phy-sc` (1), `ba-h-all-subjects` (2), `bsc-h-all-subjects` (2).

Each of these Drive folder names bundles two or more real programmes (e.g.
"B.A/B.Sc. Prog", "B.Sc. (H) ALL SUBJECTS"). Resolving these requires
re-deriving which papers inside the folder belong to which real programme —
out of scope for a deterministic importer; flagged for manual archival
review, not blocked on further import work.

## malformed row (4 rows) — source cleanup, not a mapping

`question-papers-mix-research-methodology` (1) and
`question-papers-mixall-dates-folder` (1) are literal Google Drive folder
labels that leaked into the `course` field in
`prisma/seed-historical-exam-sessions.ts`'s original source data.
`ba-h-hindi-note-all-in-one-file` (1) and `ba-h-sanskrit-note-all-in-one-file`
(1) are otherwise-unambiguous rows (Hindi / Sanskrit Honours) with an admin
annotation ("Note:- all in one file") appended to the course name — the
underlying programme is clear, but the fix belongs in the source data, not
as an alias, since `deterministicSlug()` will never match the annotated text.

## Open questions for the operator (do not auto-resolve)

1. Should `ba-programme`'s 9 links be dropped permanently, or does the
   underlying Drive data actually separate by major and this is a source-
   extraction gap worth fixing upstream?
2. Should DU pool concepts (GE, DSE) get their own catalogue Program rows,
   or do these links get dropped as out-of-scope for a subject-catalogue
   model?
3. For the 19 "invalid source data" bundle rows: is per-paper programme
   metadata recoverable from the original Drive folder structure, or should
   these links be dropped?
4. `ba-h-english` / `b-a-hons-english` duplicate Program: which one is
   canonical, and should the other be merged/removed from the catalogue
   entirely (a Program-level dedup, out of scope for this import wave)?

None of these are resolved in Checkpoint C — they stay `unresolved` in
`data/import-mappings/program-aliases.json` pending an explicit answer.

## Checkpoint D — SessionProgramLink planner fix and dry-run

**Composite unique constraint**: already present —
`prisma/schema.prisma`'s `SessionProgramLink` model has
`@@unique([sessionId, programId, variantLabel])`. Verified, no schema
change needed.

**Root cause of every unresolved link**: none are caused by the id-vs-slug
lookup bug fixed in Checkpoint A (that bug is confirmed fixed — see
`reports/import-verify-report.json`'s `duplicateSessionLinkKeys: 0` and
`orphanSessionLinks: 0` from a live run against Supabase staging). All 160
are caused by a missing/ambiguous/invalid Program reference in the source
data itself, classified above.

**Planner fix, not one-off rows**: `scripts/import/lib/plan.ts`'s
SessionProgramLink resolution now consults
`data/import-mappings/program-aliases.json` via
`scripts/import/lib/alias-loader.ts::loadApprovedProgramAliases()` before
giving up on an unmatched `programSlug`. Only entries with
`approvalStatus: "approved"` are ever consulted — today that's zero, so
behavior is unchanged (160 still unresolved), but once an operator flips an
entry to `"approved"`, the corresponding links become deterministic inserts
on the next `import:preview`/`import:apply` run with no code change and no
manually-inserted database row.

**Dry-run**: `npm run import:preview` (and `import:validate` for CI-style
gating) already *is* the dry-run this checkpoint asks for — it now reports
alias-aware SessionProgramLink outcomes without writing anything. Verified
live against Supabase staging on 2026-08-06:

```
Sources loaded: master-syllabus (8882 records), exam-sessions (169 records)
Estimated database writes: 0
Rejected: 160  Warnings: 3032  Proposed alias groups: 81
```

Then re-ran `import:apply --confirm` (idempotency reconfirmation on the
Checkpoint A-fixed code) and `import:verify` against the same staging
database — see `docs/PHASE_2D_WAVE1_STAGING_IMPORT.md`'s companion numbers
and Checkpoint A/E summaries in
`docs/COMBINED_MIGRATION_WAVE_2_REPORT.md` for the full per-model dry-run
breakdown (links to insert / already existing / rejected / unresolved).
