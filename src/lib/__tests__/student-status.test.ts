import { test } from "node:test";
import assert from "node:assert/strict";
import { studentStatus } from "../student-status";

test("status buckets by last activity", () => {
  const now = Date.UTC(2026, 10, 14, 12);
  const ago = (h: number) => new Date(now - h * 3_600_000);
  assert.equal(studentStatus(null, now), "never");
  assert.equal(studentStatus(ago(2), now), "today");
  assert.equal(studentStatus(ago(30), now), "week");
  assert.equal(studentStatus(ago(24 * 8), now), "slipping");
  assert.equal(studentStatus(ago(24 * 31), now), "inactive");
});
