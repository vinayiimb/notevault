# Bundled / Excluded SessionProgramLink Rows — Manual Reconstruction Report

**Generated:** 2026-08-07
**Status:** 34 rows explicitly excluded from the 2026-08-07 SessionProgramLink
resolution pass (see `docs/SESSION_PROGRAM_RESOLUTION_APPLIED.md`), plus 1
additional row excluded separately for a same-session target collision
(§4 below). **None of this data was discarded** — every row's original
Drive folder URL is preserved here and in source (commented, not deleted,
for the collision case). This report exists so a future pass can pick up
exactly where this one stopped.

None of these rows are in Supabase staging's `SessionProgramLink` table.
None of this affects production (Neon) in any way.

---

## 1. Missing programme — vague/no catalogue identity (excluded by decision, 4 rows)

Not given a pool Program (unlike GE/DSE — see
`docs/MANUAL_DATA_DECISION_REVIEW.md` §2a) because no real catalogue
identity is backed by source data — these are ambiguous "shared/bundled
concept" labels, not a specific, nameable elective pool.

| Source value | Rows | Sessions |
|---|---:|---|
| ALL COMMON GROUP PROGRAMME | 2 | 2024-25 (Dec-Jan-Feb); 2023-24 (Dec-Feb) |
| All common prog. Group | 1 | 2025 (May-June-July) |
| All common prog. Group (AEC) | 1 | 2025-26 (Dec-Jan) |

**To resolve in future:** determine what DU concept this actually
represents (Programme-students' shared AEC/SEC/VAC credit pool?), decide
whether it deserves its own catalogue Program (same pattern as GE/DSE), or
should be merged into the ALL AEC/SEC/VAC pools directly.

## 2. Missing programme — generic "B.A. (Programme)" bucket (excluded by decision, 9 rows)

| Source value | Rows | Sessions |
|---|---:|---|
| B.A. (Programme) | 9 | 2025-26 (Dec-Jan); 2025 (May-June-July); 2024-25 (Dec-Jan-Feb); 2024 (May-June-July); 2023-24 (Dec-Feb); 2023 (July) — 1st Year; 2023 (May-June) — 2nd & 3rd Year; 2023 (Feb-March) — 1st Year; 2022 (Nov-Dec) |

**To resolve in future:** the real catalogue only models BA Programme
per-major (`ba-prog-economics-as-major`, etc.). Either (a) someone opens
each of these 9 Drive folders and re-splits the papers inside by actual
major, or (b) a decision is made to permanently drop this concept as
out-of-scope for the programme-browse feature.

## 3. Bundled / multiple programmes (excluded by decision, 19 rows)

Source `course` field itself names 2+ real programmes in one Drive folder.
Not splittable without opening each folder and re-deriving which paper
belongs to which real programme.

| Source value | Rows | Sessions |
|---|---:|---|
| B.Sc. Life Sciences+PHY SC. | 8 | 2025 (May-June-July); 2024-25 (Dec-Jan-Feb); 2024 (May-June-July); 2023-24 (Dec-Feb); 2023 (July) — 1st Year; 2023 (May-June) — 2nd & 3rd Year; 2023 (Feb-March) — 1st Year; 2022 (Nov-Dec) |
| B.A. (H) ALL SUBJECTS | 2 | 2023 (Feb-March) — 1st Year; 2022 (Nov-Dec) |
| B.Sc. (H) ALL SUBJECTS | 2 | 2023 (Feb-March) — 1st Year; 2022 (Nov-Dec) |
| B.A/B.Sc. Prog | 1 | 2025-26 (Dec-Jan) |
| B.Sc. (H)+Prog. | 1 | 2024 (May-June-July) |
| B.Sc. Prog Life Sciences+PHY SC. | 1 | 2025-26 (Dec-Jan) |
| B.Sc.Prog. Physical science | 1 | 2024 (May-June-July) |
| B.Sc.Prog. Physical science/B.A. | 1 | 2025 (May-June-July) |
| B.Sc.Prog. Physical science+Life Science | 1 | 2025-26 (Dec-Jan) |
| B.Sc. PHY SC | 1 | 2024-25 (Dec-Jan-Feb) |

**To resolve in future:** open each Drive folder, inspect individual
papers, and manually assign each paper to its real programme. Real
per-file work — no deterministic shortcut exists.

## 4. Malformed rows (excluded by decision, 2 rows — Drive folder labels)

Not recoverable to any real programme — a literal Google Drive folder
label leaked into the source `course` field, not a programme name at all.

| Source value | Rows | Sessions |
|---|---:|---|
| Question papers mix+ Research Methodology | 1 | 2025-26 (Dec-Jan) |
| Question papers mix(All dates folder) | 1 | 2025 (May-June-July) |

**To resolve in future:** manually inspect the Drive folder contents to
determine what programme(s) the papers inside actually belong to.

## 5. Malformed rows — already fixed, listed for completeness (0 rows remaining)

The other 2 original "malformed row" entries — "B.A. (H) Hindi (Note:- all
in one file)" and "B.A. (H) Sanskrit (Note:- all in one file)" — were
**not** excluded. Their source data was corrected instead (the admin-note
annotation was stripped in `prisma/seed-historical-exam-sessions.ts` and
`src/data/exam-sessions-source.ts`), and both rows now import cleanly via
the already-approved "B.A. (H) Hindi" → `ba-hons-hindi` and "B.A. (H)
Sanskrit" → `ba-hons-sanskrit` aliases. Included here only so this report
accounts for all 4 original malformed rows.

