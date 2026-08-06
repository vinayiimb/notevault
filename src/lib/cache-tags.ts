// Central registry of unstable_cache/revalidateTag tag names so the data
// layer (src/lib/data.ts, src/lib/pyq-catalog.ts) and the Server Actions
// that mutate the underlying tables (src/lib/actions.ts and friends) always
// agree on the exact string. Introduced in Phase 2A of the infrastructure
// migration (see docs/PHASE_2_QUERY_REMEDIATION.md) to stop public pages
// from re-querying Postgres on every request without a way to bust the
// cache the moment an admin actually changes something.
export const CACHE_TAGS = {
  programs: "programs",
  terms: "terms",
  subjects: "subjects",
  pyqArchive: "pyq-archive",
  driveArchive: "drive-archive",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
