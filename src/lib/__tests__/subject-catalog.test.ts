import { test } from "node:test";
import assert from "node:assert/strict";
import { cleanCode, getSubjectCatalog, parseSemesters } from "@/lib/subject-catalog";

test("semester labels from the syllabus sheet", () => {
  assert.deepEqual(parseSemesters("I/III/V/VII"), [1, 3, 5, 7]);
  assert.deepEqual(parseSemesters("III-VI"), [3, 4, 5, 6]);
  assert.deepEqual(parseSemesters("Semester- VII"), [7]);
  assert.deepEqual(parseSemesters("Semester-VII/ VIII"), [7, 8]);
  assert.deepEqual(parseSemesters("IIi"), [3]);
  assert.deepEqual(parseSemesters("Pool / not fixed"), []);
});

test("codes: real UPCs kept, placeholders dropped", () => {
  assert.equal(cleanCode("2176000005"), "2176000005");
  assert.equal(cleanCode("TBA"), "");
  assert.equal(cleanCode(undefined), "");
});

test("catalog has every type and no duplicate subject inside a course", () => {
  const c = getSubjectCatalog();
  const types = new Set([...c.rows.map((r) => r[1]), ...c.pool.map((p) => p[0])]);
  for (const t of ["DSC", "DSE", "GE", "SEC", "AEC", "VAC"]) assert.ok(types.has(t), t);
  const keys = c.rows.map((r) => `${r[0]}|${r[1]}|${r[3]}|${r[4]}`);
  assert.equal(new Set(keys).size, keys.length);
});
