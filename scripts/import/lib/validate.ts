// Per-row validation — pure functions, no DB access, no AI. Every source
// row is validated before it's ever considered for a database write.

export type ValidationIssue = { field: string; message: string };
export type ValidationResult = { ok: boolean; issues: ValidationIssue[] };

export function validateYear(year: unknown, field = "year"): ValidationIssue[] {
  if (year == null || year === "") return [];
  const n = Number(year);
  if (!Number.isFinite(n)) return [{ field, message: `"${year}" is not a number` }];
  if (n < 1990 || n > 2035) return [{ field, message: `${n} is outside the plausible range 1990-2035` }];
  return [];
}

export function validateSemesterOrder(order: unknown, field = "semester"): ValidationIssue[] {
  const n = Number(order);
  if (!Number.isInteger(n) || n < 1 || n > 8) {
    return [{ field, message: `"${order}" did not resolve to an integer 1-8` }];
  }
  return [];
}

const KNOWN_PAPER_TYPES = new Set([
  "DSC/CORE", "DSC", "CORE", "DSE", "GE", "SEC", "AECC", "AEC", "VAC", "VOC", "MINOR", "MAJOR",
]);

export function validatePaperType(type: unknown, field = "type"): ValidationIssue[] {
  if (type == null || type === "") return [];
  const normalized = String(type).trim().toUpperCase();
  if (!KNOWN_PAPER_TYPES.has(normalized)) {
    return [{ field, message: `"${type}" is not a recognized paper type (warning only, not rejected)` }];
  }
  return [];
}

export function validateUrl(url: unknown, field = "url"): ValidationIssue[] {
  if (url == null || url === "") return [{ field, message: "missing" }];
  try {
    const u = new URL(String(url));
    if (u.protocol !== "https:" && u.protocol !== "http:") {
      return [{ field, message: `unexpected protocol "${u.protocol}"` }];
    }
    return [];
  } catch {
    return [{ field, message: `"${url}" is not a valid URL` }];
  }
}

// This wave's sources (MASTER_SYLLABUS_ROWS, exam-session Drive links) don't
// reference R2 objects directly — they're external URLs (Google Drive) or
// have no file at all. This validator exists for the sources that DO
// reference R2 (a future wave importing Resource rows with fileUrl pointing
// at R2_PUBLIC_URL), matching the key format written by
// src/lib/storage.ts's saveUploadedFile(): uploads/{subdir}/{subjectId?}/{uuid}-{filename}
const R2_KEY_PATTERN = /^uploads\/(notes|pyqs|failed|term-papers|feedback)\/(?:[A-Za-z0-9_-]+\/)?[0-9a-fA-F-]{36}-.+$/;

export function validateR2ObjectKey(key: unknown, field = "r2Key"): ValidationIssue[] {
  if (key == null || key === "") return [{ field, message: "missing" }];
  if (!R2_KEY_PATTERN.test(String(key))) {
    return [{ field, message: `"${key}" does not match the existing storage key format (see src/lib/storage.ts)` }];
  }
  return [];
}

export function validateNonEmptyString(value: unknown, field: string): ValidationIssue[] {
  if (typeof value !== "string" || value.trim().length === 0) {
    return [{ field, message: "missing or empty" }];
  }
  return [];
}

export function combineValidation(...groups: ValidationIssue[][]): ValidationResult {
  const issues = groups.flat();
  return { ok: issues.length === 0, issues };
}
