import { test } from "node:test";
import assert from "node:assert/strict";
import { recordQueryDiagnostic } from "@/lib/query-diagnostics";

// Next.js types NODE_ENV as read-only (it manages it itself in the real
// app); these tests need to flip it to exercise both branches, so they go
// through a loosely-typed alias instead of fighting that type.
const env = process.env as Record<string, string | undefined>;

test("recordQueryDiagnostic is a pass-through that never changes the result", async () => {
  const result = await recordQueryDiagnostic("test-query", async () => [1, 2, 3]);
  assert.deepEqual(result, [1, 2, 3]);
});

test("recordQueryDiagnostic never logs in production, regardless of the opt-in flag", async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalFlag = process.env.NOTEVAULT_QUERY_DIAGNOSTICS;
  const logs: unknown[][] = [];
  const originalDebug = console.debug;
  console.debug = (...args: unknown[]) => logs.push(args);

  try {
    env.NODE_ENV = "production";
    process.env.NOTEVAULT_QUERY_DIAGNOSTICS = "1";
    await recordQueryDiagnostic("should-not-log", async () => "value");
    assert.equal(logs.length, 0, "diagnostics must stay off in production even if the flag is set");
  } finally {
    console.debug = originalDebug;
    env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.NOTEVAULT_QUERY_DIAGNOSTICS;
    else process.env.NOTEVAULT_QUERY_DIAGNOSTICS = originalFlag;
  }
});

test("recordQueryDiagnostic stays silent by default outside production too (opt-in only)", async () => {
  const originalNodeEnv = env.NODE_ENV;
  const originalFlag = process.env.NOTEVAULT_QUERY_DIAGNOSTICS;
  const logs: unknown[][] = [];
  const originalDebug = console.debug;
  console.debug = (...args: unknown[]) => logs.push(args);

  try {
    env.NODE_ENV = "development";
    delete process.env.NOTEVAULT_QUERY_DIAGNOSTICS;
    await recordQueryDiagnostic("should-not-log-either", async () => "value");
    assert.equal(logs.length, 0, "diagnostics must be opt-in, not on by default in dev");
  } finally {
    console.debug = originalDebug;
    env.NODE_ENV = originalNodeEnv;
    if (originalFlag === undefined) delete process.env.NOTEVAULT_QUERY_DIAGNOSTICS;
    else process.env.NOTEVAULT_QUERY_DIAGNOSTICS = originalFlag;
  }
});
