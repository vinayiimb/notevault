import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEmail, normalizePhone, normalizeUtr, previewOf, priceFor, upsellFor } from "@/lib/paid-notes-pricing";

test("priceFor picks the cheapest pack mix", () => {
  assert.equal(priceFor(0), 0);
  assert.equal(priceFor(1), 49);
  assert.equal(priceFor(2), 98);
  assert.equal(priceFor(3), 99);
  assert.equal(priceFor(4), 148);
  assert.equal(priceFor(5), 149);
  assert.equal(priceFor(6), 198);
  assert.equal(priceFor(8), 248);
  assert.equal(priceFor(10), 298);
});

test("upsellFor nudges only when the next subject is cheap", () => {
  assert.deepEqual(upsellFor(2), { extra: 1, nextCount: 3 });
  assert.deepEqual(upsellFor(4), { extra: 1, nextCount: 5 });
  assert.equal(upsellFor(1), null); // 2nd subject costs a full ₹49
  assert.equal(upsellFor(3), null);
});

test("previewOf cuts on a block boundary, never inside a fence", () => {
  const para = "Lorem ipsum dolor sit amet. ".repeat(20);
  const md = [
    "# Title",
    "",
    para,
    "",
    "```mermaid",
    "graph TD",
    "",
    "A-->B",
    "```",
    "",
    ...Array.from({ length: 12 }, (_, i) => `## Section ${i}\n\n${para}\n`),
  ].join("\n");
  const { preview, truncated } = previewOf(md);
  assert.equal(truncated, true);
  assert.ok(preview.length < md.length * 0.5);
  assert.equal((preview.match(/```/g) ?? []).length % 2, 0, "fences stay balanced");
  assert.ok(md.startsWith(preview));
});

test("previewOf leaves short notes whole", () => {
  assert.deepEqual(previewOf("# Short\n\nTiny note."), { preview: "# Short\n\nTiny note.", truncated: false });
});

test("input normalizers", () => {
  assert.equal(normalizeUtr(" 4123 5678 9012 "), "412356789012");
  assert.equal(normalizeUtr("123"), null);
  assert.equal(normalizeEmail(" Student@Gmail.com "), "student@gmail.com");
  assert.equal(normalizeEmail("nope"), null);
  assert.equal(normalizePhone("+91 98765 43210"), "919876543210");
  assert.equal(normalizePhone("09876543210"), "919876543210");
  assert.equal(normalizePhone("12345"), null);
});
