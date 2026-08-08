# Master Mapping — Implementation Report

Extends the existing **Subject Normalization Centre** (`/admin/subject-normalization`)
rather than building a parallel system — see the Phase 1 inspection that
preceded this work. Also builds the previously-unfinished **Customize Full
Archive** tool (`/admin/archive-customize`), a separate string-keyed
duplicate-subject system for the `/pyq-notes` catalogue.

## 1. Files created

- `src/components/admin/subject-normalization/manual-merge-tab.tsx` — Tab 2: search/browse + checkbox-select + merge
- `src/components/admin/subject-normalization/merge-preview-dialog.tsx` — shared preview dialog (both tabs)
- `src/lib/archive-customize-data.ts` — read queries for the Full Archive duplicate-detection tool
- `src/lib/archive-customize-constants.ts` — `MERGE_TARGET_SEP` (kept out of `actions.ts` because a `"use server"` file may only export async functions)
- `src/app/admin/(dashboard)/archive-customize/page.tsx` — course overview (paper/subject/duplicate counts)
- `src/app/admin/(dashboard)/archive-customize/[courseSlug]/page.tsx` — per-course duplicate groups + rename/merge/reset
- `scripts/dev/test-subject-merge-live.ts` — manual live-DB integration test (not part of `npm test`)
- `docs/MASTER_MAPPING_IMPLEMENTATION.md` — this file

## 2. Files modified

- `src/lib/subject-merge.ts` — merge engine rewrite (see §4)
- `src/lib/subject-normalization.ts` — added `recommendCanonicalSubject()`
- `src/lib/subject-normalization-data.ts` — added `searchSubjectsForManualMerge()`
- `src/app/admin/(dashboard)/subject-normalization/actions.ts` — added `searchSubjectsForManualMergeAction`, `manualMergeAction`
- `src/lib/actions.ts` — fixed `mergeCatalogSubjectsAction`'s separator to a real named, printable constant (was an unnamed non-printable control character, invisible but functionally correct — renamed for maintainability, not a bug fix)
- `src/components/admin/subject-normalization/{types,panel,suggestion-card}.tsx` — new `MergePreview` shape, tab switcher, shared dialog
- `src/lib/__tests__/subject-normalization.test.ts` — added `recommendCanonicalSubject` tests

## 3. Database migrations

**None.** Every field this work relies on (`Subject.mergedIntoId`, `SubjectAlias`, `SubjectMergeSuggestion`, `SubjectMergeLog`, `CatalogSubjectOverride`) already existed in the schema — see the Phase 1 inspection. No `prisma/migrations/` changes.

## 4. Merge architecture

`src/lib/subject-merge.ts`'s `previewMerge`/`applyMerge`/`undoMerge`, all transactional. The real fix in this pass: **all 8 tables with a `subjectId` FK to `Subject`** are now handled (the prior version only handled 4):

| Table | Collision risk | Handling |
|---|---|---|
| Resource, Question, DriveSubject, StudentExamDate, NoteTheme, SubjectMatchMemory | None (no unique-per-subject constraint) | Blanket `updateMany` reassignment |
| SubjectNotes, SubjectAnalysis | `subjectId @unique` — 1:1 per subject | `previewMerge` counts across the whole group (canonical + members); if 2+ exist, `blocked: true` with an explicit conflict reason and the merge **refuses to run** rather than silently dropping one |
| `Subject.parentSubjectId` (children of a merged subject) | None | Re-pointed to the new canonical parent so the hierarchy survives |

Idempotency: re-applying an already-completed merge with the exact same (canonical, members) returns the original `SubjectMergeLog` instead of erroring or duplicating data. A member already merged into a *different* canonical still throws — that's a genuine conflict, not a re-run.

Undo: `SubjectMergeLog.reassignments` snapshots the exact prior `subjectId`/`parentSubjectId` per row for all 8 relation types — `undoMerge` restores precisely, not by re-deriving.

Canonical-subject recommendation (`recommendCanonicalSubject` in `subject-normalization.ts`): official UPC > total linked records (resources + questions) > name-quality score. Always overridable by the admin — this only sets the default radio selection.

## 5. AI matching architecture

