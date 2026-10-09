import { test } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import { clearLoginFailures, isLoginLocked, jwtSecret, recordLoginFailure, signSession, verifySessionToken } from "@/lib/auth";

test("admin token verifies", () => {
  const token = signSession({ adminId: "a1", email: "a@x.com", name: "A" });
  assert.equal(verifySessionToken(token)?.adminId, "a1");
});

// Same shape signStudentSession (paid-notes.ts, server-only) produces.
test("student token is rejected as an admin session", () => {
  assert.equal(verifySessionToken(jwt.sign({ studentEmail: "s@gmail.com" }, jwtSecret())), null);
});

test("5 failed logins lock the key; success clears it", () => {
  const key = "1.2.3.4|a@x.com";
  for (let i = 0; i < 4; i += 1) recordLoginFailure(key);
  assert.equal(isLoginLocked(key), false);
  recordLoginFailure(key);
  assert.equal(isLoginLocked(key), true);
  clearLoginFailures(key);
  assert.equal(isLoginLocked(key), false);
});
