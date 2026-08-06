// Deterministic object-key construction. Same category+segments always
// produces the same key — that determinism is what makes the migration
// planner's "skip already-uploaded matching objects" and duplicate
// detection possible (Checkpoint G).
import { sanitizeFileName, validateR2ObjectKey } from "./validation";
import type { AssetCategory } from "./types";

/** Matches deterministicSlug()'s output shape in scripts/import/lib/normalize.ts
 * (lowercase, hyphen-separated) without importing it — this module must stay
 * usable from both server components and the importer without creating a
 * src/lib <-> scripts/import cross-dependency in either direction. */
export function slugSegment(value: string): string {
  const slug = value
    .normalize("NFC")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "untitled";
}

const CATEGORY_PREFIX: Record<AssetCategory, string> = {
  papers: "papers",
  thumbnails: "thumbnails",
  "blog-images": "blog-images",
  "syllabus-files": "syllabus",
  "database-backups": "backups",
  "original-source-files": "original-source-files",
  "rejected-imports": "rejected-imports",
  "temp-admin-uploads": "temp-admin-uploads",
};

/** papers/{programmeSlug}/{termSlug}/{subjectSlug}/{year}/{paperId}.pdf,
 * and the equivalent deterministic shape for every other category —
 * pathSegments are joined as-is (already slugSegment()'d by the caller),
 * fileName is sanitized here. */
export function buildObjectKey(category: AssetCategory, pathSegments: string[], fileName: string): string {
  const safeSegments = pathSegments.map((s) => slugSegment(s)).filter(Boolean);
  const safeFileName = sanitizeFileName(fileName);
  const key = [CATEGORY_PREFIX[category], ...safeSegments, safeFileName].join("/");

  const issues = validateR2ObjectKey(key);
  if (issues.length > 0) {
    throw new Error(`buildObjectKey produced an invalid key "${key}": ${issues.map((i) => i.message).join("; ")}`);
  }
  return key;
}

/** Deterministic key for a question paper — the canonical example from the
 * task spec: papers/{programmeSlug}/{termSlug}/{subjectSlug}/{year}/{paperId}.pdf */
export function buildPaperKey(params: {
  programmeSlug: string;
  termSlug: string;
  subjectSlug: string;
  year: number | string;
  paperId: string;
}): string {
  return buildObjectKey(
    "papers",
    [params.programmeSlug, params.termSlug, params.subjectSlug, String(params.year)],
    `${params.paperId}.pdf`,
  );
}