## 6. Same-session target collision — excluded separately (1 row)

Not part of the original 160-row rejected-record classification — this
row's `programSlug` ("all-aecc") *did* have an approved alias
(`docs/MANUAL_DATA_DECISION_REVIEW.md` §1a), but applying it would have
collapsed onto the same `(session, Program)` pair as a second, separate
real Drive folder in the same session ("ALL AEC"), which the
`SessionProgramLink` schema's unique constraint
(`@@unique([sessionId, programId, variantLabel])`) does not allow two rows
to share.

| Source value | Session | Drive URL (excluded) | Drive URL (kept instead) |
|---|---|---|---|
| ALL AECC | 2023-24 (Dec-Feb) Question Papers | `https://drive.google.com/drive/folders/1fhNQSZiOHmEc9Bi-QR3nqfU5bjTL0eTS?usp=sharing` | `ALL AEC` → `https://drive.google.com/drive/folders/1IeIe9UxJw4GClM-yl6S8dNYCpvSz1CRs?usp=sharing` |

Neither Drive folder's content was inspected — it is **not assumed** that
these two folders contain identical papers. "ALL AEC" was kept arbitrarily
(not because it was verified more correct); "ALL AECC" was excluded and its
original row preserved as a comment at
`prisma/seed-historical-exam-sessions.ts` (search "Manual data-decision
review... §4c").

**To resolve in future:** open both Drive folders and determine whether
they're duplicates (in which case dropping one was correct and no action
needed) or genuinely different papers for this session (in which case the
`variantLabel` field — currently always `""` for every row in this
importer — would need real values assigned so both can coexist under the
same Program).

---

## Summary

| Category | Rows | Distinct source values |
|---|---:|---:|
| Vague missing-programme bucket | 4 | 3 |
| B.A. (Programme) generic bucket | 9 | 1 |
| Bundled/multiple programmes | 19 | 10 |
| Malformed Drive-folder labels | 2 | 2 |
| Same-session target collision | 1 | 1 |
| **Total still needing manual work** | **35** | **17** |

All 35 rows' original Drive URLs remain retrievable — 34 via
`reports/import-rejections.csv` / `reports/import-resolution/rejected-records-classified.json`
(unchanged source data), 1 via the commented-out line in
`prisma/seed-historical-exam-sessions.ts`. Nothing was permanently deleted.
