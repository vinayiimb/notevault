import { mkdir, writeFile, rm, readFile } from "fs/promises";
import { createHash } from "crypto";
import path from "path";

const PUBLIC_ROOT = path.join(process.cwd(), "public");

// Vercel's serverless functions have a read-only, ephemeral filesystem — a
// PDF written to public/uploads during one request is gone by the next
// (different instance, or wiped on the next deploy). Vercel Blob is the
// persistent alternative. Locally there's no BLOB_READ_WRITE_TOKEN, so we
// fall back to writing straight into public/ — same behavior as before.
function blobEnabled() {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

// Uploads bytes under `key` (e.g. "uploads/pyqs/<uuid>-file.pdf" or
// "images/hero-du.png") and returns a URL usable directly in <img src> / a
// download redirect: an absolute https URL on Blob, or a "/uploads/..."
// site-relative path in local dev.
export async function putBytes(
  key: string,
  bytes: Buffer,
  options?: { allowOverwrite?: boolean }
): Promise<string> {
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

// Deletes whatever putBytes previously returned — a Blob URL or a
// site-relative local path, whichever this environment actually produced.
export async function deleteByUrl(url: string | null | undefined) {
  if (!url) return;
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
