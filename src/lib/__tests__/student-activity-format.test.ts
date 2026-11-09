import { test } from "node:test";
import assert from "node:assert/strict";
import { clampSeconds, fmtDuration, isItemKey, istDay, MAX_BEAT_SECONDS } from "@/lib/student-activity-format";

test("clampSeconds keeps a heartbeat between 0 and the cap", () => {
  assert.equal(clampSeconds(60), 60);
  assert.equal(clampSeconds(99999), MAX_BEAT_SECONDS);
  assert.equal(clampSeconds(-5), 0);
  assert.equal(clampSeconds("abc"), 0);
  assert.equal(clampSeconds(undefined), 0);
});

test("isItemKey only takes programme/subject slugs", () => {
  assert.equal(isItemKey("ba-hons-economics/macro-economics"), true);
  assert.equal(isItemKey("a/b/c"), false);
  assert.equal(isItemKey("../etc/passwd"), false);
  assert.equal(isItemKey(""), false);
  assert.equal(isItemKey(42), false);
});

test("fmtDuration", () => {
  assert.equal(fmtDuration(0), "0m");
  assert.equal(fmtDuration(20), "<1m");
  assert.equal(fmtDuration(95), "2m");
  assert.equal(fmtDuration(3725), "1h 2m");
});

test("istDay counts a late-evening UTC time on the next India day", () => {
  assert.equal(istDay(new Date("2026-11-09T20:00:00Z")), "2026-11-10");
  assert.equal(istDay(new Date("2026-11-09T10:00:00Z")), "2026-11-09");
});
