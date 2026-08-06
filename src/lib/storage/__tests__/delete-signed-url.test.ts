import { test } from "node:test";
import assert from "node:assert/strict";
import { S3Client } from "@aws-sdk/client-s3";
import { _resetR2ClientForTests } from "../client";
import { deleteAsset } from "../delete";
import { signedUrlForPrivateObject } from "../signed-url";

const REQUIRED_KEYS = [
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY",
  "R2_ENDPOINT", "R2_PUBLIC_BUCKET", "R2_PRIVATE_BUCKET", "R2_PUBLIC_BASE_URL",
];

function withFakeR2Env(run: () => Promise<void>) {
  const saved: Record<string, string | undefined> = {};
  for (const k of REQUIRED_KEYS) saved[k] = process.env[k];
  Object.assign(process.env, {
    R2_ACCOUNT_ID: "test-account",
    R2_ACCESS_KEY_ID: "test-key",
    R2_SECRET_ACCESS_KEY: "test-secret",
    R2_ENDPOINT: "https://test-account.r2.cloudflarestorage.com",
    R2_PUBLIC_BUCKET: "test-public-bucket",
    R2_PRIVATE_BUCKET: "test-private-bucket",
    R2_PUBLIC_BASE_URL: "https://files.dupyq.online",
  });
  _resetR2ClientForTests();
  return run().finally(() => {
    for (const k of REQUIRED_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
    _resetR2ClientForTests();
  });
}

function mockS3Send(t: import("node:test").TestContext, handler: (commandName: string, input: unknown) => unknown) {
  t.mock.method(S3Client.prototype, "send", async function (command: { constructor: { name: string }; input: unknown }) {
    return handler(command.constructor.name, command.input);
  });
}

test("deleteAsset sends a DeleteObjectCommand to the correct bucket", async (t) => {
  await withFakeR2Env(async () => {
    const calls: { commandName: string; input: unknown }[] = [];
    mockS3Send(t, (commandName, input) => {
      calls.push({ commandName, input });
      return {};
    });

    await deleteAsset("private", "backups/2026-08-06/staging.sql.gz");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].commandName, "DeleteObjectCommand");
    assert.equal((calls[0].input as { Bucket: string }).Bucket, "test-private-bucket");
  });
});

test("deleteAsset does not throw when the object is already gone (idempotent delete)", async (t) => {
  await withFakeR2Env(async () => {
    mockS3Send(t, () => {
      throw Object.assign(new Error("not found"), { $metadata: { httpStatusCode: 404 } });
    });
    await assert.doesNotReject(() => deleteAsset("public", "papers/already-gone.pdf"));
  });
});

test("deleteAsset rethrows a genuine non-404 error", async (t) => {
  await withFakeR2Env(async () => {
    mockS3Send(t, () => {
      throw Object.assign(new Error("access denied"), { $metadata: { httpStatusCode: 403 } });
    });
    await assert.rejects(() => deleteAsset("public", "papers/forbidden.pdf"));
  });
});

test("signedUrlForPrivateObject returns a URL and a matching expiry, capped at 24h", async (t) => {
  await withFakeR2Env(async () => {
    // getSignedUrl doesn't call client.send() directly (it signs locally),
    // but still constructs an S3Client — mocking send is harmless/unused here.
    mockS3Send(t, () => ({}));

    const result = await signedUrlForPrivateObject("backups/2026-08-06/staging.sql.gz", { expiresInSeconds: 999999 });
    assert.ok(result.url.length > 0);
    const expiresInMs = new Date(result.expiresAt).getTime() - Date.now();
    // Capped at 24h (86400s) even though 999999s was requested.
    assert.ok(expiresInMs <= 86_400_000 + 5000, "expiry must be capped at 24h");
    assert.ok(expiresInMs > 86_000_000, "expiry should be close to the 24h cap, not the tiny default");
  });
});
