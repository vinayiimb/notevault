import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

// Vercel's serverless functions have a read-only, ephemeral filesystem — a
// PDF written to public/uploads during one request is gone by the next
// (different instance, or wiped on the next deploy). Cloudflare R2 is the
// persistent store (moved off Vercel Blob after its 1GB Hobby-plan cap was
// hit). Vercel Blob support is kept only so deleteByUrl can still clean up
// any not-yet-migrated legacy URLs. Locally, with none of these configured,
// we fall back to writing straight into public/.
export function r2Enabled() {
  return !!(process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_ENDPOINT);
}

// Large PDFs should not travel through a Vercel Server Action body. In
// production, authorize a short-lived browser -> R2 PUT instead, then let a
// separate authenticated action finalize the database row. Local development
// and older Blob-only deployments continue to use saveUploadedFile().
export async function createDirectUploadTarget(key: string, contentType = "application/pdf") {
  if (!r2Enabled()) return null;
  const [{ PutObjectCommand }, { getSignedUrl }] = await Promise.all([
    import("@aws-sdk/client-s3"),
    import("@aws-sdk/s3-request-presigner"),
  ]);
  const client = await r2Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 15 * 60 },
  );
  return { uploadUrl, fileUrl: r2PublicUrl(key) };
}

export async function storedObjectSize(key: string): Promise<number | null> {
  if (!r2Enabled()) return null;
  const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
  const client = await r2Client();
  const result = await client.send(
    new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }),
  );
  return result.ContentLength ?? null;
}

function blobEnabled() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function r2Client() {
  const { S3Client } = await import("@aws-sdk/client-s3");
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });
}

function r2PublicUrl(key: string) {
  return `${process.env.R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
}

// Uploads bytes under `key` (e.g. "uploads/pyqs/<uuid>-file.pdf" or
// "images/hero-du.png") and returns a URL usable directly in <img src> / a
// download redirect: an absolute https URL on R2, or a "/uploads/..."
// site-relative path in local dev.
export async function putBytes(
  key: string,
  bytes: Buffer,
  options?: { allowOverwrite?: boolean }
): Promise<string> {
  void options; // R2 PutObject always overwrites; kept for signature parity with the old Blob call sites.

  if (r2Enabled()) {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await r2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: bytes,
      })
    );
    return r2PublicUrl(key);
  }

  if (blobEnabled()) {
    const { put } = await import("@vercel/blob");
    const blob = await put(key, bytes, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: options?.allowOverwrite ?? false,
    });
    return blob.url;
  }

  const dest = path.join(PUBLIC_ROOT, key);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  return `/${key}`;
}

// Deletes whatever putBytes previously returned — an R2 URL, a legacy Blob
// URL, or a site-relative local path, whichever this environment actually
// produced.
export async function deleteByUrl(url: string | null | undefined) {
  if (!url) return;

  if (r2Enabled() && process.env.R2_PUBLIC_URL && url.startsWith(process.env.R2_PUBLIC_URL)) {
    const key = url.slice(process.env.R2_PUBLIC_URL.length).replace(/^\//, "");
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await r2Client();
    await client
      .send(new DeleteObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }))
      .catch(() => {});
    return;
  }

  if (/^https?:\/\//.test(url)) {
    if (blobEnabled()) {
      const { del } = await import("@vercel/blob");
      await del(url).catch(() => {});
    }
    return;
  }

  await rm(path.join(PUBLIC_ROOT, url), { force: true }).catch(() => {});
}

// Reads back the bytes behind a putBytes URL — fetches over HTTP for a Blob
// URL, reads from disk for a local site-relative path.
export async function readBytesFromUrl(url: string): Promise<Uint8Array> {
  if (/^https?:\/\//.test(url)) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Could not fetch ${url}: ${res.status} ${res.statusText}`);
    return new Uint8Array(await res.arrayBuffer());
  }
  return new Uint8Array(await readFile(path.join(PUBLIC_ROOT, url)));
}

export async function saveUploadedFile(file: File, subdir: "notes" | "pyqs" | "failed") {
  const bytes = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  // Already unique per upload (random UUID prefix), so no collision handling needed.
  const fileName = `${crypto.randomUUID()}-${safeName}`;
  const fileUrl = await putBytes(`uploads/${subdir}/${fileName}`, bytes);

  return { fileUrl, fileName: file.name, fileSize: bytes.byteLength };
}

export async function hashFile(file: File) {
  const bytes = Buffer.from(await file.arrayBuffer());
  return createHash("sha256").update(bytes).digest("hex");
}
