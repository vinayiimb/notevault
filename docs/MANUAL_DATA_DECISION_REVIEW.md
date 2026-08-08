# Manual Data Decision Review

> **Status: DECISIONS APPLIED — 2026-08-07.** The recommendations below were
> reviewed and approved/overridden by the operator, then applied to Supabase
> **staging only** (never production). See `docs/SESSION_PROGRAM_RESOLUTION_APPLIED.md`
> for the full applied report — exact counts, what changed, verification
> results, and the one new issue discovered during application (a same-session
> target collision, resolved by excluding one row — not anticipated by this
> document's original analysis). This document is kept as the historical
> record of the *proposed* decisions; where the operator's actual decision
> differed from this document's recommendation, that's noted inline below.

**Purpose:** human-decision prep. Every recommendation below was a suggestion
for the operator to accept, reject, or override per category — see the status
banner above for what was actually decided.

**Scope:** the 160 rejected `SessionProgramLink` rows from the Phase 2D staging
import (`docs/PHASE_2E_REJECTED_RECORD_RESOLUTION.md`), plus the 81 pending
`subject-alias` proposals, plus the 2 flagged programme-duplicate questions.

**What was verified for this document:** every target Program slug referenced
below was checked against the live Supabase **staging** database (read-only —
no writes made), not assumed from the classification files alone. This caught
one real error (§4).

---

## 1. The 112 "programme-name variation" rows — grouped by target

All 112 rows resolve to 21 distinct source spellings, mapping to 14 distinct
real programmes (or 3 university-wide pools). Grouped by proposed target below.
Full machine-readable form: `data/import-mappings/program-aliases.json`.

### 1a. Ready to approve — target confirmed to exist in staging (19 entries, 100 rows)

| Original spelling(s) | → Canonical Program | Rows | Confidence | Recommendation |
|---|---|---:|---:|---|
| "ALL AEC" | University-wide Ability Enhancement Course Pool | 2 | 0.85 | **APPROVE** |
| "ALL AEC/AECC" | same (combines both spellings) | 2 | 0.75 | **APPROVE** |
| "ALL AECC" | same (older AEC-Compulsory naming) | 4 | 0.85 | **APPROVE** |
| "All SEC" | University-wide Skill Enhancement Course Pool | 9 | 0.85 | **APPROVE** |
| "ALL VAC" | University-wide Value Addition Course Pool | 5 | 0.85 | **APPROVE** |
| "ALL VAC (Value added courses)" | same | 2 | 0.85 | **APPROVE** |
| "B.A. (H) Economics" | B.A. (Hons.) Economics | 6 | 0.9 | **APPROVE** |
| "B.A. (H) Hindi" | B.A. (Hons) Hindi | 5 | 0.9 | **APPROVE** |
| "B.A. (H) Political Science" | B.A. (Hons.) Political Science | 6 | 0.9 | **APPROVE** |
| "B.A. (H) Sanskrit" | BA (Hons) Sanskrit | 5 | 0.9 | **APPROVE** |
| "B.A. (H) SKT" | BA (Hons) Sanskrit (SKT = common DU abbreviation) | 1 | 0.85 | **APPROVE** |
| "B.A. (H) Sociology" | B.A (hons) Socialogy *(catalogue's own pre-existing typo — alias intentionally targets the typo'd slug so it resolves)* | 6 | 0.85 | **APPROVE** |
| "B.Com. (H)" | B.Com. (Hons.) | 9 | 0.9 | **APPROVE** |
| "B.Com. (Programme)" | B.Com (P) | 8 | 0.9 | **APPROVE** |
| "B.Sc. (H) Botany" | B.Sc. (Hons.) Botany | 6 | 0.9 | **APPROVE** |
| "B.Sc. (H) Chemistry" | B.Sc (hons) Chemistry | 6 | 0.9 | **APPROVE** |
| "B.Sc. (H) Mathematics" | B.Sc. (Hons.) Mathematics | 6 | 0.9 | **APPROVE** |
| "B.Sc. (H) Physics" | B.Sc. (Hons) Physics | 6 | 0.9 | **APPROVE** |
| "B.Sc. (H) Zoology" | B.Sc. (Hons.) Zoology | 6 | 0.9 | **APPROVE** |

All 17 distinct target slugs above were confirmed to exist in staging with real
Term/Subject data. This is the safe, low-effort bulk-approval batch.

### 1b. Needs a decision before approving (2 entries, 12 rows)

See **§4** below — both investigated against the real database, not left as
open questions. Short version: "B.A. (H) History" → `history-honours` is
**safe to approve as-is**; "B.A. (H) English" → `ba-hons-english` has a
**wrong target slug** and needs a one-word fix (`b-a-hons-english`) before
approval, not a genuine duplicate-programme decision.

---

## 2. The 48 "unresolved" rows — grouped by real category

No 4th category was found beyond the three already identified — every one of
the 48 rows fits missing-programme, bundled-source-data, or malformed-row.

### 2a. Missing programme (25 rows, 6 distinct source values)

**The problem:** the source `course` field names a real DU concept, but no
catalogue `Program` row represents it — either because it's a shared elective
pool (not tied to one department) or a generic bucket the catalogue only
models more specifically.

**Verified against staging:** University-wide pools already exist for AEC,
SEC, and VAC (§1a) — but **no equivalent pool exists for GE or DSE**, and no
"common group" bucket exists either. This is a real asymmetry in the
catalogue, not a classification error.

| Source value | Rows | Example session | What it is |
|---|---:|---|---|
| "B.A. (Programme)" | 9 | 2025-26 (Dec-Jan) | Generic BA Programme bucket — catalogue only has it per-major (`ba-prog-economics-as-major`, etc.) |
| "ALL GE" | 9 | 2025-26 (Dec-Jan) | Generic Elective papers — drawn from other departments, no GE pool Program exists |
| "All DSE" | 3 | 2023-24 (Dec-Feb) | Discipline Specific Elective — belongs to individual departments, no DSE pool Program exists |
| "ALL COMMON GROUP PROGRAMME" | 2 | 2024-25 (Dec-Jan-Feb) | Bundled Programme-students' shared AEC/SEC/VAC papers concept |
| "All common prog. Group" | 1 | 2025 (May-June-July) | Same concept, different spelling |
| "All common prog. Group (AEC)" | 1 | 2025-26 (Dec-Jan) | AEC-specific variant of the same bundled concept |

**Available choices, per concept:**

- **GE / DSE (12 rows):** (a) create dedicated pool Programs the same way
  AEC/SEC/VAC already have them, then alias these rows to the new pools; or
  (b) drop these 12 links permanently — GE/DSE papers arguably belong under
  their *actual* offering department, not a pool, and that department is not
  recoverable from this source data.
- **"B.A. (Programme)" generic bucket (9 rows):** (a) create one umbrella
  `ba-programme` Program as a catch-all, even though the real catalogue
  otherwise models BA Programme per-major; or (b) drop these 9 links — the
  actual major isn't recoverable from the source data as given.
- **"Common group" bundle (4 rows):** (a) create one umbrella Program for
  this bundled AEC/SEC/VAC-for-Programme-students concept; or (b) drop.

**What happens if dropped:** those exam-session papers simply won't appear
under a "browse by programme" path — they'd still exist if directly
searchable some other way, but nothing here builds that other way today, so
in practice a drop means these particular papers become unreachable from the
UI. **What happens if created as new Programs:** the pool/bucket becomes a
real browsable entry, but you're adding catalogue structure that doesn't
mirror how DU actually organizes these credits (they're borrowed from real
departments, not a real "programme").

**Recommendation:** create pool Programs matching the AEC/SEC/VAC precedent
for GE/DSE (12 rows) since that pattern already exists and works; **drop**
the "B.A. (Programme)" and "common group" rows (13 rows) rather than
inventing catalogue structure DU itself doesn't have — but this is a real
product call, not a technical one, and reasonable people could land on
"drop all 25" or "create umbrella Programs for all 25" instead.

### 2b. Bundled / multiple programmes (19 rows, 10 distinct source values)

**The problem:** the source `course` field itself names 2+ real programmes
in one Drive folder label (e.g. a folder shared by two degree tracks).
Splitting these requires knowing which *specific paper* belongs to which
programme — information the source data doesn't carry.

| Source value | Rows | Example session | Programmes conflated |
|---|---:|---|---|
| "B.Sc. Life Sciences+PHY SC." | 8 | 2025 (May-June-July) | Life Sciences + Physical Sciences |
| "B.A. (H) ALL SUBJECTS" | 2 | 2023 (Feb-March) — 1st Year | Every BA Honours department at once |
| "B.Sc. (H) ALL SUBJECTS" | 2 | 2023 (Feb-March) — 1st Year | Every BSc Honours department at once |
| "B.A/B.Sc. Prog" | 1 | 2025-26 (Dec-Jan) | BA Programme + BSc Programme |
| "B.Sc. (H)+Prog." | 1 | 2024 (May-June-July) | BSc Honours + BSc Programme (different degree types) |
| "B.Sc. Prog Life Sciences+PHY SC." | 1 | 2025-26 (Dec-Jan) | Life Sciences + Physical Sciences (Programme variant) |
| "B.Sc.Prog. Physical science" | 1 | 2024 (May-June-July) | Bundle folder; catalogue only has narrower slices (computer-science / electronics / mathematical-sciences) |
| "B.Sc.Prog. Physical science/B.A." | 1 | 2025 (May-June-July) | BSc Programme Physical Science + BA |
| "B.Sc.Prog. Physical science+Life Science" | 1 | 2025-26 (Dec-Jan) | Physical Science + Life Science (Programme variant) |
| "B.Sc. PHY SC" | 1 | 2024-25 (Dec-Jan-Feb) | Abbreviated version of the Physical Science bundle |

**Available choices:**

- (a) **Drop all 19** — cannot be deterministically split without re-deriving
  per-paper programme from the original Drive folder structure, which is
  outside this importer's scope.
- (b) **Manual archival review** — someone opens each Drive folder, looks at
  individual papers inside, and manually assigns each paper to its real
  programme. This is real per-file work, not a code fix.

**What happens if dropped:** these exam-session papers become unreachable
from a "browse by programme" path (same caveat as §2a).
**What happens if manually reviewed:** correct data, but nontrivial manual
effort — the doc doesn't have a paper-level breakdown to start from.

**Recommendation:** drop for now (19 rows is a small fraction of 8,697+
imported rows), flag the underlying Drive folders for a future manual
archival pass if you want that data recovered later. This is reversible —
dropping a `SessionProgramLink` row doesn't touch the underlying `Resource`/
paper record, it only means the paper isn't reachable via this particular
programme-browse path yet.

### 2c. Malformed source rows (4 rows, 4 distinct source values)

**The problem:** not a programme-matching issue at all — a Drive folder
label or an admin annotation leaked into the `course` field at the source
data layer (`prisma/seed-historical-exam-sessions.ts`).

| Source value | Rows | Real issue |
|---|---:|---|
| "B.A. (H) Hindi (Note:- all in one file)" | 1 | Unambiguous programme (`ba-hons-hindi`) + a leaked admin note |
| "B.A. (H) Sanskrit (Note:- all in one file)" | 1 | Unambiguous programme (`ba-hons-sanskrit`) + a leaked admin note |
| "Question papers mix+ Research Methodology" | 1 | Literal Google Drive folder label, not a programme name |
| "Question papers mix(All dates folder)" | 1 | Literal Google Drive folder label, not a programme name |

**Available choices:**

- For the 2 Hindi/Sanskrit rows: (a) fix the source data
  (`prisma/seed-historical-exam-sessions.ts`) to strip the annotation, then
  they'll resolve automatically as ordinary "programme-name variation" rows
  next import run; or (b) drop.
- For the 2 "Question papers mix" rows: no programme is recoverable at all —
  the only choice is drop, or manually research which programme(s) that
  Drive folder actually belongs to.

**Recommendation:** fix source data for the Hindi/Sanskrit pair (cheap,
recovers 2 real rows with zero ambiguity); drop the 2 "Question papers mix"
rows.

---

## 3. Overlap check — do NOT double-count any decision

**Program aliases vs. subject aliases: no overlap.** These are structurally
different mapping types over different source data:

- `program-aliases.json` (41 entries covering all 160 rejected rows) —
  resolves `SessionProgramLink.programSlug` against `Program` rows, sourced
  from `src/data/exam-sessions-source.ts` (Google-Drive-derived exam session
  data).
- `subject-aliases.json` (81 entries) — resolves duplicate/variant `Subject`
  name spellings against each other, sourced from
  `reports/proposed-subject-aliases.csv` (`proposeSubjectAliases()`, run
  over the already-imported `Subject` table).

No `originalValue`, slug, or row from one file appears in the other. They are
two fully independent review batches — reviewing/approving one has no effect
on counts in the other.

**Within `program-aliases.json` itself: sections 1 and 2 above are mutually
exclusive by construction.** All 41 entries in the file are pending exactly
once, tagged with exactly one `sourceIssueCategory`; §1 covers the 19
`pending` + 2 `needs-review` entries (112 rows), §2 covers the 20
`unresolved` entries (48 rows). 19 + 2 + 20 = 41 entries; 112 + 48 = 160 rows.
Nothing is listed twice.

### 3a. Subject aliases (81 pending) — summarized by pattern

All 81 share the same rationale template ("case/punctuation/spacing/hyphen/
apostrophe variant of the same subject name... academically distinct
subjects are excluded by `proposeSubjectAliases()`'s own guards") and the
same confidence (0.8). Grouped by what actually differs between the two
spellings:

| Pattern | Count | Example |
|---|---:|---|
| Case only (e.g. ALL CAPS vs Title Case) | 54 | "LITERARY CRITICISM" / "Literary Criticism" |
| "&" vs "and" | 12 | "Literature & Human Rights" / "Literature and Human Rights" |
| Dash/colon/quote punctuation variant | 9 | "Main Group Clusters – Basics and Applications" / "Main Group Clusters: Basics and Applications" |
| Trailing period / comma placement | 3 | "Introduction to Translation" / "Introduction to Translation." |
| Hyphen vs space | 2 | "Data Mining I" / "Data Mining-I" |
| Extra space inside parentheses | 1 | "...Academic Project/ Translation)" / "...Academic Project/Translation)" |

**Recommendation:** this is a much lower-risk batch than the programme
aliases — every entry is a cosmetic text variant of the *same* subject
(the underlying proposer already excludes Part I/II, Theory/Practical,
DSC/DSE, and different-UPC subjects from ever being proposed). Safe to
**bulk-APPROVE all 81** unless you spot a specific one that looks wrong
skimming the full list in `data/import-mappings/subject-aliases.json`.

---

## 4. Duplicate/canonical programme questions — verified against live staging DB

Both of the "needs-review" entries from §1b were originally flagged from
*static* classification (pattern-matching program names), not from an actual
database query. For this review, I queried the live Supabase staging
database directly (read-only) to check.

### 4a. "B.A. (H) English" → is there really a duplicate?

**Original concern:** the classifier assumed both `ba-hons-english` and
`b-a-hons-english` exist as separate Program rows (a spacing-variant
duplicate).

**What the database actually has:**

| Slug | Exists? | Name | Terms | Subjects |
|---|---|---|---:|---:|
| `ba-hons-english` | **No** — not found | — | — | — |
| `b-a-hons-english` | Yes | "B. A. (Hons) English" | 8 | 97 |
| `b-a-prog-english` (for context — different degree type, not a duplicate) | Yes | "B. A. (Prog) English" | 8 | 34 |

**Finding: there is no duplicate.** `ba-hons-english` doesn't exist anywhere
in the catalogue — the classifier's stated premise was wrong. The alias
entry in `program-aliases.json` currently has
`"targetProgramSlug": "ba-hons-english"`, which is itself a bug: if approved
as-is, it would still fail to resolve (pointing at a nonexistent Program).

**Recommendation:** **APPROVE**, but first correct `targetProgramSlug` from
`ba-hons-english` to `b-a-hons-english` in `data/import-mappings/program-aliases.json`.
Not a duplicate-programme decision — a one-field typo fix.

### 4b. "B.A. (H) History" → is there really a duplicate?

**Original concern:** the classifier flagged that `history-honours` breaks
the `ba-hons-*` naming convention every other Honours programme follows,
and wanted confirmation it's the same programme, not a differently-scoped
entry.

**What the database actually has:**

| Slug | Exists? | Name | Terms | Subjects |
|---|---|---|---:|---:|
| `history-honours` | Yes | "History Honours" | 8 | 80 |
| `ba-prog-history-as-major` (context — different degree type) | Yes | "B.A (Prog.) History as Major" | 8 | 33 |
| `ba-prog-history-as-minor` (context — different degree type) | Yes | "B.A (Prog.) History as Minor" | 8 | 25 |

**Finding: no duplicate exists either.** `history-honours` is the only
History **Honours** row — it just has an inconsistent slug naming pattern
compared to its siblings (cosmetic catalogue debt, not a data-correctness
issue). The alias's target slug is already correct.

**Recommendation:** **APPROVE as-is**, no data fix needed. (Optional,
unrelated cleanup: rename the slug `history-honours` → `ba-hons-history` for
naming consistency — cosmetic only, would need every existing reference to
that Program updated, not part of this decision.)

---

## Summary decision table

| # | Category | Items | Rows affected | Recommendation |
|---|---|---:|---:|---|
| 1a | Programme-name variation, target confirmed | 19 entries | 100 | APPROVE all |
| 1b / 4a | "B.A. (H) English" alias | 1 entry | 6 | APPROVE after fixing target slug typo |
| 1b / 4b | "B.A. (H) History" alias | 1 entry | 6 | APPROVE as-is |
| 2a | Missing programme (GE/DSE/common-group/BA-Programme bucket) | 6 entries | 25 | Needs your product decision — create pools for GE/DSE, drop the rest (suggested) |
| 2b | Bundled/multiple programmes | 10 entries | 19 | Drop (suggested), flag for future manual archival review |
| 2c | Malformed source rows | 4 entries | 4 | Fix source data for 2 (Hindi/Sanskrit), drop the other 2 |
| 3a | Subject aliases (cosmetic variants) | 81 entries | n/a (Subject-level, not row-count) | Bulk APPROVE (suggested) |

**Total once all categories are decided:** up to 160/160 `SessionProgramLink`
rows resolved (112 + 48, depending on which §2 options you pick) and up to
81/81 subject spelling variants merged. Nothing is applied until you flip
`approvalStatus` fields and someone explicitly runs `import:apply` against
staging (never production, per this session's instructions).

---

## Addendum — decisions actually made, and one issue this review didn't anticipate

Every recommendation above was accepted as written by the operator, with the
GE/DSE pools explicitly restricted to only "ALL GE"/"All DSE" (not the vague
common-group/BA-Programme values, per operator's explicit instruction not to
create catalogue structure without real source backing) and the History
Program's slug explicitly left un-renamed (operator's explicit instruction,
matching this doc's own §4b note that a rename would be cosmetic-only).

**One thing this review did not catch:** applying the 112 §1a/§1b rows
surfaced a same-session unique-constraint collision — one exam session
("2023-24 (Dec-Feb) Question Papers") has *two separate* real Drive folders,
"ALL AEC" and "ALL AECC", which both alias to the same target Program. This
review's row-count analysis (done via static classification, not by
simulating the actual insert) didn't surface it. Resolved by excluding the
"ALL AECC" occurrence for that one session only (not the alias globally —
its other 3 occurrences elsewhere still resolved normally). Full detail in
`docs/SESSION_PROGRAM_RESOLUTION_APPLIED.md` §"Issues found during
application" and `reports/import-resolution/bundled-programme-links-manual-reconstruction.md` §6.
