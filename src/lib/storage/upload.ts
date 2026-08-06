import "server-only";
import { createHash } from "node:crypto";
import { PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./client";
import { bucketKindForCategory } from "./config";
import { buildObjectKey } from "./paths";
import { publicUrlForKey } from "./public-url";
import { validateUploadInput } from "./validation";
import type { UploadInput, UploadResult } from "./types";

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

class UploadValidationError extends Error {
  constructor(public issues: { field: string; message: string }[]) {
    super(`Upload validation failed: ${issues.map((i) => `${i.field}: ${i.message}`).join("; ")}`);
  }
}

/** True if an object already exists at `key` in the given bucket — used for
 * duplicate detection / resumable-upload skip logic (Checkpoint G). Never
 * throws on a plain "not found"; only on a genuine connectivity/auth error. */
export async function objectExists(bucketKind: "public" | "private", key: string): Promise<boolean> {
  const { client, config } = getR2Client();
  const bucket = bucketKind === "public" ? config.publicBucket : config.privateBucket;
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err: unknown) {
    const name = (err as { name?: string })?.name;
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (name === "NotFound" || name === "NoSuchKey" || statusCode === 404) return false;
    throw err;
  }
}

/**
 * Validates, computes a checksum, and uploads bytes to the correct bucket
 * for the given category (papers/thumbnails/blog-images/syllabus-files ->
 * public bucket; database-backups/original-source-files/rejected-imports/
 * temp-admin-uploads -> private bucket — see config.ts's
 * bucketKindForCategory). Returns a public URL only for public-bucket
 * uploads; private objects are never given one (use signed-url.ts instead).
 *
 * Skips the actual PUT (but still returns a full UploadResult) if an object
 * already exists at the deterministic key and `overwrite` isn't set —
 * duplicate-safe by default, matching the deterministic-path design.
 */
export async function uploadAsset(input: UploadInput, options?: { overwrite?: boolean }): Promise<UploadResult> {
  const issues = validateUploadInput({
    category: input.category,
    fileName: input.fileName,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
  });
  if (issues.length > 0) throw new UploadValidationError(issues);

  const bucketKind = bucketKindForCategory(input.category);
  const key = buildObjectKey(input.category, input.pathSegments, input.fileName);
  const checksum = sha256Hex(input.bytes);

  const { client, config } = getR2Client();
  const bucketName = bucketKind === "public" ? config.publicBucket : config.privateBucket;

  if (!options?.overwrite && (await objectExists(bucketKind, key))) {
    return {
      bucket: bucketKind,
      key,
      publicUrl: bucketKind === "public" ? publicUrlForKey(key) : null,
      sizeBytes: input.bytes.byteLength,
      checksumSha256: checksum,
    };
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: input.bytes,
      ContentType: input.contentType,
      Metadata: { "sha256-checksum": checksum },
    }),
  );

  return {
    bucket: bucketKind,
    key,
    publicUrl: bucketKind === "public" ? publicUrlForKey(key) : null,
    sizeBytes: input.bytes.byteLength,
    checksumSha256: checksum,
  };
}
