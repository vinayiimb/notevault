// Phase 3 Task 4 — storage verification/upload against the LIVE R2 bucket
// (the only bucket that exists — no distinct staging R2 bucket has been
// provisioned yet, see docs/PHASE_2F_R2_STORAGE_MIGRATION.md). This module
// only ever:
//   - reads (HeadObject/ListObjectsV2) to check what already exists
//   - PUTs a brand-new object at a key that does not already exist
// It never deletes, overwrites, or renames anything, and it never uploads
// anything not resolvable to a real local file with real bytes. Every
// upload uses the app's own currently-live canonical key convention
// (src/lib/actions.ts's prepareDirectResourceUploadAction:
// `uploads/pyqs/<subjectId>/<uuid>-<safeName>`), scoped to the REAL,
// resolved (staging) Subject id — never the old export's foreign subjectId.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import type { PlannedResourceRecord } from "../sources/resources";
import type { StorageResolution } from "./resource-plan";

const LOCAL_UPLOAD_ROOT = "public/uploads";

export type StorageDecision =
  | { classification: "EXISTS_IN_R2"; naturalKey: string; key: string; fileUrl: string }
  | { classification: "UPLOADED"; naturalKey: string; key: string; fileUrl: string; sha256: string; bytesUploaded: number }
  | { classification: "NEEDS_UPLOAD"; naturalKey: string; reason: string }
  | { classification: "MISSING_SOURCE"; naturalKey: string; reason: string }
  | { classification: "STORAGE_UNVERIFIED"; naturalKey: string; reason: string };

export type StorageAuditReport = {
  bucketConfigured: boolean;
  decisions: StorageDecision[];
};

