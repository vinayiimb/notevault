import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveImportTarget, describeTarget, TargetGuardError } from "../lib/target-guard";

// NODE_ENV is typed read-only by Next.js's env augmentation; go through a
// loosely-typed alias to flip it in tests (same pattern as
// src/lib/__tests__/query-diagnostics.test.ts from Phase 2A).
const env = process.env as Record<string, string | undefined>;

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  const original: Record<string, string | undefined> = {};
  for (const key of Object.keys(vars)) original[key] = env[key];
  try {
    for (const [key, value] of Object.entries(vars)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    fn();
  } finally {
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
  }
}

test("resolveImportTarget throws when DATABASE_URL/DATABASE_URL_UNPOOLED are missing", () => {
  withEnv({ DATABASE_URL: undefined, DATABASE_URL_UNPOOLED: undefined, VERCEL_ENV: undefined, NODE_ENV: "test" }, () => {
    assert.throws(() => resolveImportTarget(), TargetGuardError);
  });
});

test("resolveImportTarget aborts on a neon.tech hostname", () => {
  withEnv(
    {
      DATABASE_URL: "postgresql://user:pass@ep-example.us-east-1.aws.neon.tech:5432/db",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-example.us-east-1.aws.neon.tech:5432/db",
      VERCEL_ENV: undefined,
      NODE_ENV: "test",
    },
    () => {
      assert.throws(() => resolveImportTarget(), /neon\.tech/);
    },
  );
});

test("resolveImportTarget aborts on a non-Supabase hostname without the override flag", () => {
  withEnv(
    {
      DATABASE_URL: "postgresql://user:pass@example.com:5432/db",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@example.com:5432/db",
      ALLOW_NON_SUPABASE_HOST: undefined,
      VERCEL_ENV: undefined,
      NODE_ENV: "test",
    },
    () => {
      assert.throws(() => resolveImportTarget(), /pooler\.supabase\.com/);
    },
  );
});

test("resolveImportTarget aborts when NODE_ENV=production, even against a valid-looking Supabase host", () => {
  withEnv(
    {
      DATABASE_URL: "postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      VERCEL_ENV: undefined,
      NODE_ENV: "production",
    },
    () => {
      assert.throws(() => resolveImportTarget(), /production/);
    },
  );
});

test("resolveImportTarget aborts when VERCEL_ENV=production even if NODE_ENV does not say so", () => {
  withEnv(
    {
      DATABASE_URL: "postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      VERCEL_ENV: "production",
      NODE_ENV: "test",
    },
    () => {
      assert.throws(() => resolveImportTarget(), /production/);
    },
  );
});

test("resolveImportTarget succeeds for a valid staging Supabase host and never exposes the password", () => {
  withEnv(
    {
      DATABASE_URL: "postgresql://postgres.abc123:super-secret-pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      DATABASE_URL_UNPOOLED: "postgresql://postgres.abc123:super-secret-pw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      VERCEL_ENV: undefined,
      NODE_ENV: "test",
    },
    () => {
      const target = resolveImportTarget();
      assert.equal(target.hostname, "aws-0-ap-south-1.pooler.supabase.com");
      const description = describeTarget(target);
      assert.ok(!description.includes("super-secret-pw"), "describeTarget must never include the password");
      assert.ok(!description.includes("postgres.abc123"), "describeTarget must never include the username");
    },
  );
});
