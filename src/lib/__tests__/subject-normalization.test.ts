import { test } from "node:test";
import assert from "node:assert/strict";
import { stageANormalize, canonicalSubjectKey } from "@/lib/subject-normalization";

test("stageANormalize treats case, spacing and punctuation as equivalent", () => {
  const variants = ["Income Tax", "income tax", "Income tax", "Income-Tax", "  Income   Tax  "];
  const keys = variants.map(stageANormalize);
  for (const k of keys) assert.equal(k, keys[0]);
});

test("stageANormalize treats & and 'and' as equivalent", () => {
  assert.equal(stageANormalize("Income Tax Law & Practice"), stageANormalize("Income Tax Law and Practice"));
});

test("stageANormalize standardizes roman numerals to arabic, but keeps different numbers distinct", () => {
  assert.equal(stageANormalize("Financial Accounting I"), stageANormalize("Financial Accounting 1"));
  assert.equal(stageANormalize("Paper I"), stageANormalize("Paper 1"));
  assert.notEqual(stageANormalize("Financial Accounting I"), stageANormalize("Financial Accounting II"));
  assert.notEqual(
    stageANormalize("Income Tax Law and Practice I"),
    stageANormalize("Income Tax Law and Practice II")
  );
});

test("stageANormalize standardizes programme/program and honours/hons", () => {
  assert.equal(stageANormalize("B.Com Programme"), stageANormalize("B.Com Program"));
  assert.equal(stageANormalize("B.A. Honours Economics"), stageANormalize("B.A. Hons Economics"));
});

test("stageANormalize does not merge genuinely different subjects", () => {
  assert.notEqual(stageANormalize("Business Mathematics"), stageANormalize("Business Mathematics and Statistics"));
  assert.notEqual(stageANormalize("Financial Accounting"), stageANormalize("Financial Management"));
});

test("canonicalSubjectKey is untouched by the new Stage A synonyms (existing callers keep prior behavior)", () => {
  // matchOfficialSubject and other existing callers must not start treating
  // "Programme" and "Program" as equal just because Stage A does.
  assert.notEqual(canonicalSubjectKey("B.Com Programme"), canonicalSubjectKey("B.Com Program"));
});
