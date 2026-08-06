import { test } from "node:test";
import assert from "node:assert/strict";
import { checkRateLimit, clientIpFromHeaders } from "@/lib/rate-limit";

test("checkRateLimit allows up to the limit, then rejects within the window", () => {
  const key = `test:${Math.random()}`;
  for (let i = 0; i < 3; i++) {
    const result = checkRateLimit(key, 3, 60);
    assert.equal(result.ok, true, `call ${i + 1} should be allowed`);
  }
  const blocked = checkRateLimit(key, 3, 60);
  assert.equal(blocked.ok, false);
  if (!blocked.ok) {
    assert.ok(blocked.retryAfterSeconds > 0);
    assert.ok(blocked.retryAfterSeconds <= 60);
  }
});

test("checkRateLimit tracks separate keys independently", () => {
  const keyA = `test:a:${Math.random()}`;
  const keyB = `test:b:${Math.random()}`;
  assert.equal(checkRateLimit(keyA, 1, 60).ok, true);
  assert.equal(checkRateLimit(keyA, 1, 60).ok, false);
  // A different key should be unaffected by keyA's exhausted bucket.
  assert.equal(checkRateLimit(keyB, 1, 60).ok, true);
});

test("clientIpFromHeaders prefers the first x-forwarded-for entry", () => {
  const headers = new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" });
  assert.equal(clientIpFromHeaders(headers), "203.0.113.1");
});

test("clientIpFromHeaders falls back to x-real-ip, then unknown", () => {
  assert.equal(clientIpFromHeaders(new Headers({ "x-real-ip": "203.0.113.5" })), "203.0.113.5");
  assert.equal(clientIpFromHeaders(new Headers()), "unknown");
});
