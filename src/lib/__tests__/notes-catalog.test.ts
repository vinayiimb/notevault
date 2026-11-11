import { test } from "node:test";
import assert from "node:assert/strict";
import { buildNotesCatalog } from "@/lib/notes-catalog";

const general = { slug: "general-notes", name: "General Notes" };
const programmes = [{ name: "B.A. (Hons.) Economics", subjects: ["Introductory Development Economics"] }];

test("custom General Notes show up in the catalog with the admin-typed name", () => {
  const out = buildNotesCatalog(
    [
      { programmeSlug: "general-notes", subjectSlug: "english-language-through-literature", subject: "English Language Through Literature", semester: null },
      { programmeSlug: "ba-hons-economics", subjectSlug: "introductory-development-economics", subject: "Introductory Development Economics", semester: 5 },
    ],
    programmes,
    general,
  );
  const g = out.find((p) => p.slug === "general-notes");
  assert.equal(g?.name, "General Notes");
  assert.deepEqual(g?.subjects, [{ slug: "english-language-through-literature", name: "English Language Through Literature", semester: null }]);
  assert.equal(out.find((p) => p.slug === "ba-hons-economics")?.subjects.length, 1);
});

test("syllabus programmes still drop notes whose subject is not in the syllabus file", () => {
  const out = buildNotesCatalog([{ programmeSlug: "ba-hons-economics", subjectSlug: "not-a-subject", subject: "Not A Subject", semester: 1 }], programmes, general);
  assert.deepEqual(out, []);
});
