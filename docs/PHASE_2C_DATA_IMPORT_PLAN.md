# Phase 2C — Source-Data Inventory & Controlled Import Pipeline

**Date:** 2026-08-06
**Branch:** `infrastructure/backend-migration`
**Scope:** Audit every source of importable data, build a staging-only controlled importer with preview/validate/apply/verify modes, and run **preview + validate only** against the Supabase staging database provisioned in Phase 2B. **No database writes performed. No R2 uploads. No data imported.** Production Vercel/Neon untouched.

---

## 1. Source-Data Inventory

Full per-file detail was gathered by a dedicated audit pass; summarized here by category. See `git log` for the audit transcript if the raw per-field breakdown is needed later — this section keeps only what's decision-relevant.

### 1.1 Genuinely importable into the current Prisma schema (Wave 1 — implemented this phase)

| Source | Records | Format | Destination |
|---|---|---|---|
| `src/lib/content/master-syllabus-data.ts` (`MASTER_SYLLABUS_ROWS`) | 6,295 rows, 118 unique course names | TS array | `Program`, `Term`, `Subject` |
| `src/data/exam-sessions-source.ts` (extracted from `prisma/seed-historical-exam-sessions.ts`) | 9 sessions, 160 course/link rows | TS array | `ExamSession`, `SessionProgramLink` |

These are the same two structures the live app already treats as canonical: `MASTER_SYLLABUS_ROWS` is literally what `buildFallbackProgram()` (`src/lib/data.ts`) falls back to when the database is unreachable, and the exam-session data is what an admin would otherwise re-enter by hand through `/admin/exam-sessions`.

### 1.2 Explicitly NOT imported this phase, with reasoning

| Source | Records | Why not |
|---|---|---|
| `src/data/ramanujan-pyq-catalog.json` | 2,431 | **Architectural finding:** this file (and the other `src/data/*-drive-catalog.ts` files: `geography-drive-catalog.ts` 80 rows, `political-science-drive-catalog.ts` 122 rows, `du-master-drive-catalog.ts` 62 rows, plus two currently-empty generated ones) are **not meant to be imported into Postgres under the current design**. `src/lib/pyq-catalog.ts`'s `getUnifiedPyqArchive()` deliberately keeps them as static, bundled-at-build data and unions them with database content *at request time* — that's the whole point of the archive-merge architecture documented in Phase 2A. Importing them into `Resource`/`CatalogPaperUpload` would change that architecture, not just port existing data, and is out of scope for "get the schema and its recreatable data onto Supabase." |
| `src/data/archive-official-map.json` | 7,888 | Same reasoning — this is the official-match overlay `applyOfficialFileMap()` layers onto the static catalog at request time, not a database source. |
| `254-pending-files-for-organization.csv` | 227 | Explicitly a **triage queue** — no `fileUrl`, no storage location; these papers haven't been scanned/uploaded anywhere yet. Nothing to import; importing placeholder `Resource` rows with no file would break every download link. |
| `prisma/migration-export.json` | Mixed (21 programs, 126 terms, 644 subjects, 226 resources, 7 students, 9 orangeEvents, 1 admin, etc.) | **Contains real user/production data** (Student, OrangeEvent, Admin rows) — per the explicit instruction not to fabricate or import user records, and per its own risk profile (real admin password hash, real device IDs). Its non-user content (programs/terms/subjects/resources) is also a **snapshot, not a live source** — no way to confirm how stale it is relative to current Neon without connecting to Neon (out of scope, "do not connect Production to Supabase" / no Neon read attempted this phase). Flagged, not used. |
| `scratch/*.json` (5 files: `bcom_all_drive_pdfs.json`, `bcom_drive_files.json`, `index.json`, `split_index.json`, `search-index.json`) | 71–115 each | Intermediate build artifacts consumed by `prisma/build-bcom-catalog.ts`/`extract-zip-pyqs.ts` to *generate* the `src/data/*-drive-catalog.ts` files above — not source data themselves, and downstream of data already excluded per the architectural finding. |
| `src/data/bcom-drive-catalog.ts`, `src/data/extracted-pyq-catalog.ts` | 0 each | Currently empty generated files — nothing to import. |

