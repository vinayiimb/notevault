import { test } from "node:test";
import assert from "node:assert/strict";
import { feathersFor, rankFor, goalPct, parseGoal, cleanSubject, parseSubjectLimit } from "@/lib/feathers";

test("feathers: a minute each plus 10 per active day", () => {
  assert.equal(feathersFor(0, 0), 0);
  assert.equal(feathersFor(3600, 3), 60 + 30);
  assert.equal(feathersFor(-5, -1), 0);
});

test("rank: boundaries and progress", () => {
  assert.equal(rankFor(0).rank.name, "Hatchling");
  assert.equal(rankFor(49).rank.name, "Hatchling");
  assert.equal(rankFor(50).rank.name, "Fledgling");
  assert.equal(rankFor(125).pct, 50); // halfway 50 -> 200
  assert.equal(rankFor(9999).next, null);
  assert.equal(rankFor(9999).pct, 100);
});

test("goal: capped at 100, bad cookie falls back", () => {
  assert.equal(goalPct(900, 30), 50);
  assert.equal(goalPct(99999, 30), 100);
  assert.equal(parseGoal("45"), 45);
  assert.equal(parseGoal("7"), 30);
  assert.equal(parseGoal(undefined), 30);
});

test("subject form validation", () => {
  const ok = cleanSubject({ type: "sec", name: "  Basic   Analytical Techniques ", code: "2176000005" });
  assert.ok(ok.ok && ok.value.type === "SEC" && ok.value.name === "Basic Analytical Techniques" && ok.value.code === "2176000005");
  assert.equal(cleanSubject({ type: "XX", name: "Maths" }).ok, false);
  assert.equal(cleanSubject({ type: "GE", name: "a" }).ok, false);
  assert.equal(cleanSubject({ type: "GE", name: "Maths", code: "<b>" }).ok, false);
  const noCode = cleanSubject({ type: "VAC", name: "Yoga", code: "" });
  assert.ok(noCode.ok && noCode.value.code === null);
});

test("DSC and DSE are valid subject types", () => {
  for (const t of ["dsc", "DSE"]) assert.ok(cleanSubject({ type: t, name: "Macro Economics" }).ok);
});

test("admin subject limit: clamped, blank = default", () => {
  assert.equal(parseSubjectLimit("20"), 20);
  assert.equal(parseSubjectLimit("0"), 1);
  assert.equal(parseSubjectLimit("9999"), 60);
  assert.equal(parseSubjectLimit(""), null);
  assert.equal(parseSubjectLimit("abc"), null);
});

test("subject form keeps course and a valid semester", () => {
  const r = cleanSubject({ type: "DSC", name: "Corporate Accounting", code: "", course: "  B.Com (Hons) ", semester: "3" });
  assert.ok(r.ok && r.value.course === "B.Com (Hons)" && r.value.semester === 3);
  const bad = cleanSubject({ type: "GE", name: "Yoga", semester: "11", course: "" });
  assert.ok(bad.ok && bad.value.semester === null && bad.value.course === null);
});
