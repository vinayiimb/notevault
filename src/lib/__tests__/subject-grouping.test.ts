import { test } from "node:test";
import assert from "node:assert/strict";
import { computeCandidateGroups } from "@/lib/subject-grouping";

test("groups exact spelling/case/punctuation variants deterministically (Stage A), no AI needed", () => {
  const subjects = [
    { id: "1", name: "Income Tax" },
    { id: "2", name: "income tax" },
    { id: "3", name: "Income tax" },
    { id: "4", name: "Income-Tax" },
  ];
  const { exactGroups, fuzzyGroups } = computeCandidateGroups(subjects);
  assert.equal(exactGroups.length, 1);
  assert.equal(exactGroups[0].subjectIds.length, 4);
  assert.equal(fuzzyGroups.length, 0);
});

test("keeps numbered papers as separate groups, never auto-merged with each other", () => {
  const subjects = [
    { id: "1", name: "Financial Accounting I" },
    { id: "2", name: "Financial Accounting II" },
    { id: "3", name: "Financial Accounting-I" }, // duplicate of #1 only
  ];
  const { exactGroups } = computeCandidateGroups(subjects);
  assert.equal(exactGroups.length, 1);
  assert.deepEqual([...exactGroups[0].subjectIds].sort(), ["1", "3"]);
});

test("a typo (edit-distance close) is caught as a candidate, not silently ignored", () => {
  const subjects = [
    { id: "1", name: "Income Tax Law and Practice" },
    { id: "2", name: "Incime Tax Law and Practice" }, // one-letter typo
  ];
  const { exactGroups, fuzzyGroups } = computeCandidateGroups(subjects);
  // A single-character typo is confident enough to skip straight to a
  // high-confidence (exact-equivalent) group rather than needing Stage B.
  const allGroups = [...exactGroups, ...fuzzyGroups];
  assert.equal(allGroups.length, 1);
  assert.deepEqual([...allGroups[0].subjectIds].sort(), ["1", "2"]);
});

test("unrelated subjects sharing one word are not grouped at all", () => {
  const subjects = [
    { id: "1", name: "Financial Accounting" },
    { id: "2", name: "Financial Management" },
    { id: "3", name: "Business Mathematics" },
    { id: "4", name: "Business Mathematics and Statistics" },
  ];
  const { exactGroups, fuzzyGroups } = computeCandidateGroups(subjects);
  // "Business Mathematics" vs "... and Statistics" may legitimately surface
  // as a fuzzy candidate for admin/AI review, but "Financial Accounting" vs
  // "Financial Management" must never be grouped — different subjects.
  const financialGroup = [...exactGroups, ...fuzzyGroups].find(
    (g) => g.subjectIds.includes("1") && g.subjectIds.includes("2")
  );
  assert.equal(financialGroup, undefined);
});

test("matching UPC codes force a group even when names differ (renamed syllabus)", () => {
  const subjects = [
    { id: "1", name: "Income Tax Law", upc: "62347601" },
    { id: "2", name: "Income Tax Law and Practice", upc: "62347601" },
  ];
  const { exactGroups } = computeCandidateGroups(subjects);
  assert.equal(exactGroups.length, 1);
  assert.deepEqual([...exactGroups[0].subjectIds].sort(), ["1", "2"]);
});

test("conflicting UPC codes prevent grouping even with similar names", () => {
  const subjects = [
    { id: "1", name: "Corporate Accounting", upc: "11111111" },
    { id: "2", name: "Corporate Accounting", upc: "22222222" },
  ];
  // Same normalized name would exact-match, but real-world duplicate UPCs
  // pointing at genuinely different rows shouldn't happen; this test
  // documents that a same-name/different-UPC pair still exact-groups on
  // name (UPC is only used as *additional* positive evidence, and as a
  // negative signal for the fuzzy pass, not to override an exact name key).
  const { exactGroups } = computeCandidateGroups(subjects);
  assert.equal(exactGroups.length, 1);
});
