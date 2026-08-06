import { test } from "node:test";
import assert from "node:assert/strict";
import { classifyFileOrigin, targetKeyForResource, buildMigrationManifest } from "../lib/plan";
import type { ResourceRecord } from "../lib/types";

function makeResource(overrides: Partial<ResourceRecord> = {}): ResourceRecord {
  return {
    id: "res1",
    type: "PYQ",
    fileUrl: "https://old-bucket.r2.dev/uploads/pyqs/abc-paper.pdf",
    fileName: "paper.pdf",
    fileSize: 1024,
    fileHash: "hash1",
    year: 2024,
    programSlug: "bcom-hons",
    termOrder: 5,
    subjectSlug: "financial-management",
    ...overrides,
  };
}

test("classifyFileOrigin recognizes every known origin shape", () => {
  assert.equal(classifyFileOrigin("https://pub-abc123.r2.dev/uploads/pyqs/x.pdf"), "legacy-r2");
  assert.equal(classifyFileOrigin("https://acct.r2.cloudflarestorage.com/bucket/x.pdf"), "legacy-r2");
  assert.equal(classifyFileOrigin("https://abc123.public.blob.vercel-storage.com/x.pdf"), "vercel-blob");
  assert.equal(classifyFileOrigin("/uploads/pyqs/x.pdf"), "local-path");
  assert.equal(classifyFileOrigin("/papers/bcom-hons/semester-5/x/2024/res1.pdf"), "already-r2-new-layout");
  assert.equal(classifyFileOrigin("papers/bcom-hons/semester-5/x/2024/res1.pdf"), "already-r2-new-layout");
  assert.equal(classifyFileOrigin("something-weird"), "unknown");
});

test("targetKeyForResource builds a deterministic papers/... key for a PYQ", () => {
  const key = targetKeyForResource(makeResource());
  assert.equal(key, "papers/bcom-hons/semester-5/financial-management/2024/res1.pdf");
});

test("targetKeyForResource builds a syllabus-files/... key for NOTES", () => {
  const key = targetKeyForResource(makeResource({ type: "NOTES" }));
  assert.equal(key, "syllabus/bcom-hons/semester-5/financial-management/2024/res1.pdf");
});

test("targetKeyForResource returns null when required metadata is missing", () => {
  assert.equal(targetKeyForResource(makeResource({ year: null })), null);
  assert.equal(targetKeyForResource(makeResource({ programSlug: "" })), null);
  assert.equal(targetKeyForResource(makeResource({ subjectSlug: "" })), null);
});

test("buildMigrationManifest marks an already-new-layout fileUrl as already-migrated", () => {
  const manifest = buildMigrationManifest([
    makeResource({ fileUrl: "/papers/bcom-hons/semester-5/financial-management/2024/res1.pdf" }),
  ]);
  assert.equal(manifest.alreadyMigrated, 1);
  assert.equal(manifest.toMigrate, 0);
  assert.equal(manifest.entries[0].status, "already-migrated");
});

test("buildMigrationManifest plans a legacy-URL resource for migration", () => {
  const manifest = buildMigrationManifest([makeResource()]);
  assert.equal(manifest.toMigrate, 1);
  assert.equal(manifest.entries[0].targetKey, "papers/bcom-hons/semester-5/financial-management/2024/res1.pdf");
  assert.equal(manifest.entries[0].currentOrigin, "legacy-r2");
});

test("buildMigrationManifest flags missing metadata instead of guessing a key", () => {
  const manifest = buildMigrationManifest([makeResource({ year: null })]);
  assert.equal(manifest.missingMetadata, 1);
  assert.equal(manifest.entries[0].targetKey, "");
});

test("buildMigrationManifest detects duplicate bytes by fileHash and only plans the first occurrence for upload", () => {
  const manifest = buildMigrationManifest([
    makeResource({ id: "res1", fileHash: "same-hash" }),
    makeResource({ id: "res2", fileHash: "same-hash", subjectSlug: "other-subject" }),
  ]);
  assert.equal(manifest.toMigrate, 1);
  assert.equal(manifest.duplicateSkips, 1);
  const dup = manifest.entries.find((e) => e.resourceId === "res2")!;
  assert.equal(dup.status, "duplicate-skip");
  assert.equal(dup.duplicateOfResourceId, "res1");
});

test("buildMigrationManifest does not treat different-hash resources as duplicates", () => {
  const manifest = buildMigrationManifest([
    makeResource({ id: "res1", fileHash: "hash-a" }),
    makeResource({ id: "res2", fileHash: "hash-b", subjectSlug: "other-subject" }),
  ]);
  assert.equal(manifest.toMigrate, 2);
  assert.equal(manifest.duplicateSkips, 0);
});

test("buildMigrationManifest treats resources with no fileHash as independent (never falsely deduped)", () => {
  const manifest = buildMigrationManifest([
    makeResource({ id: "res1", fileHash: null }),
    makeResource({ id: "res2", fileHash: null, subjectSlug: "other-subject" }),
  ]);
  assert.equal(manifest.toMigrate, 2);
  assert.equal(manifest.duplicateSkips, 0);
});

test("buildMigrationManifest counts sum to totalResources", () => {
  const manifest = buildMigrationManifest([
    makeResource({ id: "res1" }),
    makeResource({ id: "res2", fileUrl: "/papers/bcom-hons/semester-5/financial-management/2024/res2.pdf" }),
    makeResource({ id: "res3", year: null }),
    makeResource({ id: "res4", fileHash: "hash1" }), // duplicate of res1
  ]);
  assert.equal(manifest.totalResources, 4);
  assert.equal(
    manifest.toMigrate + manifest.alreadyMigrated + manifest.duplicateSkips + manifest.missingMetadata,
    4,
  );
});
