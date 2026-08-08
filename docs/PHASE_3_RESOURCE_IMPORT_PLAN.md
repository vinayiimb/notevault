# Phase 3 — Real Paper/Resource Data Migration to Supabase Staging

> **Status: APPLIED — 2026-08-08.** This document is the original
> preview/plan (kept as-written below for the record). The actual import
> ran after this was written — see `docs/PHASE_3_RESOURCE_IMPORT_APPLIED.md`
> for final counts (39/226 imported, 17.3% — below the 85% target, reported
> honestly with full reasoning) and `docs/PHASE_3_RESOURCE_BACKLOG.md` for
> every non-imported candidate. The matching hierarchy described as future
> work in §6 below (subject resolution, storage upload) was subsequently
> implemented in full, including a conservative fuzzy-matching tier.

**Date:** 2026-08-08
**Branch:** `infrastructure/backend-migration`
**Scope (as originally written):** Preview/plan only. **No Resource rows were written anywhere** at the time this document was authored — see the status banner above for what happened next.
Target for all read/write operations described here is Supabase **staging**
only. Production (Neon), Vercel Production env vars, DNS, and live R2
objects were never touched — every DB command ran through
`target-guard.ts`, which refuses to run against any `neon.tech` host or a
production `NODE_ENV`/`VERCEL_ENV`.

---

## STEP 1 — Content models

### Which models power which public routes

| Route | Models used |
|---|---|
| `/pyq-notes` (Full Archive) | `CatalogPaperUpload` (DB) + `Resource` type=PYQ w/ ocrText (DB, via `getPyqArchiveIndex`) + `DriveFileMatch`/`DriveSubject` (DB, via `getFullDriveArchiveIndex`) + **5 static, non-DB catalogs** (`ramanujan-pyq-catalog.json`, `geography-drive-catalog.ts`, `political-science-drive-catalog.ts`, `du-master-drive-catalog.ts`, `extracted-pyq-catalog.ts`, `bcom-drive-catalog.ts`) |
| Subject pages (`/subjects/[id]`) | `Subject`, `Resource[]`, `Question[]`, `SubjectAnalysis`, `SubjectNotes`, `DriveSubject.files` (`DriveFileMatch`) |
| Paper page (`/pyq-notes/[id]`) | `Resource` (type=PYQ, via `getPyqResourceById`), nested `Subject`→`Term`→`Program`, `SubjectAnalysis`, `Question[]` |
| Notes pages (`/notes`) | `Program`/`Term` only (navigation hub) — actual notes content lives on subject pages via `Resource` (type=NOTES) and `SubjectNotes` |
| Exam-session pages | `ExamSession`, `SessionProgramLink`, `DriveFileMatch`, `DriveSubject` |
| `/api/download/[resourceId]` | `Resource.fileUrl` only |
| `/api/catalog-combined-pdf` | `getUnifiedPyqArchive()` — same union as `/pyq-notes` |
| `/api/search-suggestions` | `Subject` (name/alias index) only — **not** Resource content search |
| `/api/subjects/[id]/download-all` | `Subject` + `Resource[]` |
| Dashboard paper/resource views | `Resource` (type=PYQ/NOTES, `getRecentResources`/`getResourceHighlights`) |

### Per-model report

