// S3-compatible client construction for Cloudflare R2. Deliberately not
// @vercel/blob — R2 is S3-API-compatible, so this (and everything else in
// src/lib/storage/) works unmodified against any other S3-compatible
// provider (AWS S3, MinIO, Backblaze B2's S3 endpoint, ...) if hosting ever
// moves off Cloudflare, per the portability goal of this migration wave.
import "server-only";
import { S3Client } from "@aws-sdk/client-s3";
import { resolveR2Config, type R2Config } from "./config";

let cachedClient: { client: S3Client; config: R2Config } | null = null;

export function getR2Client(): { client: S3Client; config: R2Config } {
  if (cachedClient) return cachedClient;
  const config = resolveR2Config();
  const client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
  cachedClient = { client, config };
  return cachedClient;
}

/** For tests only — clears the cached client so a test can inject its own
 * env vars / mocked S3Client between cases. */
export function _resetR2ClientForTests() {
  cachedClient = null;
}

/** Safe to log — bucket names only, never credentials or the endpoint (the
 * endpoint embeds the Cloudflare account id, which is treated as sensitive
 * alongside the actual keys). */
export function describeR2Config(config: R2Config): string {
  return `publicBucket=${config.publicBucket} privateBucket=${config.privateBucket}`;
}
