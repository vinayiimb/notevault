# Phase 2I — Security and Abuse Protection Audit

## Method

Code-level audit (no browser available in this environment) of every
Server Action in `src/lib/actions.ts` (73 exported functions) and every
Route Handler under `src/app/api/`, checked against the Checkpoint I
requirements list. Two real, small gaps were found and fixed; everything
else was either already solid or is a documented, deliberately-untouched
risk (consistent with how Phase 2A handled similar admin-only findings).

## Admin-role verification — audited exhaustively, not sampled

Extracted every `export async function` in `src/lib/actions.ts` and
checked whether `requireAdmin()` appears in its body (or transitively, via
a call to another `requireAdmin()`-gated function). **69 of 73 call it
directly; the remaining 4 are correctly public**:

| Function | Why it's correctly public |
| --- | --- |
| `loginAction` | It *is* the login flow |
| `logoutAction` | Clearing a session cookie needs no prior session |
| `submitFeedbackAction` | By design — public `/feedback` page, no login required (see the model's own schema comment) |
| `uploadResourceFormAction` | Thin wrapper that immediately calls `uploadResourceAction(formData)`, which itself calls `requireAdmin()` — protected transitively, not a gap |

No admin mutation was found missing its authorization check.

`requireAdmin()` (`src/lib/actions.ts`) calls `getSession()`
(`src/lib/auth.ts`) — a real server-side JWT verification against an
httpOnly cookie, not a client-trusted flag. `src/app/admin/(dashboard)/layout.tsx`
additionally gates every admin *page* (not just mutations) with the same
`getSession()` + `redirect("/login")`, so both the UI and the mutation
layer are independently protected — a direct POST to a Server Action's
endpoint, bypassing the page entirely, still hits `requireAdmin()`.

## Session validation

Custom JWT session (`jsonwebtoken` + `bcryptjs`), verified server-side on
every `getSession()` call, httpOnly + `sameSite: "lax"` + `secure` (in
production) cookie. See the correction in
`docs/PHASE_2H_STAGING_APPLICATION_INTEGRATION.md` — this is **not**
Auth.js/NextAuth despite the stated infrastructure list; documented as a
factual correction, not changed.

## Fixed this pass

1. **`/api/search-suggestions` had no rate limit** — publicly callable
   directly (bypassing the client-side debounce entirely), unlike its two
   sibling routes (`download-all`, `catalog-combined-pdf`) which already
   had `checkRateLimit`. Added: 60 requests/60s per IP — generous enough
   for real typeahead use (well above what a 400ms debounce could ever
   produce), bounded against direct-call abuse.
2. **`/api/download/[resourceId]` had no rate limit and no `select`
   narrowing** — every hit did an unscoped `findUnique` (full `Resource`
   row, including the large `ocrText`/`rawOcrText` `@db.Text` columns) just
   to read `fileUrl` for a redirect, then wrote to the database (`downloads`
   increment) with no rate limit at all. Narrowed to `select: { fileUrl: true }`
   and added the same rate-limit pattern (30/60s per IP) used by the two
   sibling routes.

Both fixes reuse the existing, already-tested `checkRateLimit`/
`clientIpFromHeaders` from `src/lib/rate-limit.ts` — no new dependency, no
behavior change for legitimate traffic, matching the exact pattern already
established in `download-all`/`catalog-combined-pdf`.

## Already solid (audited, not modified)

- **MIME/SSRF protection on external fetches**: `catalog-combined-pdf`
  only ever fetches from an explicit hostname allowlist
  (`library.ramanujancollege.ac.in`, `drive.google.com`, the configured R2
  public URL) — client-supplied URLs are never trusted directly, closing
  off use as an open SSRF proxy.
- **Server Action body size**: capped at 25MB globally
  (`next.config.ts`'s `experimental.serverActions.bodySizeLimit`) — no
  unbounded upload is possible through any Server Action.
- **SQL injection**: zero `$queryRaw`/`$executeRaw` calls anywhere in
  `src/`, `prisma/`, or `scripts/` (excluding this migration's own new
  `scripts/import/lib/verify.ts`, which uses `$queryRawUnsafe` with
  hardcoded SQL strings and no user input interpolated — confirmed safe by
  inspection). Every other query goes through Prisma's parameterized query
  builder.
- **No `eval`/`new Function`/`child_process`** anywhere in `src/`.
- **No secrets in the client bundle**: every `"use client"` file in `src/`
  was checked for `process.env.*` references — zero found.
- **No credentials in logs**: `scripts/import/lib/target-guard.ts` and
  `scripts/storage-migration`'s equivalent only ever log a hostname
  (`describeTarget`), never a full connection string; `src/lib/storage/client.ts`'s
  `describeR2Config` is the same pattern for R2.
- **Filename sanitization**: the legacy upload path
  (`src/lib/storage.ts::saveUploadedFile`) already strips unsafe
  characters (`file.name.replace(/[^\w.\-]+/g, "_")`); the new
  `src/lib/storage/validation.ts` (Checkpoint F) is stricter still
  (path-traversal-proof, executable-extension blocklist) for the new
  upload flow once it's adopted.
- **CSRF**: Next.js Server Actions verify the request's `Origin` header
  against the deployment's own origin by default — no additional
  middleware needed, nothing here overrides that default.
- **Rate limiting is provider-independent**: `src/lib/rate-limit.ts` is a
  plain in-memory fixed-window limiter behind a 2-function interface
  (`checkRateLimit`, `clientIpFromHeaders`) with no Upstash/Vercel KV
  dependency. No `UPSTASH_*` env vars are configured anywhere in this repo
  — confirming the in-memory implementation is the actual current choice,
  not a stopgap waiting on missing credentials. If real abuse is ever
  observed on a route this limiter can't catch (cross-instance/cross-region
  hammering — its documented limitation), swapping in Upstash behind the
  same two-function interface is a contained change.
- **No open database-management endpoint**: no route or admin page
  executes arbitrary SQL or shell commands from request input.

## Deliberately not changed (documented risk, not a gap introduced by this migration)

- **Admin file uploads (`uploadResourceAction` and siblings in
  `src/lib/actions.ts`) don't independently validate MIME type or a
  per-file size ceiling** beyond the global 25MB Server Action body cap
  and an empty-file check. These are `requireAdmin()`-gated (not public),
  and adding stricter validation risks breaking real admin workflows
  (e.g. a legitimately oversized scan, or a file type the current code
  tolerates) without dedicated test coverage — same reasoning Phase 2A
  used to deliberately leave `getCourseCoverageData` untouched. The new
  `src/lib/storage/validation.ts` module (Checkpoint F) already provides
  exactly this capability (MIME allowlist, size ceiling, executable
  blocklist) and is the natural fit once the storage-migration wave
  (Checkpoint G) actually moves these call sites onto it — recommended
  as the fix, not applied speculatively here.
- **In-memory rate limiter is per-instance** (Phase 2A's own documented
  risk #6, unchanged) — acceptable for current traffic per the "no paid
  dependency" constraint; revisit with Upstash if real cross-instance abuse
  is observed.
- **`/api/catalog-combined-pdf` and `/api/subjects/[id]/download-all`**
  were already rate-limited before this pass (10/60s and 10/60s
  respectively, established in Phase 2A) — left as-is, no gap found.

## Verification

`tsc --noEmit`, `eslint .`, `npm test` (app+storage), importer tests, and
`next build` all re-run after these two route changes — see
`docs/COMBINED_MIGRATION_WAVE_2_REPORT.md`'s Checkpoint J section for the
consolidated results.