| Model | Purpose | Fields public routes need | FKs | In source files? | Neon-only? | Storage reference? | Required before cutover? |
|---|---|---|---|---|---|---|---|
| **Resource** | The actual uploaded PYQ/Notes PDF + OCR metadata — central content model | `subjectId`, `type`, `title`, `year`, `fileUrl`, `fileName`, `fileSize`, `fileHash`, `ocrText`/`ocrTextHash`, `downloads` | `subjectId → Subject` | Yes — `prisma/migration-export.json` (226 rows) | Partially — this export is a local/dev snapshot, not confirmed to match current live Neon exactly | `fileUrl` (string, no dedicated key column) | **Yes** — this is what subject pages, paper pages, downloads, and dashboard highlights all render |
| **CatalogPaperUpload** | Admin-uploaded PDFs added from the "catalog coverage" screen, folded into `/pyq-notes`'s union | `course`, `subject`, `yearRange`, `semesterGroup`, `fileUrl`, `fileName`, `fileHash` | none (flat) | Not found in any inspected source file | Likely Neon-only | `fileUrl` | Nice-to-have, not blocking (small supplemental slice of `/pyq-notes`) |
| **DriveSubject** | Subject derived from Drive filenames, scoped to a Program | `programId`, `name`, `slug` | `programId → Program`, optional `subjectId → Subject` | Partially — `scratch/bcom_drive_files.json` (58 rows, B.Com only) | Mostly Neon-only | n/a (no file itself) | Needed for `DriveFileMatch` to mean anything |
| **DriveFileMatch** | One PDF found inside a Drive folder — per the code's own comment, **"the actual bulk of Full Archive content now"** | `linkId`, `driveSubjectId`, `driveFileId`, `fileName`, `webViewLink` | `linkId → SessionProgramLink`, optional `driveSubjectId → DriveSubject` | Partially — `scratch/bcom_drive_files.json`/`bcom_all_drive_pdfs.json` (B.Com only, 58+115 rows); the rest would need a live Google Drive API sync (`prisma/sync-all-drive-links.ts`), not a static file | Yes, mostly — this table is 0 rows in staging today and is the single largest content gap | `webViewLink` (external Google Drive URL — no R2 involved) | **Yes, arguably the highest-impact model** — but out of this wave's scope (requires live Drive API calls, not local source files; flagged for a future wave) |
| **Question** | Individual PYQ questions (most-repeated feature) | `subjectId`, `resourceId`, `questionText`, `answerText` | `subjectId → Subject`, optional `resourceId → Resource` | Not found (0 in migration-export.json) | Neon-only | n/a | No — enhancement, not blocking |
| **ContentBlock** | Reusable admin content-block library | `label`, `block` (Json) | none | Not found | Neon-only | n/a | No — admin authoring tool only |
| **SubjectAnalysis** | Cached AI-compiled subject summary | `subjectId`, `compiledNotes`, etc. | `subjectId → Subject` | 3 rows in migration-export.json | Neon-only | n/a | No — regeneratable on demand, not blocking |
| **NoteTheme** | Structured-notes design system | `subjectId`/scope, `draftJson` | optional `subjectId → Subject` | Not found | Neon-only | n/a | No |
| **SubjectNotes** | Admin-authored compiled notes (markdown/structured) | `subjectId`, `content` | `subjectId → Subject` | Not found | Neon-only | n/a | No — enhancement |
| **Admin** | Login credentials | — | — | 1 row in migration-export.json (**not imported — see boundary below**) | Neon-only | n/a | Only for admin-panel access, not the public site |

### Dependency order for content import

```
Program/Term/Subject (already done, Phase 2)
        │
        ▼
   Resource  ◄── this wave's target
        │
        ▼
  Question (optional, references Resource)
        │
        ▼
SubjectAnalysis / SubjectNotes / NoteTheme (optional, independent of Resource)

DriveSubject ──► DriveFileMatch  (separate track — needs SessionProgramLink,
                                   already imported in Phase 2, plus either
                                   local Drive-listing JSON for B.Com or a
                                   live Drive API sync for everything else)
```

---

## STEP 2 — Source inventory for real papers

