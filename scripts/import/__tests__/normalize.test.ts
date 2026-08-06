import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeWhitespaceAndUnicode, parseSemesterField, deterministicSlug, exactDuplicateKey, probableDuplicateKey } from "../lib/normalize";

test("normalizeWhitespaceAndUnicode collapses whitespace and normalizes Unicode", () => {
  assert.equal(normalizeWhitespaceAndUnicode("  Company   Law  "), "Company Law");
  assert.equal(normalizeWhitespaceAndUnicode("Company Law"), "Company Law"); // non-breaking space
});

test("parseSemesterField handles plain roman numerals and digits", () => {
  assert.deepEqual(parseSemesterField("I"), { kind: "single", order: 1 });
  assert.deepEqual(parseSemesterField("3"), { kind: "single", order: 3 });
  assert.deepEqual(parseSemesterField("VIII"), { kind: "single", order: 8 });
});

test("parseSemesterField handles the real 'IIi' typo via case-insensitive matching", () => {
  assert.deepEqual(parseSemesterField("IIi"), { kind: "single", order: 3 });
});

test("parseSemesterField handles 'Semester N' and 'Semester-N' prefixes", () => {
  assert.deepEqual(parseSemesterField("Semester 5"), { kind: "single", order: 5 });
  assert.deepEqual(parseSemesterField("Semester-5"), { kind: "single", order: 5 });
  assert.deepEqual(parseSemesterField("Semester- VI"), { kind: "single", order: 6 });
});

test("parseSemesterField expands slash/comma-separated multi-semester rows", () => {
  const result = parseSemesterField("I/III/V");
  assert.equal(result.kind, "multi");
  if (result.kind === "multi") assert.deepEqual(result.orders, [1, 3, 5]);

  const commaResult = parseSemesterField("I,III,V");
  assert.equal(commaResult.kind, "multi");
  if (commaResult.kind === "multi") assert.deepEqual(commaResult.orders, [1, 3, 5]);
});

test("parseSemesterField expands ranges", () => {
  const result = parseSemesterField("III-VI");
  assert.equal(result.kind, "multi");
  if (result.kind === "multi") assert.deepEqual(result.orders, [3, 4, 5, 6]);
});

test("parseSemesterField flags elective pools separately from parse failures", () => {
  assert.equal(parseSemesterField("Pool / not fixed").kind, "pool");
  assert.equal(parseSemesterField("Pool / see prerequisites").kind, "pool");
});

test("parseSemesterField reports genuinely unparseable strings instead of guessing", () => {
  assert.equal(parseSemesterField("whenever the department decides").kind, "unparseable");
});

test("deterministicSlug is stable across repeated calls and normalizes first", () => {
  const a = deterministicSlug("  Company   Law ");
  const b = deterministicSlug("Company Law");
  assert.equal(a, b);
  assert.equal(a, "company-law");
});

test("exactDuplicateKey is case/whitespace-insensitive but numeral-preserving", () => {
  assert.equal(exactDuplicateKey("Company Law"), exactDuplicateKey("  company   law  "));
  assert.notEqual(exactDuplicateKey("Company Law I"), exactDuplicateKey("Company Law II"));
});

test("probableDuplicateKey keeps different-numbered papers distinct", () => {
  assert.notEqual(probableDuplicateKey("Financial Accounting I"), probableDuplicateKey("Financial Accounting II"));
});

test("probableDuplicateKey groups punctuation/case variants of the same paper", () => {
  assert.equal(
    probableDuplicateKey("16th & 17th Century English Drama"),
    probableDuplicateKey("16th and 17th Century English Drama"),
  );
});
