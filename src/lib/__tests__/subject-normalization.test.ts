import { test } from "node:test";
import assert from "node:assert/strict";
import { stageANormalize, canonicalSubjectKey, recommendCanonicalSubject } from "@/lib/subject-normalization";

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

test("recommendCanonicalSubject prefers a subject with an official UPC over one with more content but no UPC", () => {
  const winner = recommendCanonicalSubject([
    { id: "a", name: "income tax", upc: null, resourceCount: 50, questionCount: 20 },
    { id: "b", name: "Income Tax", upc: "2302201101", resourceCount: 1, questionCount: 0 },
  ]);
  assert.equal(winner, "b");
});

test("recommendCanonicalSubject prefers more linked content when UPC is tied (both or neither have one)", () => {
  const winner = recommendCanonicalSubject([
    { id: "a", name: "Income Tax", upc: null, resourceCount: 2, questionCount: 1 },
    { id: "b", name: "income tax", upc: null, resourceCount: 12, questionCount: 4 },
  ]);
  assert.equal(winner, "b");
});

test("recommendCanonicalSubject falls back to name-quality when UPC and content are both tied", () => {
  const winner = recommendCanonicalSubject([
    { id: "a", name: "INCOME TAX", upc: null, resourceCount: 5, questionCount: 0 },
    { id: "b", name: "Income Tax", upc: null, resourceCount: 5, questionCount: 0 },
  ]);
  // "Income Tax" (normal case) beats "INCOME TAX" (all caps) on label quality.
  assert.equal(winner, "b");
});

test("recommendCanonicalSubject returns null for an empty candidate list, never throws", () => {
  assert.equal(recommendCanonicalSubject([]), null);
});

test("recommendCanonicalSubject never invents an id outside the candidate list", () => {
  const candidates = [
    { id: "x1", name: "Income Tax", upc: null, resourceCount: 3, questionCount: 1 },
    { id: "x2", name: "income tax", upc: null, resourceCount: 1, questionCount: 0 },
    { id: "x3", name: "Income-Tax", upc: "123", resourceCount: 0, questionCount: 0 },
  ];
  const winner = recommendCanonicalSubject(candidates);
  assert.ok(candidates.some((c) => c.id === winner));
});
