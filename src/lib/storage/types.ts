// Shared types for the portable R2/S3-compatible storage layer. Only
// object keys + metadata ever live in Postgres — never binary content (see
// docs/PHASE_2F_R2_STORAGE_MIGRATION.md).

export type StorageBucketKind = "public" | "private";

/** Logical categories, each pinned to one bucket kind — see config.ts. */
export type PublicAssetCategory = "papers" | "thumbnails" | "blog-images" | "syllabus-files";
export type PrivateAssetCategory = "database-backups" | "original-source-files" | "rejected-imports" | "temp-admin-uploads";
export type AssetCategory = PublicAssetCategory | PrivateAssetCategory;

export type UploadInput = {
  category: AssetCategory;
  /** Pre-sanitized path segments (e.g. [programmeSlug, termSlug, subjectSlug, year, paperId]) — see paths.ts. */
  pathSegments: string[];
  fileName: string;
  bytes: Uint8Array;
  contentType: string;
};

export type UploadResult = {
  bucket: StorageBucketKind;
  key: string;
  /** Only set for public-bucket uploads — private objects are never given a public URL. */
  publicUrl: string | null;
  sizeBytes: number;
  checksumSha256: string;
};

export type SignedUrlResult = {
  url: string;
  expiresAt: string; // ISO timestamp
};

export type ValidationError = { field: string; message: string };