**Net effect:** the two Wave-1 sources cover 100% of what's both (a) genuinely meant to live in Postgres and (b) actually reconstructible from a file already in the repository, without fabricating anything or reaching into Neon.

---

## 2. Database Dependency Order

Derived directly from every `@relation(fields: ...)` in `prisma/schema.prisma`. Grouped into insertion waves — everything in a wave only depends on earlier waves.

```
Wave 0 (no FK dependencies):
  Program, UploadBatch, ExamSession, Admin, Student, ContentBlock, SiteSettings,
  FailedUpload, ScanRun, SubjectMergeLog, Feedback,
  SubjectMatchMemory, CourseMatchMemory (subjectId/programId are plain strings,
    not enforced Prisma relations — loose references only)
  CatalogPaperUpload, CatalogSubjectOverride (course/subject are plain strings,
    not enforced relations)

Wave 1 (depend on Wave 0):
  Term              → Program
  SessionProgramLink → ExamSession, Program
  DriveSubject       → Program (subjectId nullable, can predate Subject)
  OrangeEvent        → Student

Wave 2 (depend on Wave 1):
  Subject             → Term
  TermPaper           → Term, UploadBatch
  DriveFileMatch       → SessionProgramLink, DriveSubject
  SubjectMergeSuggestion → Term

Wave 3 (depend on Wave 2 — Subject):
  SubjectAlias    → Subject
  SubjectNotes    → Subject
  SubjectAnalysis → Subject
  Resource        → Subject, UploadBatch
  StudentExamDate → Student, Subject (nullable)

Wave 4 (depend on Wave 3):
  NoteTheme → Subject (nullable), SubjectNotes (nullable)

Wave 5 (depend on Wave 3/4):
  Question         → Subject, Resource (nullable)
  NoteThemeVersion → NoteTheme
```

### Classification (A–E, per the exact request)

