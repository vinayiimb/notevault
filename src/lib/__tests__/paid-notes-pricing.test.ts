import { test } from "node:test";
import assert from "node:assert/strict";
import { accessExpiry, isAccessActive, normalizeEmail, normalizePhone, normalizeUtr, previewOf, priceFor, upsellFor } from "@/lib/paid-notes-pricing";

test("priceFor picks the cheapest pack mix", () => {
  assert.equal(priceFor(0), 0);
  assert.equal(priceFor(1), 99);
  assert.equal(priceFor(2), 198);
  assert.equal(priceFor(3), 249);
  assert.equal(priceFor(4), 348);
  assert.equal(priceFor(5), 447); // 3-pack + 2 singles, ₹2 under the 6-pack
  assert.equal(priceFor(6), 449);
  assert.equal(priceFor(7), 548);
  assert.equal(priceFor(9), 698);
  assert.equal(priceFor(10), 797);
});

test("upsellFor nudges only when the next subject is cheap", () => {
  assert.deepEqual(upsellFor(2), { extra: 51, nextCount: 3 });
  assert.deepEqual(upsellFor(5), { extra: 2, nextCount: 6 });
  assert.equal(upsellFor(1), null); // 2nd subject costs a full ₹99
  assert.equal(upsellFor(3), null);
});

test("accessExpiry: 6 months for new paid purchases, never for old or gifted ones", () => {
  const after = new Date("2026-12-01T10:00:00Z");
  assert.equal(accessExpiry({ createdAt: after, amount: 199, utr: "pay_1" })?.toISOString(), "2027-06-01T10:00:00.000Z");
  // UPI: counted from approval, not submission
  assert.equal(accessExpiry({ createdAt: after, reviewedAt: new Date("2026-12-03T10:00:00Z"), amount: 49, utr: "U1" })?.toISOString(), "2027-06-03T10:00:00.000Z");
  assert.equal(accessExpiry({ createdAt: new Date("2026-10-01T00:00:00Z"), amount: 149, utr: "old" }), null); // sold as lifetime
  assert.equal(accessExpiry({ createdAt: after, amount: 0, utr: "admin-x" }), null);
  assert.equal(accessExpiry({ createdAt: after, amount: 0, utr: "promoter-x" }), null);
  assert.equal(isAccessActive({ createdAt: new Date("2026-11-20T00:00:00Z"), amount: 49, utr: "x" }, new Date("2027-05-19T00:00:00Z")), true);
  assert.equal(isAccessActive({ createdAt: new Date("2026-11-20T00:00:00Z"), amount: 49, utr: "x" }, new Date("2027-05-21T00:00:00Z")), false);
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

test("previewOf gates short notes too (live bug: a 1.5k-char note was fully free)", () => {
  const md = ["# Management Accounting", "", "Intro paragraph.", "", "## Meaning", "", "Body one.", "", "## Scope", "", "Body two.", "", "## Functions", "", "Body three."].join("\n");
  const { preview, truncated } = previewOf(md);
  assert.equal(truncated, true);
  assert.ok(preview.length <= md.length * 0.5, "about 30%, not most of it");
  assert.ok(!preview.includes("Body three"));
});

test("previewOf gates notes with no blank lines (live bug: Management Accounting fully free)", () => {
  const md = [
    "### Core Objectives",
    ...Array.from({ length: 6 }, (_, i) => `* **Objective ${i}:** planning, control and decision making support.`),
    "### Key Techniques and Tools",
    ...Array.from({ length: 6 }, (_, i) => `* **Tool ${i}:** budgetary control, standard costing, ratio analysis.`),
    "### Management vs. Financial Accounting",
    ...Array.from({ length: 6 }, (_, i) => `* Difference ${i}: internal vs external users.`),
  ].join("\r\n");
  const { preview, truncated } = previewOf(md);
  assert.equal(truncated, true);
  assert.ok(preview.length < md.length * 0.45);
  assert.ok(!preview.includes("Management vs. Financial"));
});

test("previewOf never cuts between table rows", () => {
  const rows = Array.from({ length: 30 }, (_, i) => `| Row ${i} | value ${i} |`);
  const md = ["Intro line.", "| A | B |", "|---|---|", ...rows, "After the table.", "More text."].join("\n");
  const { preview, truncated } = previewOf(md);
  assert.equal(truncated, true);
  assert.ok(preview.endsWith("| Row 29 | value 29 |"), "the whole table stays together");
});

test("previewOf can't split a single block, and never returns an empty lock", () => {
  assert.deepEqual(previewOf("One paragraph only."), { preview: "One paragraph only.", truncated: false });
  assert.deepEqual(previewOf("Para one.\n\n"), { preview: "Para one.\n\n", truncated: false });
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

test("previewOf: a preview-end marker locks everything below it, whatever the length", () => {
  const front = "# Title\n\nOne line summary.\n\n## How to use\n\n1. Read.\n";
  const rest = "\n## Unit I\n\n" + "Teaching content.\n\n".repeat(200);
  const { preview, truncated } = previewOf(front + "\n<!-- preview-end -->\n" + rest);
  assert.equal(truncated, true);
  assert.equal(preview, front.trimEnd());
  assert.ok(!preview.includes("Teaching content"));
  assert.ok(!preview.includes("preview-end"));
});

test("previewOf: a marker with nothing below it locks nothing, and a marker at the top still shows a title", () => {
  assert.equal(previewOf("# T\n\nBody.\n\n<!-- preview-end -->\n").truncated, false);
  const top = previewOf("<!-- preview-end -->\n# Title\n\nPaid body.");
  assert.equal(top.truncated, true);
  assert.equal(top.preview, "# Title");
});

test("previewOf: notes without a marker keep the 30% rule", () => {
  const md = Array.from({ length: 40 }, (_, i) => `Paragraph ${i}.\n`).join("\n");
  const { preview, truncated } = previewOf(md);
  assert.equal(truncated, true);
  assert.ok(preview.length < md.length * 0.5);
});
