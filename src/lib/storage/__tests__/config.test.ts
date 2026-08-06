import { test } from "node:test";
import assert from "node:assert/strict";
import { bucketKindForCategory, resolveR2Config, isR2Configured, StorageConfigError } from "../config";

test("bucketKindForCategory routes each category to the right bucket", () => {
  assert.equal(bucketKindForCategory("papers"), "public");
  assert.equal(bucketKindForCategory("thumbnails"), "public");
  assert.equal(bucketKindForCategory("blog-images"), "public");
  assert.equal(bucketKindForCategory("syllabus-files"), "public");
  assert.equal(bucketKindForCategory("database-backups"), "private");
  assert.equal(bucketKindForCategory("original-source-files"), "private");
  assert.equal(bucketKindForCategory("rejected-imports"), "private");
  assert.equal(bucketKindForCategory("temp-admin-uploads"), "private");
});

const REQUIRED_KEYS = [
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET", "R2_PUBLIC_BASE_URL",
];

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const saved: Record<string, string | undefined> = {};
  for (const k of REQUIRED_KEYS) saved[k] = process.env[k];
  for (const k of REQUIRED_KEYS) delete process.env[k];
  Object.assign(process.env, vars);
  try {
    run();
  } finally {
    for (const k of REQUIRED_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

test("resolveR2Config throws StorageConfigError when required vars are missing, never partially", () => {
  withEnv({}, () => {
    assert.throws(() => resolveR2Config(), StorageConfigError);
    assert.equal(isR2Configured(), false);
  });
});

test("resolveR2Config throws when R2_PUBLIC_BASE_URL is a bare r2.dev URL", () => {
  withEnv(
    {
      R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret",
      R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      R2_PUBLIC_BUCKET: "pub", R2_PRIVATE_BUCKET: "priv",
      R2_PUBLIC_BASE_URL: "https://pub-abc123.r2.dev",
    },
    () => {
      assert.throws(() => resolveR2Config(), StorageConfigError);
    },
  );
});

test("resolveR2Config succeeds with a full, valid custom-domain config", () => {
  withEnv(
    {
      R2_ACCOUNT_ID: "acct", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret",
      R2_ENDPOINT: "https://acct.r2.cloudflarestorage.com",
      R2_PUBLIC_BUCKET: "pub", R2_PRIVATE_BUCKET: "priv",
      R2_PUBLIC_BASE_URL: "https://files.dupyq.online",
    },
    () => {
      const config = resolveR2Config();
      assert.equal(config.publicBucket, "pub");
      assert.equal(config.privateBucket, "priv");
      assert.equal(isR2Configured(), true);
    },
  );
});
