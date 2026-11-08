import test from "node:test";
import assert from "node:assert/strict";
import { formatLeadPhone, leadWhatsAppText, parseLeadPhone, parseLeadSemester, parseLeadSource } from "../note-leads";

test("phone: any common Indian format normalises to 91XXXXXXXXXX", () => {
  for (const raw of ["98765 43210", "+91 98765-43210", "09876543210", "919876543210", " 9876543210 "]) {
    assert.equal(parseLeadPhone(raw), "919876543210", raw);
  }
});

test("phone: rejects short, long and non-mobile numbers", () => {
  for (const raw of ["12345", "5876543210", "98765432101234", "", "abcdefghij"]) {
    assert.equal(parseLeadPhone(raw), null, raw);
  }
});

test("semester: 1-8 only", () => {
  assert.equal(parseLeadSemester("1"), 1);
  assert.equal(parseLeadSemester(8), 8);
  for (const bad of ["0", "9", "2.5", "", null, undefined, "abc"]) assert.equal(parseLeadSemester(bad), null, String(bad));
});

test("source: unknown values fall back to the notes hub", () => {
  assert.equal(parseLeadSource("note-page"), "note-page");
  assert.equal(parseLeadSource("evil"), "notes-hub");
  assert.equal(parseLeadSource(null), "notes-hub");
});

test("formatLeadPhone groups digits for reading", () => {
  assert.equal(formatLeadPhone("919876543210"), "+91 98765 43210");
});

test("admin WhatsApp text mentions what they asked for and differs by readiness", () => {
  const base = { subject: "Micro", programme: "B.A. Eco", semester: 3 };
  const ready = leadWhatsAppText({ ...base, hasNotes: true });
  const soon = leadWhatsAppText({ ...base, hasNotes: false });
  for (const t of [ready, soon]) assert.ok(t.includes("Micro") && t.includes("Sem 3"));
  assert.notEqual(ready, soon);
  assert.ok(!leadWhatsAppText({ ...base, semester: null, hasNotes: true }).includes("Sem"));
});
