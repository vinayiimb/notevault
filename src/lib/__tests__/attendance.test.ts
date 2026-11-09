import { test } from "node:test";
import assert from "node:assert/strict";
import { attendancePlan } from "../attendance";

test("short: 30/50 at 75% needs 30 more classes", () => {
  const r = attendancePlan(30, 50, 0.75);
  assert.equal(r.status, "short");
  assert.equal(r.count, 30);
});
test("safe: 45/50 can miss 10 more", () => {
  const r = attendancePlan(45, 50, 0.75);
  assert.equal(r.status, "safe");
  assert.equal(r.count, 10);
});
test("exactly at target can miss none", () => {
  const r = attendancePlan(3, 4, 0.75);
  assert.equal(r.status, "safe");
  assert.equal(r.count, 0);
});
test("no classes held", () => {
  assert.equal(attendancePlan(0, 0, 0.75).status, "empty");
});
