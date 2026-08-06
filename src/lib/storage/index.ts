// Barrel export for the portable R2 storage layer — see
// docs/PHASE_2F_R2_STORAGE_MIGRATION.md. This is deliberately additive: the
// existing src/lib/storage.ts (single-bucket, @vercel/blob-fallback,
// actively used by 4 call sites) is untouched. Migrating those call sites
// to this module is a separate, explicit follow-up — not done as part of
// this wave, to avoid changing already-working upload/download behavior.
export * from "./types";
export * from "./config";
export * from "./paths";
export * from "./validation";
export * from "./public-url";
export * from "./client";
export * from "./upload";
export * from "./delete";
export * from "./signed-url";
