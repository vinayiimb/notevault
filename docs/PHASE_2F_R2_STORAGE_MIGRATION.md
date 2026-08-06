# Phase 2F — Cloudflare R2 Storage Layer & Migration Tooling

## What this is

A new, provider-independent S3-compatible storage module at
`src/lib/storage/` (not to be confused with the existing
`src/lib/storage.ts` — see "Relationship to the existing storage.ts" below).
Built for the DU PYQ Online migration's new file layout: a public bucket for
papers/thumbnails/blog-images/syllabus files, and a private bucket for
database backups, original source files, rejected-import files, and
temporary admin uploads.

```
src/lib/storage/
  types.ts        shared types (no I/O)
  config.ts        env-var resolution + bucket routing (no I/O beyond process.env)
  validation.ts    MIME/size/filename/path-traversal/executable checks (pure)
  paths.ts         deterministic object-key construction (pure)
  client.ts        S3Client construction (Cloudflare R2, not @vercel/blob)
  public-url.ts     public URL construction (custom domain only, never r2.dev)
  upload.ts        validate -> checksum -> upload, with duplicate-skip
  delete.ts        idempotent delete
  signed-url.ts     short-lived signed GET for private objects
  index.ts         barrel export
  __tests__/       53 unit tests, all with a mocked S3Client (no real network calls)
```

## Relationship to the existing `src/lib/storage.ts`

`src/lib/storage.ts` is the app's real, currently-deployed storage module —
a single R2 bucket (env vars `R2_BUCKET_NAME`/`R2_PUBLIC_URL`, plus a legacy
`@vercel/blob` fallback path for URLs written before the R2 migration), used
today by 4 call sites (`src/app/api/subjects/[id]/download-all/route.ts`,
`src/lib/pdf-server.ts`, `src/lib/note-ingestion.ts`, `src/lib/actions.ts`).

**This wave does not touch it.** `src/lib/storage/` is additive — a new,
portable module for the new deterministic-path, split-bucket layout this
migration wave introduces. Migrating the 4 existing call sites over to the
new module is an explicit, separate follow-up, not done here, to avoid
changing already-working upload/download behavior for real users mid-wave
(global rule 10: preserve existing routes and visible UI).

## Why not `@vercel/blob`

Per the task spec. R2 is S3-API-compatible, so every function in this
module works unmodified against any other S3-compatible provider (AWS S3,
MinIO, Backblaze B2's S3 endpoint, ...) if hosting ever moves off
Cloudflare or off Vercel — the portability goal behind building this as a
standalone module rather than another provider-specific SDK wrapper.

## Environment variables

New names, distinct from the legacy `storage.ts` variables (`R2_BUCKET_NAME`,
`R2_PUBLIC_URL`) — this module needs two buckets, not one:

| Variable | Purpose |
| --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare account id |
| `R2_ACCESS_KEY_ID` | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | R2 API token secret |
| `R2_ENDPOINT` | `https://<account-id>.r2.cloudflarestorage.com` |
| `R2_PUBLIC_BUCKET` | Bucket name for papers/thumbnails/blog-images/syllabus |
| `R2_PRIVATE_BUCKET` | Bucket name for backups/original-files/rejected-imports/temp-admin-uploads |
| `R2_PUBLIC_BASE_URL` | Configured custom domain serving the public bucket — **never** a bare `*.r2.dev` URL (config.ts refuses to resolve if one is set) |

No real values are written anywhere in this repo or its docs.

## Current credential status (as of 2026-08-06)

The repo's `.env`/`.env.local`/`.env.supabase-staging.local` files already
have R2 credentials configured — but under the **legacy single-bucket**
variable names (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
`R2_ENDPOINT`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`), identical across all
three env files. None of the new split-bucket variables
(`R2_PUBLIC_BUCKET`, `R2_PRIVATE_BUCKET`, `R2_PUBLIC_BASE_URL`) are set
anywhere, and there is only one R2 bucket name configured, account-wide —
i.e. **no distinct staging bucket exists yet**, only what appears to be the
live bucket the currently-deployed app already serves real files from.

Per this checkpoint's own instruction ("If valid staging credentials are
unavailable: complete the code, complete tests using mocks... do not
attempt a real upload"), no real upload was attempted against this
account. `isR2Configured()` correctly returns `false` today (the new
variable names aren't set), so the module safely no-ops rather than
accidentally targeting the legacy production bucket if called.

## Manual setup steps required before this module can be used for real

1. In the Cloudflare dashboard, create two **new** R2 buckets (do not reuse
   the existing single bucket the legacy `storage.ts` writes to):
   - a public bucket, e.g. `dupyq-staging-public`
   - a private bucket, e.g. `dupyq-staging-private`
2. Attach a public custom domain to the public bucket (Cloudflare R2 →
   bucket → Settings → Custom Domains). Do not use the bucket's default
   `*.r2.dev` URL — `resolveR2Config()` will refuse to start if
   `R2_PUBLIC_BASE_URL` matches one.
3. Create an R2 API token scoped to both new buckets (Object Read & Write).
4. Add to `.env.supabase-staging.local` (or a new `.env.r2-staging.local`,
   gitignored either way):
   ```
   R2_ACCOUNT_ID=...
   R2_ACCESS_KEY_ID=...
   R2_SECRET_ACCESS_KEY=...
   R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
   R2_PUBLIC_BUCKET=dupyq-staging-public
   R2_PRIVATE_BUCKET=dupyq-staging-private
   R2_PUBLIC_BASE_URL=https://<your-custom-domain>
   ```
5. Repeat with separate production-scoped buckets/token before any
   production cutover — never point staging and production at the same R2
   bucket (mirrors the Postgres staging/production separation already in
   place for Supabase vs. the live Neon database).

## Security properties (tested)

- MIME allowlist per category (a PDF category rejects an image upload, etc.)
- File-size ceilings per category
- Filename sanitization strips path separators, null bytes, leading dots
- Explicit path-traversal rejection (`..` anywhere in a constructed key throws)
- Executable/script extension blocklist, independent of the MIME check
- Deterministic object keys — same category + path segments + filename always
  produce the same key, which is what makes duplicate-skip and the
  migration planner's resumability possible (Checkpoint G)
- `uploadAsset` never calls S3 at all for invalid input (validated first)
- Public URLs only ever use the configured custom domain; private objects
  never get a public URL, only a signed, time-limited one (capped at 24h)
- No PDF/image binary content ever touches Postgres — only keys + metadata

## Deterministic path scheme

```
papers/{programmeSlug}/{termSlug}/{subjectSlug}/{year}/{paperId}.pdf
thumbnails/...
blog-images/...
syllabus/...
backups/...
original-source-files/...
rejected-imports/...
temp-admin-uploads/...
```

`buildPaperKey()` in `paths.ts` implements the exact example from the task
spec. Every path segment is passed through `slugSegment()` (lowercase,
hyphenated, same shape as the importer's `deterministicSlug()` without a
direct code dependency on it — `src/lib/*` and `scripts/import/*` are kept
independent per Phase 2C's existing boundary rule).

## Test coverage

53 tests total (up from the pre-existing app+importer 28+39):
`config.test.ts` (bucket routing, missing-var errors, r2.dev rejection),
`validation.test.ts` (MIME/size/filename/path-traversal/executable),
`paths.test.ts` (deterministic key construction), `upload.test.ts` (public
vs. private routing, duplicate-skip, overwrite, validation-before-network),
`delete-signed-url.test.ts` (idempotent delete, signed URL expiry cap). All
mock `S3Client.prototype.send` directly (Node's built-in `test.mock`, no
new dependency added) — no real network calls anywhere in the suite.