Unchanged (already solid, verified in Phase 1) — `src/lib/subject-grouping.ts`'s Stage A/fuzzy blocking, `src/lib/ai.ts::suggestSubjectGrouping()` (Groq, structured Zod output, conservative prompt).

## 6. Subject-related tables discovered

All 8 (see §4's table) — found by grepping every `subjectId` field in `prisma/schema.prisma` directly, not assumed.

## 7. Safety checks implemented

- Merge preview shows all 8 relation-type counts, `totalLinkedRecordsBefore`/`AfterExpected`, `expectedDataLoss` (0 unless blocked)
- Red "Merge blocked" state with explicit reasons when a 1:1 collision exists; **Confirm merge button is disabled** in that state
- Green "Nothing will be permanently deleted..." statement shown only when the preview actually confirms safety (not unconditionally)
- Manual Merge tab search is scoped (programme/term or 2+ character query required) and capped at 100 results — never an unrestricted subject listing
- Every action (`manualMergeAction`, `searchSubjectsForManualMergeAction`, the two archive-customize actions) is `requireAdmin()`-gated, consistent with the rest of the codebase

## 8. Tests added

- 5 new unit tests for `recommendCanonicalSubject` (UPC priority, content-count tiebreak, name-quality fallback, empty input, never invents an id) — `npm test`
- 22 assertions in `scripts/dev/test-subject-merge-live.ts`, run live against Supabase staging (not mockable — this logic is a real Prisma transaction): resource/question preservation, alias creation, `mergedIntoId` flagging, idempotent re-apply (no duplicate), full undo restoration, double-undo rejection, 1:1-collision blocking at both preview and apply time. All passed; script cleans up everything it creates (verified via a post-run `import:verify` — `subjectMergeLog: 0`, `subjectMergeSuggestion: 0`, catalogue counts unchanged).

## 9. Build/lint/typecheck result

- `tsc --noEmit`: 0 errors
- `eslint .`: 0 errors, 12 pre-existing warnings (unrelated files, unchanged)
- `npm test`: 69/69 passing
- Importer tests: 39/39 passing
- `next build`: exit 0 — **caught a real bug tsc couldn't**: a plain `export const` in a `"use server"` file (Next.js requires every export from such a file to be an async function) — fixed by moving the constant to its own module
- Client-bundle secret scan: clean

## 10. Remaining risks

- Manual Merge tab's search uses a plain `contains`/`insensitive` Postgres query on `Subject.name` — fine at current scale, would benefit from a trigram/full-text index if the catalogue grows an order of magnitude (same class of note as Phase 2A's own remaining-risks list)
- `archive-customize`'s duplicate-grouping recomputes `computeCandidateGroups` from the full per-course paper list on every page load (no caching) — acceptable given it's admin-only and scoped to one course at a time, not a public egress path
- The Full Archive merge tool (`archive-customize`) and the Subject Normalization Centre are still two genuinely separate systems (different tables, different matching mechanisms) — intentional, not a gap, per the schema's own design (`CatalogSubjectOverride`'s comment explains why a separate merge-target column was deliberately not added there)

## 11. Manual testing steps

Against Supabase staging (`set -a; source .env.supabase-staging.local; set +a`, then `npm run dev` or `npm run build && npm start`), logged in as admin:

1. **Manual Merge**: `/admin/subject-normalization` → "Manual Merge" tab → pick a programme + semester (or search a name) → tick 2+ subjects → "Merge Selected" → confirm the preview shows real counts → "Confirm merge" → verify the merged subject's papers now appear under the canonical one.
2. **AI Similarity Review**: same page, default tab → pick a programme → "Scan Archive with AI" → review any suggestion card → expand it, change the canonical radio, "Preview & Merge" → confirm.
3. **Undo**: "Recent merges" list at the bottom → find your merge → undo it → verify the papers move back and the subject reappears in normal browsing.
4. **Collision blocking**: manually give two subjects in the same group their own compiled notes (via the subject's admin notes editor), then try merging them → confirm the dialog shows a red "Merge blocked" state with the SubjectNotes conflict explained, and "Confirm merge" is disabled.
5. **Full Archive**: `/admin/archive-customize` → pick a programme with a nonzero "possible duplicate groups" count → open it → review a candidate group → click one of the merge-target buttons → confirm the two subject names now group together on the live `/pyq-notes` page for that programme.
