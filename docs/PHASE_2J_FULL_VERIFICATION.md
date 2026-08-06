# Phase 2J — Full Verification

## Client-bundle secret scan — found and fixed a real leak

Per this checkpoint's explicit requirement ("verify that no generated
client bundle contains DATABASE_URL, DIRECT_URL, Supabase service-role key,
R2 secret, Resend secret, Auth secret, Upstash secret"), grepped the actual
built output (`.next/static/**`, after `next build`) rather than assuming
source-level correctness.

**First pass found a real hit.** `grep -rl "DATABASE_URL" .next/static`
matched `06-xa7km_4op7.js` — a client chunk containing `src/lib/prisma.ts`'s
`process.env.DATABASE_URL` handling logic (its format-check + a hardcoded
**local** dev fallback string, `postgresql://postgres@127.0.0.1:5432/notevault_dev`
— not a real credential; no actual secret *value* was ever exposed, since
`process.env.DATABASE_URL` simply reads as `undefined` in a browser). Still
a real bug: server-only logic (and the literal variable name) had no
business being in a client bundle at all.

### Root cause

`src/lib/prisma.ts`, `src/lib/data.ts`, `src/lib/student.ts`,
`src/lib/pyq-catalog.ts`, `src/lib/coverage-data.ts`, `src/lib/auth.ts`, and
`src/lib/storage.ts` — every core server-only data-layer module — had no
`import "server-only"` guard. Only `src/lib/blog.ts` had one anywhere in
the codebase. Without the guard, nothing stops a Client Component from
transitively pulling one of these modules into its bundle; it just silently
happens.

The actual leak: `src/components/dashboard/currency-icon.tsx` exported an
async **Server Component** (`CurrencyIcon`, which calls `getSiteSettings()`)
from the same file as `CurrencyIconDisplay` (a pure presentational
component) — and `src/components/dashboard/semester-progress-summary.tsx`,
a `"use client"` component, imported `CurrencyIcon` (later `CurrencyIconDisplay`
from the same file) directly. A Client Component importing *anything* from
a module pulls in that module's entire top-level import graph, including
imports the specific export it uses doesn't even touch — so
`currency-icon.tsx`'s `import { getSiteSettings } from "@/lib/data"` rode
along into the client bundle regardless of which named export was used.

### Fix

1. Added `import "server-only"` to all 7 files above, plus the credential/
   AWS-SDK-touching pieces of the new storage module
   (`src/lib/storage/{client,config,upload,delete,signed-url,public-url}.ts`)
   — `validation.ts`, `paths.ts`, and `types.ts` are pure and left unguarded
   since nothing in them touches a credential or `process.env`.
2. Split `currency-icon.tsx` into two files:
   `currency-icon-display.tsx` (pure, prop-driven, zero imports beyond
   React — safe for any component type) and `currency-icon.tsx` (the
   Server Component wrapper, now `server-only`-guarded).
   `semester-progress-summary.tsx` now imports `CurrencyIconDisplay`
   directly from its own file and receives the icon URL as a
   `currencyIconUrl` prop, threaded from the Server Component chain
   (`page.tsx` → `getSiteSettings()` → `DashboardShell` → `SemesterProgressSummary`)
   instead of fetching it itself.
3. Rebuilt with the guards in place: Next's build now **fails loudly**
   (not silently) if this class of bug is ever reintroduced —
   `'server-only' cannot be imported from a Client Component module`,
   with a full import trace pointing at the exact offending chain. This is
   the real value of the guard: it converts a silent bundle leak into a
   build-breaking error, discovered here specifically because adding it
   surfaced the pre-existing `currency-icon.tsx` bug.
4. Re-scanned the rebuilt `.next/static` output — zero matches for
   `DATABASE_URL`, `postgresql://`, `postgres://`, `r2.cloudflarestorage.com`,
   `service_role`, `eyJhbGciOi` (JWT/service-role key prefix pattern),
   `R2_SECRET`, `R2_ACCESS_KEY`, `JWT_SECRET`, `RESEND_API_KEY`, `UPSTASH`.

### Test-runner compatibility fix

Adding the guards broke 5 existing unit tests
(`pyq-archive-pagination.test.ts`, `search-suggestions.test.ts`, and the 3
new storage tests that import a now-guarded module directly) — `server-only`'s
package resolves to a real no-op (`empty.js`) only under Next's
`"react-server"` export condition; a plain `node --test` run resolves to
its default export, which unconditionally throws (by design, to catch
exactly the class of bug this fixes — just too bluntly for a bare Node test
runner). Fixed by adding `--conditions=react-server` to the `test` npm
script (`package.json`), which tells Node's own module resolver to honor
that export condition the same way Next's bundler does. All 64 app+storage
tests and 39 importer tests pass again with the guards in place — nothing
was reverted to make tests pass.

## Consolidated verification results (this checkpoint, final state)

| Check | Result |
| --- | --- |
| `prisma validate` (fake env, schema-only) | ✅ Valid |
| `prisma migrate status` (live Supabase staging) | ✅ Up to date, 22/22 migrations applied |
| `tsc --noEmit` | ✅ 0 errors |
| `eslint .` | ✅ 0 errors, 12 pre-existing warnings (unrelated files, unchanged) |
| `npm test` (app + storage) | ✅ 64/64 passing |
| Importer tests | ✅ 39/39 passing |
| `next build` | ✅ Exit 0, all routes render, ISR routes correctly flagged |
| Client bundle secret scan | ✅ Clean (after the fix above) |
| Live Supabase staging: `import:apply --confirm` | ✅ 0 new inserts, 118/920/7650/9 all `skippedExisting` — idempotent |
| Live Supabase staging: `import:verify` | ✅ `ok: true`, 0 orphans, 0 duplicates |
| Live Supabase staging: `storage:plan`/`storage:verify` | ✅ Run cleanly, 0 Resource rows (none imported yet this wave) |
| Live Supabase staging: ISR cache-hit proof | ✅ 89s cold → 23ms warm on `/subjects/[id]`, real `next start` |
| Live Supabase staging: index confirmation | ✅ All 4 Phase 2A indexes present via `pg_indexes` |

See `docs/COMBINED_MIGRATION_WAVE_2_REPORT.md` for the full cross-checkpoint
summary, row counts, and remaining manual steps.
