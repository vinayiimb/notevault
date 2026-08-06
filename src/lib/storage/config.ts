// Central config for the portable R2 storage layer. Every value comes from
// process.env — never hard-coded, never logged in full (see client.ts's
// describeConfig(), which only ever exposes bucket names, not credentials).
import type { AssetCategory, PrivateAssetCategory, PublicAssetCategory, StorageBucketKind } from "./types";

const PUBLIC_CATEGORIES: PublicAssetCategory[] = ["papers", "thumbnails", "blog-images", "syllabus-files"];
const PRIVATE_CATEGORIES: PrivateAssetCategory[] = [
  "database-backups", "original-source-files", "rejected-imports", "temp-admin-uploads",
];

export function bucketKindForCategory(category: AssetCategory): StorageBucketKind {
  if ((PUBLIC_CATEGORIES as string[]).includes(category)) return "public";
  if ((PRIVATE_CATEGORIES as string[]).includes(category)) return "private";
  throw new Error(`Unknown storage category: ${category}`);
}

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint: string;
  publicBucket: string;
  privateBucket: string;
  /** The configured public file domain (custom domain, never a bare r2.dev URL). */
  publicBaseUrl: string;
};

export class StorageConfigError extends Error {}

/**
 * Resolves R2 config from environment variables. Throws StorageConfigError
 * (never logs values) if anything required is missing, or if
 * R2_PUBLIC_BASE_URL looks like a bare r2.dev URL (explicitly disallowed —
 * public downloads must go through the configured custom domain, never
 * Cloudflare's default dev subdomain, and never a Next.js API route proxy).
 */
export function resolveR2Config(): R2Config {
  const required = {
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT,
    publicBucket: process.env.R2_PUBLIC_BUCKET,
    privateBucket: process.env.R2_PRIVATE_BUCKET,
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL,
  };

  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    throw new StorageConfigError(
      `Missing required R2 environment variable(s): ${missing
        .map((k) => `R2_${k.replace(/([A-Z])/g, "_$1").toUpperCase()}`)
        .join(", ")}. See docs/PHASE_2F_R2_STORAGE_MIGRATION.md for setup.`,
    );
  }

  const publicBaseUrl = required.publicBaseUrl as string;
  if (/\.r2\.dev(\/|$)/i.test(publicBaseUrl)) {
    throw new StorageConfigError(
      "R2_PUBLIC_BASE_URL must be a configured custom domain, not a bare *.r2.dev URL.",
    );
  }

  return required as R2Config;
}

/** True if R2 is configured at all — callers use this to decide whether to
 * fall back to a local/dev path instead of throwing. */
export function isR2Configured(): boolean {
  try {
    resolveR2Config();
    return true;
  } catch {
    return false;
  }
}