| Source | Records | IDs | Programme/term/subject info | Year/type/session | PDF reference | Quality | Duplicate risk | Deterministic mapping to staging Subjects? | Schema conflicts | **Class** |
|---|---:|---|---|---|---|---|---|---|---|---|
| `prisma/migration-export.json` (`resources`) | 226 | old cuids (foreign to staging) | Yes — via export's own `programs`/`terms`/`subjects` arrays | Yes (`year`, `type: PYQ`) | `/uploads/pyqs/<uuid>-<name>.pdf` — **local dev-storage path only**, real PDF bytes confirmed present on this machine's disk (`public/uploads/pyqs/`, 81MB/239 files, gitignored, never deployed) | High — real title/year/subject metadata, 208/226 have a SHA-256 `fileHash` | Low within-source (0 exact-hash duplicate groups found; 4 probable-duplicate title/subject pairs) | **No, not automatically** — old subject names must re-match current Subjects by canonical name; verified only 7/226 resolve to exactly one unambiguous current Subject | None | **A** (real, high-quality metadata) **but B/E for storage** — file bytes are local-only, not yet servable |
| `prisma/migration-export.json` (`failedUploads`) | 115 | old cuids | Explicitly **"No subject matched"** already | Yes | `/uploads/failed/...` (local, 44MB/112 files present) | Real files, but deliberately unresolved by the original admin flow | N/A (never resolved) | No — by definition | None | **E** — requires manual subject assignment before any import is even possible |
| `scratch/bcom_drive_files.json` | 58 | Google Drive file IDs | Yes — `program`/`subject_slug`/`year` fields | Year yes, no explicit type | Real `https://drive.google.com/file/d/.../view` links | High — already matched to program+subject+year | Unknown vs. `bcom_all_drive_pdfs.json` (superset) | Different model (`DriveFileMatch`, not `Resource`) — not evaluated for Resource-matching | None | **B** — useful supplemental source, for the DriveFileMatch track, not this wave |
| `scratch/bcom_all_drive_pdfs.json` | 115 | Google Drive file IDs | No — raw folder-path listing only | No | Real Drive links | Raw, unmatched | High overlap with the above | N/A (raw listing) | None | **B** — same, needs matching work first |
| `254-pending-files-for-organization.csv` | 227 | none | Yes — `programName`/`semesterOrder`/`subjectName` per DU-formatted filename | No | **None** — no fileUrl/object key at all | Metadata-only, filename-derived | Unknown | Cannot import without a paired file | None | **E** — needs someone to locate/upload the actual files first |
| `src/data/ramanujan-pyq-catalog.json` | 2,431 | internal `id` | Yes | Yes | External `library.ramanujancollege.ac.in` URLs | High, but **already live** | N/A | N/A — not DB-backed at all | N/A | **C** — already served via `getSourceCatalog()`, independent of Postgres; importing would duplicate live content |
| `src/data/geography-drive-catalog.ts`, `political-science-drive-catalog.ts`, `du-master-drive-catalog.ts`, `extracted-pyq-catalog.ts` (backed by `public/qps/`, 95 files, **committed to git, already deployed**), `bcom-drive-catalog.ts` | ~2,000+ combined | internal | Varies | Varies | Real, already-public URLs (some external, some `/qps/...` already deployed) | High, **already live** | N/A | N/A — not DB-backed | N/A | **C** — same as above, do not duplicate |
| `scratch/index.json` / `split_index.json` | 71 | source_key | Yes, rich | Yes | References `public/pyq/...` — **directory does not exist locally, 0 files** | Metadata looks good but **no backing files found anywhere** | Unknown | Cannot import — no file evidence | None | **E** — orphaned index, needs the actual files located first |
| `scratch/search-index.json` | 71 | `pyq-001` style | Derived from split_index | N/A | Same missing `public/pyq/...` paths | Derived/runtime index | N/A | N/A | N/A | **C/D** — a derived search index, same underlying missing-file problem as above |
| `data/import-mappings/session-program-links.json` | 160 (already resolved) | N/A | N/A | N/A | N/A | Phase 2 documentation, fully consumed already | N/A | N/A | N/A | **D** — historical record, not a new source |
| `docs/seo/backlink-tracker-template.csv` | template rows | N/A | N/A | N/A | N/A | Unrelated (SEO/marketing) | N/A | N/A | N/A | **D** — irrelevant to paper data |

