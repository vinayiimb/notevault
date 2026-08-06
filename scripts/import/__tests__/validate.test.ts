import { test } from "node:test";
import assert from "node:assert/strict";
import { validateYear, validateSemesterOrder, validateUrl, validateR2ObjectKey, validateNonEmptyString } from "../lib/validate";

test("validateYear accepts a plausible year and rejects nonsense", () => {
  assert.equal(validateYear(2024).length, 0);
  assert.equal(validateYear("2024").length, 0);
  assert.equal(validateYear(1800).length, 1);
  assert.equal(validateYear("not a year").length, 1);
  assert.equal(validateYear(null).length, 0); // optional field
});

test("validateSemesterOrder only accepts integers 1-8", () => {
  assert.equal(validateSemesterOrder(1).length, 0);
  assert.equal(validateSemesterOrder(8).length, 0);
  assert.equal(validateSemesterOrder(0).length, 1);
  assert.equal(validateSemesterOrder(9).length, 1);
  assert.equal(validateSemesterOrder("III").length, 1); // must be pre-parsed to a number by this point
});

test("validateUrl requires an actual https/http URL", () => {
  assert.equal(validateUrl("https://drive.google.com/drive/folders/abc").length, 0);
  assert.equal(validateUrl("not a url").length, 1);
  assert.equal(validateUrl("").length, 1);
  assert.equal(validateUrl(null).length, 1);
  assert.equal(validateUrl("ftp://example.com/file").length, 1);
});

test("validateR2ObjectKey enforces the existing storage.ts key format", () => {
  const valid = "uploads/pyqs/subj123/550e8400-e29b-41d4-a716-446655440000-paper.pdf";
  assert.equal(validateR2ObjectKey(valid).length, 0);
  assert.equal(validateR2ObjectKey("random/key.pdf").length, 1);
  assert.equal(validateR2ObjectKey("").length, 1);
});

test("validateNonEmptyString rejects blank/whitespace-only values", () => {
  assert.equal(validateNonEmptyString("Company Law", "name").length, 0);
  assert.equal(validateNonEmptyString("   ", "name").length, 1);
  assert.equal(validateNonEmptyString("", "name").length, 1);
  assert.equal(validateNonEmptyString(undefined, "name").length, 1);
});