| Class | Models | Notes |
|---|---|---|
| **A. Recreated from source files this phase** | `Program`, `Term`, `Subject` (from master-syllabus), `ExamSession`, `SessionProgramLink` (from exam-sessions-source) | See §1.1/§4 |
| **B. Should begin empty** | `Admin`, `Student`, `StudentExamDate`, `OrangeEvent`, `Feedback`, `FailedUpload`, `ScanRun`, `SubjectMergeSuggestion`, `SubjectMergeLog`, `SiteSettings` (falls back to code defaults when absent — see `src/lib/data.ts`'s `getSiteSettings`) | Real user/admin/audit data — per instruction, never fabricated. See §6. |
| **C. Available only in the old Neon database** | `SubjectAlias`, `SubjectNotes`, `NoteTheme` (non-preset), `SubjectAnalysis`, `Resource`, `CatalogPaperUpload`, `CatalogSubjectOverride`, `DriveSubject`, `DriveFileMatch`, `Question`, `ContentBlock` (non-demo), `SubjectMatchMemory`/`CourseMatchMemory` (the *learned* set — a handful of entries are re-seedable from `prisma/seed-course-match-memory.ts`, the rest were learned live via admin usage) | Admin-authored or admin-uploaded content with no other source of truth. Needs an actual Neon export (not attempted this phase) to recover — see §12 of `docs/PHASE_2B_SUPABASE_STAGING.md`. |
| **D. Generated/derived at import time** | `UploadBatch` (created per import run when Resource rows are eventually imported — not this wave), slugs, the `_prisma_migrations` bookkeeping table | Not hand-sourced from anywhere; computed. |
| **E. Obsolete / should not be imported** | `scratch/*.json` (superseded intermediate files, per Phase 1's audit finding), `254-pending-files-for-organization.csv` (not ready — no file locations yet), `prisma/migration-export.json` (stale snapshot + real user data) | See §1.2. |

**Note on `NoteTheme` presets and `ContentBlock` demo rows:** `prisma/seed-note-themes.ts` (5 presets) and `prisma/seed-demo-content-blocks.ts` (~10-20 demo blocks) are additive, idempotent, and don't depend on this phase's Wave-1 data — they're good Wave-2 candidates for a future run but weren't built as source adapters this phase to keep scope bounded (see §9).

---

## 3. Existing Import/Seed Script Audit

28 scripts under `prisma/*.ts` were reviewed in full. Complete per-script findings available on request; the decision-relevant summary:

### 3.1 The one finding that shaped this phase's design

**None of the 28 existing scripts have any staging/production guard.** Every one either:
- imports `@/lib/prisma` (follows whatever `DATABASE_URL` is in the shell, with only a localhost fallback if unset — Phase 2A's `src/lib/prisma.ts` warning helps here but doesn't block anything), or
- constructs its own `PrismaClient` after `dotenv.config({ path: ".env.local" })` / `.env` — meaning if someone runs, say, `tsx prisma/seed-historical-exam-sessions.ts` locally with the real Neon `DATABASE_URL` sitting in `.env.local` (which the Phase 1 audit confirmed is the normal local setup), **it connects straight to production with zero warning.**

One partial mitigation exists (`scriptDatabaseUrl()` in `sync-all-drive-links.ts`/`rebuild-drive-subjects.ts`/`fix-leaked-course-booklets.ts`) — but it only caps the connection-pool size to protect Neon's shared pool from being starved; it does not check *which* database it's connecting to at all.

This is exactly the gap `scripts/import/lib/target-guard.ts` (§4) closes for the new importer. It does **not** retrofit the 28 existing scripts — that's listed as a follow-up in §9.

### 3.2 Highest-risk scripts (avoid reusing as-is)

| Script | Risk |
|---|---|
| `prisma/seed.ts` | **Critical.** Unconditional `deleteMany()` across every core table before reseeding demo data — no guard, no confirmation. Never run against anything but a disposable local dev database. |
| `prisma/migrate-to-postgres-blob.ts` | **Critical for reruns.** One-time SQLite→Postgres+Blob migration tool, explicitly documented as not idempotent (`create()` only, no upsert) — a second run fails on primary-key collision, and an interrupted run leaves a half-populated database with some files already uploaded to Blob. |

### 3.3 Well-designed, reusable patterns (referenced, not directly imported, by the new importer)

`seed-du-more-programs.ts`, `sync-all-drive-links.ts`, `seed-course-match-memory.ts`, `import-master-drive-folders.ts` were all rated idempotent with sound upsert/lookup-before-create patterns — good reference implementations for future source adapters (§9), but each still lacks the target-guard, so none were imported/executed directly by this phase's tooling.

---

## 4. The Controlled Importer

New, from scratch, under `scripts/import/` — deliberately outside `prisma/` so it's never confused with the 28 existing ungated scripts.

```
scripts/import/
  lib/
    target-guard.ts   Aborts on missing env, neon.tech, non-Supabase host
                       (unless ALLOW_NON_SUPABASE_HOST=1), or NODE_ENV/
                       VERCEL_ENV=production. Never logs the URLs — only
                       the hostname, matching src/lib/prisma.ts's pattern.
    db-client.ts       Constructs a PrismaClient bound to the target
                       resolved by target-guard.ts — never the ambient
                       @/lib/prisma singleton.
    db-lookup.ts        Bounded, keyed lookups (`where: { slug: { in: [...] } }`,
                       chunked at 500) — no unrestricted findMany() anywhere.
    normalize.ts        Deterministic whitespace/Unicode normalization,
                       slug generation, semester-string parsing (handles
                       "I", "3", "Semester-3", "I/III/V", "I,III,V",
                       "III-VI" ranges, "Pool / not fixed", and the "IIi"
                       typo — case-insensitive roman-numeral matching
                       resolves it same as src/lib/data.ts's
                       getSemesterOrder()). Reuses slugify()/canonicalSubjectKey()
                       from the app itself, not reimplemented.
    validate.ts         Per-field validators: year, semester order,
                       paper type, URL, R2 object key format.
    dedupe.ts           In-memory exact + probable (canonical-key) duplicate
                       detection over a batch; proposeSubjectAliases() for
                       the aliases report.
    report.ts           Writes the four report files (§8).
    types.ts            Shared PlannedRecord/RowOutcome types.
  sources/
    master-syllabus.ts  Wave-1 adapter (§1.1)
    exam-sessions.ts     Wave-1 adapter (§1.1)
  tools/
    extract-exam-sessions.mjs  Regenerates src/data/exam-sessions-source.ts
                               from prisma/seed-historical-exam-sessions.ts's
                               SESSIONS literal via pure text extraction —
                               never imports/executes that script.
  run.ts                 CLI entry point: preview / validate / apply / verify
```

### 4.1 Modes

- **`npm run import:preview`** — read-only: loads sources, validates every row, deduplicates within the batch, resolves foreign keys (against the target DB via bounded lookups + this run's own staged inserts), writes reports. **No writes.**
- **`npm run import:validate`** — identical computation to preview, but exits non-zero if anything is rejected or has an unresolved foreign key (for future CI gating).
- **`npm run import:apply`** — implemented (batched, transactional per model-wave, idempotent via upsert-on-natural-key) but **requires `--confirm` and refuses to run at all in this phase** — `run.ts` hard-stops with an explicit message if `--mode=apply` is passed, regardless of `--confirm`. Built for a future, separately-approved phase.
- **`npm run import:verify`** — post-apply read-only checks (row counts, FK integrity). Same hard-stop as apply — not invoked this phase.

### 4.2 Why `target-guard.ts` is the first thing every mode calls

Matches the pattern established in Phase 2B's manual pre-flight checks, but enforced in code instead of relying on the operator to remember: missing env → clear error telling you to `source .env.supabase-staging.local`; `neon.tech` anywhere in either URL → abort; hostname not ending in `pooler.supabase.com` → abort unless explicitly overridden for a local test DB; `NODE_ENV`/`VERCEL_ENV` = production → abort. **Verified this phase**: running with a fabricated `neon.tech` URL aborts immediately with no connection attempt.

### 4.3 Requirements checklist (Phase 2C item 4)

| Requirement | Status |
|---|---|
| Explicitly require staging target | ✅ `target-guard.ts` |
| Abort on `neon.tech` hostname | ✅ verified this phase |
| Abort on NODE_ENV/VERCEL_ENV=production | ✅ |
| Require `--confirm` for apply | ✅ (and apply is additionally hard-disabled this phase) |
| Never print database URLs/passwords | ✅ only `describeTarget()`'s hostname-only string is ever logged |
| Validate every row before writes | ✅ `validate.ts`, applied per-record before any outcome is "insert" |
| Normalize whitespace/Unicode | ✅ `normalizeWhitespaceAndUnicode()` (NFC + whitespace collapse) |
| Preserve original values | ✅ every `PlannedRecord.original` carries the untouched source strings |
| Deterministic programme/course/subject normalization | ✅ reuses the app's own `slugify()`/`canonicalSubjectKey()` |
| Detect exact duplicates | ✅ `findExactDuplicates()` |
| Detect probable duplicates | ✅ `findProbableDuplicates()` / `proposeSubjectAliases()` |
| Detect subject spelling/capitalization variants | ✅ same mechanism, canonical-key based |
| Deterministic slugs | ✅ `deterministicSlug()` |
| Validate year/semester/paper type/URL/R2 key | ✅ `validate.ts` (R2-key validator implemented; no source this wave references one — see §4.4) |
| Don't upload/delete/rename R2 files | ✅ nothing in this codebase touches storage |
| No AI calls | ✅ verified — see §5 |
| Bounded batches | ✅ `db-lookup.ts` chunks at 500 |
| Transactions where appropriate | Designed into `apply` mode (not exercised — apply didn't run) |
| Avoid one query per row | ✅ all target-DB lookups are batched `in:` queries, not per-row |
| Idempotent reruns | ✅ natural-key-based upsert design (apply mode); preview/validate are pure reads either way |
| Rejected-row and warning reports | ✅ `reports/import-rejections.csv`, `reports/import-warnings.csv` |
| Import batch metadata | Designed (`UploadBatch`-style record) for apply mode — not created since apply didn't run |
| Report inserted/updated/skipped/rejected/unresolved counts | ✅ `reports/import-preview-summary.json`'s `perModel` breakdown |
| No unrestricted `findMany()` for duplicate detection | ✅ duplicate detection is 100% in-memory over the source batch; target-DB checks are keyed `in:` lookups only |

### 4.4 One known limitation, stated plainly

`Term`'s "already exists in target" check (`findExistingTermKeys`/`findExistingSubjectKeys` in `db-lookup.ts`) is keyed by the target database's real `Program.id`, but the source adapters only know a Program's **slug** (since nothing has been inserted yet in preview mode, there are no real ids to key against). Since Phase 2B confirmed staging currently has **zero rows in every table**, this doesn't affect today's numbers (nothing exists to under- or over-count) — but it's wired for correctness on a *future* non-empty staging run, not fully exercised by this preview. Noted here rather than silently glossed over.

---

## 5. AI Normalization Boundary

Per instruction: **the initial import uses deterministic normalization only.**

- `scripts/import/` contains **zero imports of `src/lib/ai.ts`, `groq-sdk`, `@anthropic-ai/sdk`, or any HTTP call to an LLM provider** — confirmed by inspection (every file in `scripts/import/` was authored this phase; none reference those modules) and by the fact that `npm run import:preview` completed in a few seconds with no outbound network calls beyond the Postgres connection.
- Subject-name matching uses `canonicalSubjectKey()` — pure string normalization (case/punctuation/whitespace/roman-numeral folding), the same deterministic function the live app's Subject Normalization admin tool uses for its non-AI "Stage A" pass.
- Uncertain subject-name variants are written to `reports/proposed-subject-aliases.csv` (81 groups found this run) for **admin review** — never auto-merged. No canonical subject is overwritten by this tool (it doesn't touch `Subject.mergedIntoId`/`parentSubjectId` at all).
- Every original source string is preserved verbatim in `PlannedRecord.original` alongside the normalized value.
- If AI-assisted matching is wanted later (e.g. to resolve the 160 unresolved `SessionProgramLink` foreign keys in §7 more cleverly than exact-slug-matching), that's explicitly a **future, separate** phase — not something this tool does automatically.

---

## 6. Authentication / User Data

**None fabricated. None imported.** Per instruction, kept empty:

| Table | Would be missing without a Neon export |
|---|---|
| `Admin` | All real admin login credentials. Staging currently has **zero** admin accounts — nobody can log into `/admin` on staging without a fresh `Admin` row being created deliberately (e.g. via `ADMIN_SEED_EMAIL`/`ADMIN_SEED_PASSWORD`-driven seeding, a separate decision from data import). |
| `Student` | Every device-linked student profile (nickname, streak, "oranges" gamification currency) — Phase 1's audit found 7 in `prisma/migration-export.json`'s snapshot, but that's a stale file, not a live export. |
| `StudentExamDate` | Personal exam-date reminders tied to those Student rows. |
| `OrangeEvent` | The gamification event log (daily-visit/resource-view/exam-kit-session credit history) — 9 in the stale snapshot. |
| `Feedback` | Real user-submitted feedback messages and screenshot references. |

There are **no `Account`/`Session`/`VerificationToken` models in this schema at all** — NoteVault uses a custom JWT/bcrypt admin login (`src/lib/auth.ts`), not NextAuth, so there's no separate OAuth-account or session-table data to worry about recovering; the `Admin` table above is the entire auth surface.

**To recover any of this, a genuine export from the live Neon database is required** — not attempted this phase (`prisma/migration-export.json` is a stale, unverified snapshot, and no Neon connection was made — "do not connect Production to Supabase" was read broadly as "do not connect to Production at all" this phase).

---

## 7. Import Preview Results (real run against Supabase staging)

Ran `npm run import:preview` against the Phase 2B staging database (host `aws-0-ap-south-1.pooler.supabase.com`, currently 0 rows in every table). Full output in `reports/`.

| Model | To create | Already exists | Rejected | Unresolved FK |
|---|---|---|---|---|
| Program | 118 | 0 | 0 | 0 |
| Term | 920 | 0 | 0 | 0 |
| Subject | 7,650 | 0 | 0 | 0 |
| ExamSession | 9 | 0 | 0 | 0 |
| SessionProgramLink | 0 | 0 | 0 | **160** |

- **Source records discovered:** 8,882 (master-syllabus) + 169 (exam-sessions) = 9,051
- **Estimated database writes:** **8,697**
- **Exact duplicate groups (within batch):** 0
- **Probable duplicate / proposed subject-alias groups:** 81 (case/punctuation variants of the same paper — e.g. "16th & 17th Century English Drama" vs "16th and 17th Century English Drama"; never a different-numbered paper conflated with another, since `canonicalSubjectKey()` deliberately keeps roman-numeral-distinct papers separate)
- **Warnings:** 3,032 — almost entirely informational ("multi-semester source row expanded into N terms": 924 of the source's 1,095 multi-semester rows; "elective-pool row, not imported": 194; the remainder are the small tail of un-parseable semester strings)
- **All 160 `SessionProgramLink` rows are unresolved** — the exam-session source's course names ("B.A. (Programme)", "B.A. (H) Economics") don't exact-slug-match `master-syllabus`'s course names ("B. A Program Sociology" etc.) because the two sources use different naming conventions for the same real-world programmes. This is the **documented, correct** behavior of the deterministic-only design (§4.4, §5) — not a bug. The original `seed-historical-exam-sessions.ts` resolved this via a fuzzy matcher (`matchProgramName()`) with hand-resolved special cases; reimplementing that is out of scope for this phase (would blur the line into non-deterministic/AI-adjacent matching).
- **Models that will remain empty:** all 23 listed in `reports/import-preview-summary.json`'s `modelsRemainingEmpty` — matches Class B/C from §2 exactly.

Full row-level detail (every rejected/unresolved record, every warning, every proposed alias group) is in the four report files — see §8.

---

## 8. Output Files

| File | Committed to git? | Contents |
|---|---|---|
| `docs/PHASE_2C_DATA_IMPORT_PLAN.md` | Yes | This document |
| `reports/import-preview-summary.json` | Yes | Aggregate counts (§7) |
| `reports/import-rejections.csv` | Yes | 160 rows — every rejected/unresolved record, model/key/source/reason |
| `reports/import-warnings.csv` | Yes | 3,032 rows — informational warnings (multi-semester expansions, pool rows) |
| `reports/proposed-subject-aliases.csv` | Yes | 81 rows — canonical key + variant subject-name spellings for admin review |

**Sensitivity check:** every value in these four files traces back to `MASTER_SYLLABUS_ROWS` and the exam-session Drive-folder list — both public DU curriculum/exam-archive data already committed elsewhere in this repo (`src/lib/content/master-syllabus-data.ts`, `src/data/exam-sessions-source.ts`). No user data, no credentials, no connection strings, nothing from the excluded Neon-only sources (§1.2) appears anywhere in these reports. Safe to commit as-is — added to git, not gitignored.

---

## 9. Follow-ups Explicitly Out of Scope This Phase

1. **Fuzzy program-name matching** to resolve the 160 unresolved `SessionProgramLink` rows (§7) — would need either a reimplementation of `matchProgramName()`'s logic as a new deterministic adapter step, or an explicitly-approved AI-assisted matching pass per §5's boundary.
2. **Retrofitting `target-guard.ts` onto the 28 existing `prisma/*.ts` scripts** (§3.1) — every one of them can still accidentally target production today; this phase only guarantees the *new* importer is safe.
3. **Wave 2 source adapters**: `seed-note-themes.ts`'s 5 presets, `seed-demo-content-blocks.ts`'s demo blocks, `seed-course-match-memory.ts`'s ~13 curated mappings — all additive/idempotent/low-risk per §3.3, straightforward to port into new source adapters using the same framework.
4. **A genuine Neon export** to recover Class C data (§2) — required before any of `SubjectAlias`, `Resource`, `Question`, etc. can be populated on staging; not attempted this phase.
5. **Actually running `import:apply`** — requires your separate, explicit approval per the standing instruction ("stop after generating and reviewing the import preview unless I separately approve database writes").

---

## 10. Completion Summary

See the end-of-turn message for `git status`/`git diff --stat` output and the final READY/NOT READY conclusion.
