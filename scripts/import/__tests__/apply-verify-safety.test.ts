import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

// Integration-level dry-run safety test: spawns the real CLI (not just unit
// logic) to prove apply/verify refuse to run in Phase 2C even with a
// nominally-valid Supabase-shaped target and --confirm, and even before any
// network connection would be attempted.
function runCli(args: string[], extraEnv: Record<string, string>) {
  return spawnSync("npx", ["tsx", "scripts/import/run.ts", ...args], {
    encoding: "utf-8",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://postgres.fake:fakepw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
      DATABASE_URL_UNPOOLED: "postgresql://postgres.fake:fakepw@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
      ...extraEnv,
    },
    timeout: 20_000,
  });
}

test("apply mode refuses to run even with --confirm", () => {
  const result = runCli(["--mode=apply", "--confirm"], {});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not invoked in Phase 2C/);
});

test("apply mode refuses to run without --confirm (before even checking the target)", () => {
  const result = runCli(["--mode=apply"], {});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /--confirm/);
});

test("verify mode refuses to run in Phase 2C", () => {
  const result = runCli(["--mode=verify"], {});
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /not invoked in Phase 2C/);
});

test("apply mode with --confirm against a neon.tech host aborts on the hostname, not on the missing --confirm-safety gate order", () => {
  const result = spawnSync("npx", ["tsx", "scripts/import/run.ts", "--mode=apply", "--confirm"], {
    encoding: "utf-8",
    env: {
      ...process.env,
      DATABASE_URL: "postgresql://user:pass@ep-example.neon.tech:5432/db",
      DATABASE_URL_UNPOOLED: "postgresql://user:pass@ep-example.neon.tech:5432/db",
    },
    timeout: 20_000,
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /neon\.tech/);
});
