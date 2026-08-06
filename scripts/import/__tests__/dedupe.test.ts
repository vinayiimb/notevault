import { test } from "node:test";
import assert from "node:assert/strict";
import { findExactDuplicates, findProbableDuplicates, proposeSubjectAliases } from "../lib/dedupe";

test("findExactDuplicates groups byte-identical (after normalization) rows", () => {
  const items = [
    { name: "Company Law", course: "B.Com" },
    { name: "  Company   Law  ", course: "B.Com" },
    { name: "Income Tax", course: "B.Com" },
  ];
  const groups = findExactDuplicates(items, (i) => [i.name, i.course]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2);
});

test("findExactDuplicates finds nothing when every row is unique", () => {
  const items = [{ name: "A" }, { name: "B" }, { name: "C" }];
  assert.equal(findExactDuplicates(items, (i) => [i.name]).length, 0);
});

test("findProbableDuplicates finds case/punctuation variants that are not byte-identical", () => {
  const items = [
    { name: "16th & 17th Century English Drama" },
    { name: "16th and 17th Century English Drama" },
    { name: "Modern European History" },
  ];
  const groups = findProbableDuplicates(items, (i) => [i.name]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].items.length, 2);
});

test("findProbableDuplicates does not conflate different-numbered papers", () => {
  const items = [{ name: "Financial Accounting I" }, { name: "Financial Accounting II" }];
  assert.equal(findProbableDuplicates(items, (i) => [i.name]).length, 0);
});

test("proposeSubjectAliases groups variant spellings under one canonical key", () => {
  const names = ["Research Methodology", "RESEARCH METHODOLOGY", "Research methodology", "Company Law"];
  const groups = proposeSubjectAliases(names);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].variants.length, 3);
});

test("proposeSubjectAliases returns nothing when all names are already unique/identical", () => {
  const names = ["Company Law", "Income Tax", "Company Law"];
  assert.equal(proposeSubjectAliases(names).length, 0);
});
