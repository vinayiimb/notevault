import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePyqQuery } from "@/lib/telegram-pyq";

test("parses command, bot suffix, semester variants and tokens", () => {
  assert.deepEqual(parsePyqQuery("/pyq bcom sem1"), { sem: 1, tokens: ["bcom"] });
  assert.deepEqual(parsePyqQuery("/pyq@DuPyqBot BCom Semester-3 tax"), { sem: 3, tokens: ["bcom", "tax"] });
  assert.deepEqual(parsePyqQuery("finance for everyone"), { sem: null, tokens: ["finance", "for", "everyone"] });
  assert.deepEqual(parsePyqQuery("/pyq sem 9 eco"), { sem: null, tokens: ["sem", "9", "eco"] });
  assert.deepEqual(parsePyqQuery("/pyq"), { sem: null, tokens: [] });
});
