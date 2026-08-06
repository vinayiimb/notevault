import { test } from "node:test";
import assert from "node:assert/strict";
import { slugSegment, buildObjectKey, buildPaperKey } from "../paths";

test("slugSegment lowercases and hyphenates", () => {
  assert.equal(slugSegment("B.Com. (Hons.)"), "b-com-hons");
  assert.equal(slugSegment("Semester 5"), "semester-5");
  assert.equal(slugSegment(""), "untitled");
});

test("buildObjectKey produces the deterministic papers/... shape from the spec", () => {
  const key = buildObjectKey("papers", ["bcom-hons", "semester-5", "financial-management", "2024"], "paper-abc123.pdf");
  assert.equal(key, "papers/bcom-hons/semester-5/financial-management/2024/paper-abc123.pdf");
});

test("buildObjectKey is deterministic — same inputs always produce the same key", () => {
  const a = buildObjectKey("papers", ["bcom-hons", "semester-5"], "x.pdf");
  const b = buildObjectKey("papers", ["bcom-hons", "semester-5"], "x.pdf");
  assert.equal(a, b);
});

test("buildObjectKey slugifies unsafe path segments instead of passing them through raw", () => {
  const key = buildObjectKey("papers", ["B.Com. (Hons.)", "../../etc"], "paper.pdf");
  assert.ok(!key.includes(".."), "no path traversal segment must survive");
  assert.equal(key, "papers/b-com-hons/etc/paper.pdf");
});

test("buildPaperKey matches the exact deterministic shape from the task spec", () => {
  const key = buildPaperKey({
    programmeSlug: "bcom-hons",
    termSlug: "semester-5",
    subjectSlug: "financial-management",
    year: 2024,
    paperId: "clx123abc",
  });
  assert.equal(key, "papers/bcom-hons/semester-5/financial-management/2024/clx123abc.pdf");
});