**Bottom line:** exactly **one** source (`prisma/migration-export.json`'s `resources` array) is both real and structured enough to attempt a Resource import this wave. Everything else is either already-live (do not duplicate), missing its backing files entirely, or belongs to a different model (`DriveFileMatch`) needing separate tooling.

---

## STEP 3 — R2 relationship (read-only)

**Honest limitation: this session has no R2 credentials** (`.env`/`.env.local` values are masked/sensitive, and no R2 access was configured for this shell) — so "read-only" here means **code/config inspection**, not a live bucket listing. Nothing was assumed beyond what the code itself proves.

- **Current live storage module:** `src/lib/storage.ts` (the legacy, currently-deployed one — not the newer `src/lib/storage/` split-bucket module, which per `docs/ENVIRONMENT_VARIABLE_MATRIX.md` has its new env vars **"Not set anywhere"** in Vercel). Legacy env vars (`R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`/`SECRET`) **are** set in Production+Preview.
- **Bucket:** single bucket, all categories mixed (per the matrix doc) — actual name not readable from this session.
- **Public URL format:** `${R2_PUBLIC_URL}/<key>` — domain value itself is secret, not readable here.
- **Object-key structure (from `src/lib/actions.ts` call sites):** `uploads/<category>/<uuid>-<filename>` — e.g. `uploads/pyqs/...`, `uploads/term-papers/...`, `uploads/failed/...`.
- **Can staging reference existing live R2 objects read-only?** Architecturally yes — nothing stops a fresh `Resource.fileUrl` from pointing at an existing public R2 URL. But this requires knowing that URL is real, which this audit could not confirm.
- **Is a staging copy necessary?** For the 226 `migration-export.json` resources specifically: **their `fileUrl` values are local dev-storage paths (`/uploads/...`), not R2 URLs at all.** The real PDF bytes exist only on this machine's local disk (confirmed: 81MB across 239 files in `public/uploads/pyqs/`, gitignored, never deployed to Vercel or R2). There is no evidence these specific files were ever uploaded to the live bucket. **Preference honored:** this plan does **not** propose duplicating anything already safely in R2 — but for this specific source, nothing is confirmed to be in R2 yet, so the "prefer reuse over duplicate" rule can't be exercised until someone either (a) confirms via the R2 dashboard/API that matching objects already exist under the `uploads/pyqs/` prefix, or (b) performs a real upload as an explicit, separate, later step.
- **No R2 object was read, uploaded, moved, or modified during this step.**

---

## STEP 4 — Content import framework

Added, mirroring the existing catalogue importer's shape (`target-guard.ts`, bounded/keyed lookups, chunked transactions, preview/validate/apply/verify contract) but fully separate so a bug in one wave can never affect the other:

- `scripts/import/sources/resources.ts` — loads and normalizes `prisma/migration-export.json`
- `scripts/import/lib/resource-plan.ts` — subject resolution (canonical-key match, bounded/paginated — never an unrestricted `findMany`), exact/probable duplicate detection, storage-reference validation
- `scripts/import/lib/resource-apply.ts` — chunked insert logic (**not executed this session**)
- `scripts/import/lib/resource-verify.ts` — post-apply integrity checks (**not executed — nothing was applied**)
- `scripts/import/lib/resource-report.ts` — the three report files below
- `scripts/import/run-resources.ts` — CLI entry, same `--mode=`/`--confirm` contract
- `package.json`: `import:resources:preview`, `import:resources:validate`, `import:resources:apply`, `import:resources:verify`

**Deterministic ID:** `Resource.sourceJsonName` (already a `@unique` column, no migration needed) is set to `migration-export:<old-resource-id>` — reruns are idempotent by construction, exactly like the catalogue wave's natural-key pattern.

**No unrestricted `findMany`:** Subject matching pages through the table in bounded, cursor-ordered chunks of 1,000 (id/name/term/program only — never `ocrText` or other large fields); existing-Resource lookup batches by `sourceJsonName` in chunks of 500, same convention as `db-lookup.ts`.

### Preview run (against Supabase staging)

```
Source: migration-export-resources (226 records) from prisma/migration-export.json
Insert-ready (clean): 0
Already exists: 0
Rejected: 0  Unresolved subject: 219  Missing storage reference: 7
Exact duplicate groups: 0  Probable duplicate groups: 4
```

`import:resources:validate` correctly exits non-zero (219 unresolved + 7 missing-storage records present).

**Why the resolution rate is this low — verified, not assumed:**
- Many old subjects belonged to an old dev DB's single **"Common Pool (VAC / AEC / SEC)"** program — the current fresh catalogue splits electives into **5 separate** pools (AEC/SEC/VAC/GE/DSE, see Phase 2), and several of those old pool-subject names (e.g. "Financial Literacy", "Yoga Philosophy & Practice", "Art of Being Happy") don't exist under **any** current pool at all — genuinely absent from the fresh master-syllabus catalogue, not a matching bug.
- Some names are **genuinely ambiguous**: e.g. "Finance for Everyone" exists as a real Subject under **both** B.Com (Hons) and B.Com (Programme) — correctly left unresolved rather than guessed.
- Some carry old course-code prefixes (e.g. "BC 3.4(b) — Cyber Crimes & Laws") that don't canonically match the current clean subject name.
- The 7 that *did* resolve cleanly (Multivariate Calculus ×3, Programming using Python ×3, Complex Analysis ×1) are blocked purely on the storage-reference gap from Step 3 — genuinely "ready except we can't confirm the file is servable."

No fuzzy matching beyond `canonicalSubjectKey()` — the same deterministic normalization already trusted elsewhere in this codebase for subject identity — was applied. Nothing here was silently guessed.

Reports written: `reports/resource-import-preview.json`, `reports/resource-import-rejections.csv`, `reports/resource-import-warnings.csv`.

---

## STEP 5 — Live application expectations

| # | Question | Answer |
|---|---|---|
| 1 | If Production `DATABASE_URL` were switched after this import, would `/pyq-notes` show real papers? | **Partially, unchanged either way.** The static catalogs (2,431 Ramanujan rows + geography/political-science/du-master/extracted-zip/bcom, several thousand more rows) are bundled in the app itself, not DB-backed — they'd show up regardless of any Resource import. The DB-backed slice (`CatalogPaperUpload`, `Resource` "read online", `DriveFileMatch`) would be **empty** — 0 rows in staging today, and this wave's preview resolved 0 new clean rows. |
| 2 | Would subject pages show real resources? | **No.** `Resource` is 0 rows in staging. Every subject page's resource list would be empty until a real apply happens. |
| 3 | Would search find real paper/resource records? | Search only indexes `Subject` names/aliases (fully populated, 7,650 rows) — search itself works, but lands on a subject page with no papers (see #2). |
| 4 | Would PDF links still resolve? | For static-catalog papers: yes, unaffected by DB state. For `Resource`/`CatalogPaperUpload`/`DriveFileMatch`-backed papers: no, because those tables are empty. |
| 5 | Would combined-download routes work? | Partially — same union as `/pyq-notes`; would merge static-catalog PDFs but miss anything DB-backed. |
| 6 | Would notes pages work? | The `/notes` hub itself works (Program/Term data is fully populated). Actual per-subject notes content (`Resource` type=NOTES, `SubjectNotes`) would be empty — both 0 rows. |
| 7 | Would admin pages have the data they expect? | Admin login is possible (1 pre-existing test `Admin` row already in staging, unrelated to this wave). Every content-management screen (resources, questions, content-blocks, uploads, failed uploads) would show empty catalogs — all 0 rows. |

---

## STEP 6 — Approval gate

| Metric | Count |
|---|---:|
| Total source paper/resource records found (this wave's source) | 226 |
| Clean importable records | **0** |
| Rejected records (hard validation failures) | 0 |
| Unresolved Subject mappings | 219 |
| Exact duplicates (within source) | 0 groups |
| Probable duplicates (within source) | 4 groups (8 rows) |
| Missing storage/R2 references | 7 |
| Models populated this wave | None — preview/validate only, zero writes |
| Models still impossible to recreate without Neon or further live sync | `DriveFileMatch`/`DriveSubject` at full scale (needs live Google Drive API sync beyond the two B.Com scratch files), `Question`, `ContentBlock`, `SubjectAnalysis`, `NoteTheme`, `SubjectNotes` — none found in any local source file |
| Would the public site be functionally complete after this wave? | **No** — even in the best case (all 226 resolved), that's a small fraction of what the live site needs; the real bulk of "Full Archive" content is `DriveFileMatch`, entirely out of this wave's scope |

## READY FOR RESOURCE IMPORT / **NOT READY FOR RESOURCE IMPORT**

# → **NOT READY FOR RESOURCE IMPORT**

Two independent, both-necessary gaps, neither of which this preview should paper over:

1. **Subject mapping**: 219/226 records don't cleanly resolve to a current Subject — some genuinely don't exist in the fresh catalogue, some are ambiguous across programmes. Needs the same kind of human, category-by-category review Phase 2 did for programme aliases (not a code fix).
2. **Storage**: even the 7 records that *do* resolve cleanly can't be confirmed servable — their source file references are local-only, and this session had no R2 credentials to verify or use existing objects safely.

Recommended next steps (not executed): (a) get real R2 read access to check whether `uploads/pyqs/...` objects already exist live, or plan an explicit upload; (b) run the same manual-decision-review pattern from Phase 2 on the 219 unresolved subjects, category by category; (c) separately, scope a `DriveFileMatch` import wave (using `scratch/bcom_drive_files.json` as a starting pattern, or a live Drive API sync) — likely higher-impact than this wave, since the code itself calls that model "the actual bulk of Full Archive content."

---

## Tests

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ 0 errors |
| `eslint .` | ✅ 0 errors, 12 pre-existing warnings (unrelated files, unchanged) |
| Importer tests (`scripts/import/__tests__`) | ✅ 39/39 passing |
| App + storage tests (`npm test`) | ✅ 64/64 passing |
| `next build` | ✅ exit 0, all routes render |

No test was modified to pass; nothing in Production was touched to make any of this succeed.

---

## Files changed this wave

- `scripts/import/sources/resources.ts` (new)
- `scripts/import/lib/resource-plan.ts` (new)
- `scripts/import/lib/resource-apply.ts` (new, not executed)
- `scripts/import/lib/resource-verify.ts` (new, not executed)
- `scripts/import/lib/resource-report.ts` (new)
- `scripts/import/run-resources.ts` (new)
- `package.json` — 4 new scripts
- `docs/PHASE_3_RESOURCE_IMPORT_PLAN.md` (new, this file)
- `reports/resource-import-preview.json`, `reports/resource-import-rejections.csv`, `reports/resource-import-warnings.csv` (generated)

**Database changes: none.** Supabase staging's row counts are unchanged from
before this wave. Production/Neon, Vercel Production, DNS, and live R2
objects were never touched.
