import "server-only";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getR2Client } from "./client";
import type { SignedUrlResult } from "./types";

const DEFAULT_EXPIRY_SECONDS = 15 * 60;
const MAX_EXPIRY_SECONDS = 24 * 60 * 60;

/** Short-lived signed GET URL for a PRIVATE-bucket object (database
 * backups, original source files, rejected-import files, temp admin
 * uploads). Public-bucket assets (papers, thumbnails, etc.) never need
 * this — they're served directly via public-url.ts's custom domain. */
export async function signedUrlForPrivateObject(
  key: string,
  options?: { expiresInSeconds?: number },
): Promise<SignedUrlResult> {
  const expiresInSeconds = Math.min(options?.expiresInSeconds ?? DEFAULT_EXPIRY_SECONDS, MAX_EXPIRY_SECONDS);
  const { client, config } = getR2Client();
  const url = await getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: config.privateBucket, Key: key }),
    { expiresIn: expiresInSeconds },
  );
  return { url, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}