function localPathForFileUrl(fileUrl: string): string | null {
  // Old export fileUrls look like "/uploads/pyqs/<uuid>-<name>.pdf" or
  // "/uploads/failed/...". Map that straight onto public/uploads/... — this
  // machine's local checkout is the only known source of the actual bytes
  // for this wave (see plan doc §2/§3).
  if (!fileUrl.startsWith("/uploads/")) return null;
  const rel = fileUrl.replace(/^\/uploads\//, "");
  // Reject any path-traversal attempt outright — never trust the export
  // blindly even though it's a local, non-adversarial file.
  if (rel.includes("..")) return null;
  return path.join(LOCAL_UPLOAD_ROOT, rel);
}

async function sha256File(filePath: string): Promise<string> {
  const buf = readFileSync(filePath);
  return createHash("sha256").update(buf).digest("hex");
}

/**
 * Checks/uploads storage for every subject-resolved candidate. Read-only
 * (HeadObject) for existence checks; a PUT only happens for a record that
 * is (a) subject-resolved, (b) has a real local file with matching size,
 * and (c) does not already have an object at its canonical key. Returns a
 * per-record decision plus a ready-to-use StorageResolution for
 * computeResourceImportPlan.
 */
export async function resolveResourceStorage(
  resolvedSubjects: Map<string, { record: PlannedResourceRecord; resolvedSubjectId: string }>,
  options: { allowUpload: boolean; maxUploads?: number },
): Promise<{ audit: StorageAuditReport; resolution: StorageResolution }> {
  const decisions: StorageDecision[] = [];
  const confirmedByNaturalKey: StorageResolution["confirmedByNaturalKey"] = new Map();

  const hasR2Config = Boolean(
    process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT && process.env.R2_BUCKET_NAME && process.env.R2_PUBLIC_URL,
  );

  if (!hasR2Config) {
    for (const [naturalKey] of resolvedSubjects) {
      decisions.push({ classification: "STORAGE_UNVERIFIED", naturalKey, reason: "R2 environment variables are not fully configured in this process." });
    }
    return { audit: { bucketConfigured: false, decisions }, resolution: { confirmedByNaturalKey } };
  }

  const { S3Client, HeadObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");
  const client = new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID!, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY! },
  });
  const bucket = process.env.R2_BUCKET_NAME!;
  const publicUrl = process.env.R2_PUBLIC_URL!.replace(/\/$/, "");

  let uploadsDone = 0;
  const maxUploads = options.maxUploads ?? Infinity;

  for (const [naturalKey, { record, resolvedSubjectId }] of resolvedSubjects) {
    const localPath = localPathForFileUrl(record.data.fileUrl);
    if (!localPath || !existsSync(localPath)) {
      decisions.push({ classification: "MISSING_SOURCE", naturalKey, reason: `No local file found for fileUrl "${record.data.fileUrl}" (expected at "${localPath ?? "n/a"}").` });
      continue;
    }
    const stat = statSync(localPath);
    if (stat.size !== record.data.fileSize) {
      decisions.push({
        classification: "MISSING_SOURCE",
        naturalKey,
        reason: `Local file size (${stat.size}) does not match the export's recorded fileSize (${record.data.fileSize}) for "${localPath}" — refusing to trust a mismatched file.`,
      });
      continue;
    }

    // Canonical, currently-live key convention (src/lib/actions.ts
    // prepareDirectResourceUploadAction) — subject-scoped, not
    // program/semester-scoped (an older, no-longer-written scheme also
    // exists live in the bucket under a different prefix; this wave writes
    // only the current convention).
    const key = `uploads/pyqs/${resolvedSubjectId}/${path.basename(localPath)}`;
    const fileUrl = `${publicUrl}/${key}`;

    try {
      const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
      if (head.ContentLength === stat.size) {
        decisions.push({ classification: "EXISTS_IN_R2", naturalKey, key, fileUrl });
        confirmedByNaturalKey.set(naturalKey, { fileUrl, fileHash: record.data.fileHash });
        continue;
      }
      // A same-key object exists but with a different size — never treat as
      // safe/idempotent to overwrite; flag for a human, don't guess.
      decisions.push({ classification: "STORAGE_UNVERIFIED", naturalKey, reason: `An object already exists at "${key}" but its size (${head.ContentLength}) does not match the local file (${stat.size}) — not overwritten.` });
      continue;
    } catch (err) {
      // NotFound is expected for a brand-new object — anything else is a
      // real error, not treated as "needs upload".
      const isNotFound = err instanceof Error && (err.name === "NotFound" || err.name === "NoSuchKey" || /404|NotFound/.test(err.message));
      if (!isNotFound) {
        decisions.push({ classification: "STORAGE_UNVERIFIED", naturalKey, reason: `HeadObject check failed unexpectedly: ${err instanceof Error ? err.message : String(err)}` });
        continue;
      }
    }

    if (!options.allowUpload || uploadsDone >= maxUploads) {
      decisions.push({ classification: "NEEDS_UPLOAD", naturalKey, reason: `No object exists at "${key}" yet. Real local file confirmed present (${stat.size} bytes) — ready to upload, but this run did not (allowUpload=${options.allowUpload}, cap reached=${uploadsDone >= maxUploads}).` });
      continue;
    }

    const sha256 = await sha256File(localPath);
    const body = readFileSync(localPath);
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: "application/pdf" }));

    // Verify the object is actually readable back before trusting it.
    const verify = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (verify.ContentLength !== stat.size) {
      decisions.push({ classification: "STORAGE_UNVERIFIED", naturalKey, reason: `Uploaded to "${key}" but post-upload HeadObject size (${verify.ContentLength}) did not match the local file (${stat.size}) — not treated as confirmed.` });
      continue;
    }

    uploadsDone++;
    decisions.push({ classification: "UPLOADED", naturalKey, key, fileUrl, sha256, bytesUploaded: stat.size });
    confirmedByNaturalKey.set(naturalKey, { fileUrl, fileHash: sha256 });
  }

  return { audit: { bucketConfigured: true, decisions }, resolution: { confirmedByNaturalKey } };
}
