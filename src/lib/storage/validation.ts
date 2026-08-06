// Upload-input validation: MIME/size limits, filename sanitization, path
// traversal / executable-upload prevention. Pure functions, no I/O — easy
// to unit test exhaustively.
import type { AssetCategory, ValidationError } from "./types";

const ALLOWED_MIME_BY_CATEGORY: Record<AssetCategory, string[]> = {
  papers: ["application/pdf"],
  "syllabus-files": ["application/pdf"],
  thumbnails: ["image/png", "image/jpeg", "image/webp"],
  "blog-images": ["image/png", "image/jpeg", "image/webp"],
  "database-backups": ["application/gzip", "application/x-gzip", "application/octet-stream"],
  "original-source-files": [
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ],
  "rejected-imports": ["text/csv", "application/json"],
  "temp-admin-uploads": ["application/pdf", "image/png", "image/jpeg", "image/webp"],
};

const MAX_BYTES_BY_CATEGORY: Record<AssetCategory, number> = {
  papers: 50 * 1024 * 1024, // 50MB — a scanned question paper PDF
  "syllabus-files": 50 * 1024 * 1024,
  thumbnails: 5 * 1024 * 1024,
  "blog-images": 10 * 1024 * 1024,
  "database-backups": 2 * 1024 * 1024 * 1024, // 2GB
  "original-source-files": 200 * 1024 * 1024,
  "rejected-imports": 20 * 1024 * 1024,
  "temp-admin-uploads": 50 * 1024 * 1024,
};

// Executables/scripts/archives that could mask an executable — defense in
// depth on top of the MIME allowlist above (a spoofed Content-Type header
// alone should never be trusted, but this catches an obviously wrong
// extension even if MIME validation is bypassed upstream).
const DISALLOWED_EXTENSIONS = [
  ".exe", ".dll", ".so", ".dylib", ".sh", ".bash", ".zsh", ".bat", ".cmd", ".ps1",
  ".php", ".jsp", ".asp", ".aspx", ".js", ".mjs", ".cjs", ".py", ".rb", ".pl",
  ".jar", ".msi", ".app", ".deb", ".rpm", ".apk",
];

export function validateMimeType(category: AssetCategory, contentType: string): ValidationError[] {
  const allowed = ALLOWED_MIME_BY_CATEGORY[category];
  if (!allowed.includes(contentType.toLowerCase())) {
    return [{ field: "contentType", message: `"${contentType}" is not allowed for category "${category}" (allowed: ${allowed.join(", ")})` }];
  }
  return [];
}

export function validateFileSize(category: AssetCategory, sizeBytes: number): ValidationError[] {
  const max = MAX_BYTES_BY_CATEGORY[category];
  if (sizeBytes <= 0) return [{ field: "sizeBytes", message: "File is empty." }];
  if (sizeBytes > max) {
    return [{ field: "sizeBytes", message: `${sizeBytes} bytes exceeds the ${max} byte limit for category "${category}".` }];
  }
  return [];
}

/** Strips path separators, null bytes, and anything but a conservative safe
 * character set — prevents both path traversal ("../../etc/passwd") and
 * accidental key-structure corruption from a filename containing "/". */
export function sanitizeFileName(rawName: string): string {
  const base = rawName
    .normalize("NFC")
    .replace(/[\\/]/g, "_")
    .replace(/\0/g, "")
    .replace(/^\.+/, "") // no leading dots (hidden files / ".." traversal seeds)
    .trim();
  const safe = base.replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 200);
  return safe || "file";
}

export function validateNoExecutableExtension(fileName: string): ValidationError[] {
  const lower = fileName.toLowerCase();
  const hit = DISALLOWED_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (hit) return [{ field: "fileName", message: `File extension "${hit}" is not allowed.` }];
  return [];
}

/** Every object key this module writes must match this shape — segments
 * joined by "/", each already sanitized, no leading slash, no ".." anywhere.
 * Deliberately a different (broader, deterministic-path-shaped) pattern
 * from scripts/import/lib/validate.ts's own validateR2ObjectKey, which
 * checks the legacy "uploads/{subdir}/{uuid}-{name}" format written by
 * src/lib/storage.ts::saveUploadedFile — two independent validators for two
 * independent key schemes, not a shared/duplicated one. The importer must
 * never import application code (src/lib/*) per Phase 2C item 4, so a
 * literal shared function isn't an option here even if the shapes matched. */
const OBJECT_KEY_PATTERN = /^[a-z0-9][a-z0-9._/-]*[a-z0-9]$/i;

export function validateR2ObjectKey(key: string): ValidationError[] {
  const issues: ValidationError[] = [];
  if (!key || key.length > 800) issues.push({ field: "key", message: "Key must be 1-800 characters." });
  if (key.includes("..")) issues.push({ field: "key", message: 'Key must not contain ".." (path traversal).' });
  if (key.startsWith("/") || key.endsWith("/")) issues.push({ field: "key", message: "Key must not start or end with \"/\"." });
  if (key && !OBJECT_KEY_PATTERN.test(key)) issues.push({ field: "key", message: "Key contains characters outside the safe set [A-Za-z0-9._/-]." });
  return issues;
}

export function validateUploadInput(input: {
  category: AssetCategory;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}): ValidationError[] {
  return [
    ...validateMimeType(input.category, input.contentType),
    ...validateFileSize(input.category, input.sizeBytes),
    ...validateNoExecutableExtension(input.fileName),
  ];
}
