import { test } from "node:test";
import assert from "node:assert/strict";
import { S3Client } from "@aws-sdk/client-s3";
import { _resetR2ClientForTests } from "../client";
import { uploadAsset, objectExists, sha256Hex } from "../upload";

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

/** Mocks S3Client.prototype.send for the duration of one test — a
 * dependency-free stand-in for aws-sdk-client-mock, sufficient for this
 * module's needs (command-name-keyed canned responses). */
function mockS3Send(t: import("node:test").TestContext, handler: (commandName: string, input: unknown) => unknown) {
  t.mock.method(S3Client.prototype, "send", async function (this: unknown, command: { constructor: { name: string }; input: unknown }) {
    return handler(command.constructor.name, command.input);
  });
}

test("uploadAsset uploads a valid PDF to the public bucket and returns a public URL", async (t) => {
  await withFakeR2Env(async () => {
    const calls: { commandName: string; input: unknown }[] = [];
    mockS3Send(t, (commandName, input) => {
      calls.push({ commandName, input });
      if (commandName === "HeadObjectCommand") {
        const err = Object.assign(new Error("not found"), { name: "NotFound" });
        throw err;
      }
      return {};
    });

    const bytes = new TextEncoder().encode("%PDF-1.4 fake pdf bytes");
    const result = await uploadAsset({
      category: "papers",
      pathSegments: ["bcom-hons", "semester-5", "financial-management", "2024"],
      fileName: "paper.pdf",
      bytes,
      contentType: "application/pdf",
    });

    assert.equal(result.bucket, "public");
    assert.equal(result.key, "papers/bcom-hons/semester-5/financial-management/2024/paper.pdf");
    assert.equal(result.publicUrl, "https://files.dupyq.online/papers/bcom-hons/semester-5/financial-management/2024/paper.pdf");
    assert.equal(result.checksumSha256, sha256Hex(bytes));

    const putCall = calls.find((c) => c.commandName === "PutObjectCommand");
    assert.ok(putCall, "PutObjectCommand must have been sent");
    assert.equal((putCall!.input as { Bucket: string }).Bucket, "test-public-bucket");
  });
});

test("uploadAsset routes a private-category asset to the private bucket with no public URL", async (t) => {
  await withFakeR2Env(async () => {
    mockS3Send(t, (commandName) => {
      if (commandName === "HeadObjectCommand") throw Object.assign(new Error("not found"), { name: "NotFound" });
      return {};
    });

    const result = await uploadAsset({
      category: "database-backups",
      pathSegments: ["2026-08-06"],
      fileName: "staging-backup.sql.gz",
      bytes: new TextEncoder().encode("fake gzip bytes"),
      contentType: "application/gzip",
    });

    assert.equal(result.bucket, "private");
    assert.equal(result.publicUrl, null);
  });
});

test("uploadAsset rejects invalid input before ever calling S3", async (t) => {
  await withFakeR2Env(async () => {
    let sendCalled = false;
    mockS3Send(t, () => {
      sendCalled = true;
      return {};
    });

    await assert.rejects(() =>
      uploadAsset({
        category: "papers",
        pathSegments: ["bcom-hons"],
        fileName: "malware.exe",
        bytes: new TextEncoder().encode("x"),
        contentType: "application/x-msdownload",
      }),
    );
    assert.equal(sendCalled, false, "S3 must never be called for invalid input");
  });
});

test("uploadAsset skips the PUT when an identical-key object already exists (duplicate-safe by default)", async (t) => {
  await withFakeR2Env(async () => {
    const calls: string[] = [];
    mockS3Send(t, (commandName) => {
      calls.push(commandName);
      if (commandName === "HeadObjectCommand") return {}; // exists
      return {};
    });

    await uploadAsset({
      category: "papers",
      pathSegments: ["bcom-hons", "semester-5"],
      fileName: "paper.pdf",
      bytes: new TextEncoder().encode("%PDF fake"),
      contentType: "application/pdf",
    });

    assert.ok(calls.includes("HeadObjectCommand"));
    assert.ok(!calls.includes("PutObjectCommand"), "must not re-upload when the object already exists");
  });
});

test("uploadAsset re-uploads when overwrite: true is passed, even if the object exists", async (t) => {
  await withFakeR2Env(async () => {
    const calls: string[] = [];
    mockS3Send(t, (commandName) => {
      calls.push(commandName);
      return {};
    });

    await uploadAsset(
      {
        category: "papers",
        pathSegments: ["bcom-hons", "semester-5"],
        fileName: "paper.pdf",
        bytes: new TextEncoder().encode("%PDF fake"),
        contentType: "application/pdf",
      },
      { overwrite: true },
    );

    assert.ok(calls.includes("PutObjectCommand"), "overwrite: true must always PUT");
  });
});

test("objectExists returns false on a 404/NotFound and true on success, and rethrows other errors", async (t) => {
  await withFakeR2Env(async () => {
    mockS3Send(t, () => {
      throw Object.assign(new Error("not found"), { name: "NotFound" });
    });
    assert.equal(await objectExists("public", "papers/does/not/exist.pdf"), false);
  });

  await withFakeR2Env(async () => {
    mockS3Send(t, () => ({}));
    assert.equal(await objectExists("public", "papers/exists.pdf"), true);
  });

  await withFakeR2Env(async () => {
    mockS3Send(t, () => {
      throw new Error("connection reset");
    });
    await assert.rejects(() => objectExists("public", "papers/whatever.pdf"));
  });
});
