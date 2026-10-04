// Run: node --experimental-strip-types scripts/slug-match.check.ts
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { bestSlug, semesterFromSlug } from "../src/lib/slug-match.ts";

const progs = readFileSync(new URL("./fixtures/programme-slugs.txt", import.meta.url), "utf8").split(/\s+/).filter(Boolean);
const cases: [string, string | null][] = [
  ["bcom-honours", "bcom-hons"],
  ["b-com-hons", "bcom-hons"],
  ["bcom-h", "bcom-hons"],
  ["bcom", "bcom-p"],
  ["bcom-programme", "bcom-p"],
  ["ba-honours-economics", "ba-hons-economics"],
  ["ba-hons-english", "b-a-hons-english"],
  ["bsc-hons-computer-science", "bsc-hons-computer-science"],
  ["bsc-cs-hons", "bsc-hons-computer-science"],
  ["ba-hons-sociology", "ba-hons-socialogy"],
  ["ba-history-honours", "history-honours"],
  ["bms", "bachelor-of-management-studies"],
  ["ba-hons-political-science-sem-3", "ba-hons-political-science"],
  ["mbbs", null],
  ["random-words-here", null],
];
for (const [q, want] of cases) assert.equal(bestSlug(q, progs), want, q);

const subs = ["financial-accounting", "business-organisation", "business-laws", "corporate-accounting", "cost-accounting", "income-tax-law-and-practice"];
assert.equal(bestSlug("financial-accounting-sem-1", subs), "financial-accounting");
assert.equal(bestSlug("business-organization", subs), "business-organisation");
assert.equal(bestSlug("income-tax", subs), "income-tax-law-and-practice");
assert.equal(bestSlug("marketing", subs), null);

assert.equal(semesterFromSlug("financial-accounting-sem-1"), 1);
assert.equal(semesterFromSlug("semester-iii"), 3);
assert.equal(semesterFromSlug("financial-accounting"), null);
console.log("slug-match ok");
