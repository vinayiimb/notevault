// Pure planning logic — no I/O, no Prisma, no network — so it's fully unit
// testable. run.ts wires this up to a real ResourceRecord[] query and
// writes the manifest to disk.
import { buildObjectKey, slugSegment } from "@/lib/storage/paths";
import type { FileOrigin, MigrationManifest, PlannedMigration, ResourceRecord } from "./types";

export function classifyFileOrigin(fileUrl: string): FileOrigin {
  if (/^https?:\/\/[^/]*\.r2\.dev\//.test(fileUrl)) return "legacy-r2";
  if (/^https?:\/\/[^/]*\.r2\.cloudflarestorage\.com\//.test(fileUrl)) return "legacy-r2";
  if (/^https?:\/\/[^/]*\.public\.blob\.vercel-storage\.com\//.test(fileUrl)) return "vercel-blob";
  if (/^\/uploads\//.test(fileUrl)) return "local-path";
  if (fileUrl.startsWith("papers/") || fileUrl.startsWith("/papers/")) return "already-r2-new-layout";
  return "unknown";
}

export function targetKeyForResource(resource: ResourceRecord): string | null {
  if (!resource.year || !resource.programSlug || !resource.subjectSlug) return null;
  const category = resource.type === "PYQ" ? "papers" : "syllabus-files";
  return buildObjectKey(
    category,
    [resource.programSlug, `semester-${resource.termOrder}`, resource.subjectSlug, String(resource.year)],
    `${resource.id}.pdf`,
  );
}

/**
 * Builds the migration manifest for a batch of Resource rows. Duplicate
 * detection is by fileHash (Resource.fileHash is already SHA-256 of the
 * file's bytes, per prisma/schema.prisma's own comment) — the first
 * resource with a given hash is planned for migration, every later one
 * with the same hash is marked duplicate-skip and points at the first via
 * duplicateOfResourceId, so Checkpoint G never uploads the same bytes twice
 * even across different Resource rows.
 */
export function buildMigrationManifest(resources: ResourceRecord[]): MigrationManifest {
  const entries: PlannedMigration[] = [];
  const firstResourceIdByHash = new Map<string, string>();

  for (const resource of resources) {
    const origin = classifyFileOrigin(resource.fileUrl);

    if (origin === "already-r2-new-layout") {
      entries.push({
        resourceId: resource.id,
        currentFileUrl: resource.fileUrl,
        currentOrigin: origin,
        targetKey: resource.fileUrl.replace(/^\//, ""),
        targetBucket: "public",
        status: "already-migrated",
        reason: "fileUrl already matches the new deterministic papers/... layout",
        duplicateOfResourceId: null,
      });
      continue;
    }

    const targetKey = targetKeyForResource(resource);
    if (!targetKey) {
      entries.push({
        resourceId: resource.id,
        currentFileUrl: resource.fileUrl,
        currentOrigin: origin,
        targetKey: "",
        targetBucket: "public",
        status: "missing-metadata",
        reason: "Missing year, programSlug, or subjectSlug — cannot build a deterministic key",
        duplicateOfResourceId: null,
      });
      continue;
    }

    if (resource.fileHash) {
      const firstId = firstResourceIdByHash.get(resource.fileHash);
      if (firstId && firstId !== resource.id) {
        entries.push({
          resourceId: resource.id,
          currentFileUrl: resource.fileUrl,
          currentOrigin: origin,
          targetKey,
          targetBucket: "public",
          status: "duplicate-skip",
          reason: `Identical fileHash to already-planned resource ${firstId} — will not upload the same bytes twice`,
          duplicateOfResourceId: firstId,
        });
        continue;
      }
      firstResourceIdByHash.set(resource.fileHash, resource.id);
    }

    entries.push({
      resourceId: resource.id,
      currentFileUrl: resource.fileUrl,
      currentOrigin: origin,
      targetKey,
      targetBucket: "public",
      status: "to-migrate",
      reason: `Origin "${origin}" -> deterministic R2 key`,
      duplicateOfResourceId: null,
    });
  }

  return {
    generatedAt: new Date().toISOString(),
    totalResources: resources.length,
    toMigrate: entries.filter((e) => e.status === "to-migrate").length,
    alreadyMigrated: entries.filter((e) => e.status === "already-migrated").length,
    duplicateSkips: entries.filter((e) => e.status === "duplicate-skip").length,
    missingMetadata: entries.filter((e) => e.status === "missing-metadata").length,
    entries,
  };
}

// Re-exported so callers/tests don't need a separate import from
// src/lib/storage/paths for this one helper.
export { slugSegment };
