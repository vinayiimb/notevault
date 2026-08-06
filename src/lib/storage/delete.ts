import "server-only";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client } from "./client";
import type { StorageBucketKind } from "./types";

/** Deletes an object. Never throws on "already gone" — deletion is
 * idempotent by design, matching the rest of this migration's idempotency
 * requirements. */
export async function deleteAsset(bucketKind: StorageBucketKind, key: string): Promise<void> {
  const { client, config } = getR2Client();
  const bucket = bucketKind === "public" ? config.publicBucket : config.privateBucket;
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key })).catch((err: unknown) => {
    const statusCode = (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
    if (statusCode === 404) return;
    throw err;
  });
}
