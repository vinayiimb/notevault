import { test } from "node:test";
import assert from "node:assert/strict";
import { applyPaperEdits, type PaperEdit } from "../paper-edits";
import type { CatalogPaper } from "../pyq-catalog-types";

const paper = (id: string, course: string, verified: boolean): CatalogPaper => ({
  id,
  course,
  verified,
  subject: "Old Subject",
  semester: "1",
  semesterGroup: "Semester 1",
  yearRange: "2024",
  pdfUrl: `https://drive.google.com/file/d/${id}/view`,
  note: null,
  source: "drive",
});
const edit = (paperId: string, over: Partial<PaperEdit>): PaperEdit => ({
  paperId,
  pdfUrl: null,
  hidden: false,
  course: null,
  subject: null,
  semester: null,
  yearRange: null,
  upc: null,
  paperType: null,
  verified: null,
  added: false,
  ...over,
});
const full = (course: string, verified: boolean, extra: Partial<PaperEdit> = {}) => ({
  course,
  verified,
  subject: "New Subject",
  semester: "2",
  yearRange: "2025",
  upc: "12345678",
  paperType: "DSC",
  pdfUrl: "https://drive.google.com/file/d/x/view",
  ...extra,
});

test("full edit rewrites fields and keeps the original link for the admin", () => {
  const [p] = applyPaperEdits([paper("a", "BA", true)], [edit("a", full("BA", true))], { dataset: true });
  assert.equal(p.subject, "New Subject");
  assert.equal(p.semester, "2");
  assert.equal(p.note, "UPC 12345678 | DSC");
  assert.equal(p.originalUrl, "https://drive.google.com/file/d/a/view");
});

test("moving a paper to /papers/noncore drops it from /papers and adds it there", () => {
  const edits = [edit("a", full("BA", false))];
  assert.equal(applyPaperEdits([paper("a", "BA", true)], edits, { dataset: true }).length, 0);
  const noncore = applyPaperEdits([], edits, { dataset: false });
  assert.deepEqual(noncore.map((p) => p.id), ["a"]);
});

test("a paper moved to another programme is rebuilt from its edit", () => {
  const [p] = applyPaperEdits([paper("z", "BCom", true)], [edit("a", full("BCom", true))], { dataset: true }).filter(
    (q) => q.id === "a",
  );
  assert.equal(p.course, "BCom");
  assert.equal(p.pdfUrl, "https://drive.google.com/file/d/x/view");
});

test("hidden papers are dropped for students but kept (flagged) for the admin", () => {
  const raw = [paper("a", "BA", true)];
  const edits = [edit("a", { hidden: true })];
  assert.equal(applyPaperEdits(raw, edits, { dataset: true }).length, 0);
  assert.equal(applyPaperEdits(raw, edits, { keepHidden: true })[0].hidden, true);
});

test("older link-only edits just replace the link", () => {
  const [p] = applyPaperEdits([paper("a", "BA", true)], [edit("a", { pdfUrl: "https://example.com/a.pdf" })]);
  assert.equal(p.pdfUrl, "https://example.com/a.pdf");
  assert.equal(p.subject, "Old Subject");
});

test("added papers appear for the admin; edits of papers no longer in the catalog do not", () => {
  const edits = [edit("added-1", { ...full("BA", true), added: true }), edit("gone", full("BA", true))];
  assert.deepEqual(applyPaperEdits([], edits).map((p) => p.id), ["added-1"]);
});
