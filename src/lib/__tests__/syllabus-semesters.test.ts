import test from "node:test";
import assert from "node:assert/strict";
import { semestersOf } from "../syllabus-semesters";

test("semester strings from the master syllabus", () => {
  assert.deepEqual(semestersOf("I"), [1]);
  assert.deepEqual(semestersOf("Semester- IV"), [4]);
  assert.deepEqual(semestersOf("IIi"), [3]);
  assert.deepEqual(semestersOf("III/IV"), [3, 4]);
  assert.deepEqual(semestersOf("I-VI"), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(semestersOf("Semester 4"), [4]);
  assert.deepEqual(semestersOf("Pool / not fixed"), []);
});
