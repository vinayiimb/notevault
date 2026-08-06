import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Integration-level dry-run safety test: spawns the real CLI to prove the
// target-guard rejects unsafe targets for apply/verify BEFORE any write is
// attempted, regardless of --confirm. Uses fabricated/unreachable hosts —
// never the real staging database — so these tests never perform a write
// even though apply/verify are live starting Phase 2D.
function runCli(args: string[], extraEnv: Record<string, string>) {
  return spawnSync("npx", ["tsx", "scripts/import/run.ts", ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      ...extraEnv,
    },
    timeout: 20_000,
  });
}

const FAKE_STAGING_ENV = {
  DATABASE_URL: "postgresql://postgres.fake:fakepw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
  DATABASE_URL_UNPOOLED: "postgresql://postgres.fake:fakepw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
};

test("apply mode refuses to run without --confirm, before attempting any connection", () => {
  const result = runCli(["--mode=apply"], FAKE_STAGING_ENV);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--confirm/);
  // Must never even get to the [target] log line — the --confirm check
  // happens before target-guard is invoked.
  assert.ok(!result.stdout.includes("[target]"));
});

test("apply mode with --confirm against a neon.tech host aborts on the hostname before any write", () => {
  const result = runCli(["--mode=apply", "--confirm"], {
    DATABASE_URL: "postgresql://user:pass@ep-example.neon.tech:5432/db",
    DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-example.neon.tech:5432/db",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /neon\.tech/);
});

test("apply mode with --confirm against a non-Supabase host aborts on the hostname before any write", () => {
  const result = runCli(["--mode=apply", "--confirm"], {
    DATABASE_URL: "postgresql://user:pass@example.com:5432/db",
    DATABASE_URL_UNPOOLED: "postgresql://user:pass@example.com:5432/db",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /pooler\.supabase\.com/);
});

test("apply mode with --confirm refuses when NODE_ENV=production, even against a Supabase-shaped host", () => {
  const result = runCli(["--mode=apply", "--confirm"], { ...FAKE_STAGING_ENV, NODE_ENV: "production" });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /production/);
});

test("verify mode against a neon.tech host aborts on the hostname before any read", () => {
  const result = runCli(["--mode=verify"], {
    DATABASE_URL: "postgresql://user:pass@ep-example.neon.tech:5432/db",
    DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-example.neon.tech:5432/db",
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /neon\.tech/);
});

test("preview mode never requires --confirm", () => {
  // Fabricated unreachable Supabase-shaped host — the connection itself
  // will fail, but that must happen only *after* the target-guard passes,
  // proving --confirm is specifically an apply-only gate.
  const result = runCli(["--mode=preview"], {
    DATABASE_URL: "postgresql://postgres.fake:fakepw@aws-0-ap-south-1.pooler.supabase.com:6543/nonexistent",
    DATABASE_URL_UNPOOLED: "postgresql://postgres.fake:fakepw@aws-0-ap-south-1.pooler.supabase.com:5432/nonexistent",
  });
  assert.ok(result.stdout.includes("[target]"), "target-guard should pass and log before the (failing) connection attempt");
});
