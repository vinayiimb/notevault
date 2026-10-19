import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { JAM_UNITS, checkAnswer, keyLabel, parseJamPaper } from "@/lib/jam-economics";

const dir = path.join(process.cwd(), "src/data/jam-economics");

// JAM EN layout since 2021: 1–30 MCQ, 31–40 MSQ, 41–60 NAT; 1 mark for 1–10 and 41–50.
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".md"))) {
  const year = file.replace(".md", "");
  test(`JAM ${year}: 60 questions in paper order with valid keys`, () => {
    const qs = parseJamPaper(year, fs.readFileSync(path.join(dir, file), "utf8"));
    assert.deepEqual(qs.map((q) => q.number), Array.from({ length: 60 }, (_, i) => i + 1));
    for (const q of qs) {
      const where = `${year} Q${q.number}`;
      assert.equal(q.type, q.number <= 30 ? "MCQ" : q.number <= 40 ? "MSQ" : "NAT", where);
      assert.equal(q.marks, q.number <= 10 || (q.number > 40 && q.number <= 50) ? 1 : 2, where);
      assert.ok((JAM_UNITS as readonly string[]).includes(q.unit), `${where} unit ${q.unit}`);
      assert.ok(q.stem.length > 10 && q.solution.length > 20, `${where} text`);
      if (q.type === "NAT") assert.equal(q.options.length, 0, where);
      else {
        assert.deepEqual(q.options.map((o) => o.label), ["A", "B", "C", "D"], where);
        if (q.key !== "all") assert.match(q.key, q.type === "MCQ" ? /^[A-D]$/ : /^[A-D](,[A-D])*$/, where);
      }
      if (q.type === "NAT" && q.key !== "all") assert.ok(!keyLabel(q).includes("NaN"), `${where} key ${q.key}`);
    }
  });
}

test("checkAnswer: MSQ needs the exact set, NAT uses ranges and alternatives", () => {
  assert.equal(checkAnswer({ type: "MCQ", key: "B" }, "B"), true);
  assert.equal(checkAnswer({ type: "MSQ", key: "A,C" }, ["C", "A"]), true);
  assert.equal(checkAnswer({ type: "MSQ", key: "A,C" }, ["A"]), false);
  assert.equal(checkAnswer({ type: "NAT", key: "0.41..0.43" }, "0.42"), true);
  assert.equal(checkAnswer({ type: "NAT", key: "0.41..0.43" }, "0.44"), false);
  assert.equal(checkAnswer({ type: "NAT", key: "4 or 600" }, "600"), true);
  assert.equal(checkAnswer({ type: "NAT", key: "-1" }, "−1"), true);
  assert.equal(checkAnswer({ type: "NAT", key: "1628012..1628013" }, "1,628,012"), true);
  assert.equal(checkAnswer({ type: "MCQ", key: "all" }, "A"), null);
  assert.equal(keyLabel({ type: "NAT", key: "4 or 600" }), "4 or 600");
});

// Cutoff data: OBC-NCL/EWS = 90% and SC/ST/PwD = 50% of General (from the unrounded General
// mark, so allow ±0.01 against the displayed one); the category counts in the official reports
// add up to the qualified total (PwD overlaps).
import { JAM_EN_CUTOFFS } from "@/data/jam-economics/cutoffs";
import { JAM_EN_SYLLABUS } from "@/data/jam-economics/syllabus";
test("JAM cutoff data is internally consistent", () => {
  const near = (a: number, b: number) => Math.abs(a - b) <= 0.0101;
  for (const d of JAM_EN_CUTOFFS) {
    if (d.cutoff) {
      assert.ok(near(d.cutoff.gen * 0.9, d.cutoff.obc), `${d.year} obc`);
      assert.ok(near(d.cutoff.gen * 0.5, d.cutoff.sc), `${d.year} sc`);
    }
    if (d.qualifiedBy && d.candidates) {
      const { GEN, EWS, SC, ST } = d.qualifiedBy;
      assert.equal(GEN + EWS + d.qualifiedBy["OBC-NCL"] + SC + ST, d.candidates.qualified, `${d.year} qualified total`);
    }
  }
});

test("syllabus units match the unit tags used by the questions", () => {
  assert.deepEqual(JAM_EN_SYLLABUS.map((s) => s.unit), [...JAM_UNITS]);
});

import { buildMockTests, markQuestion, scoreMock } from "@/lib/jam-mock";
test("mock tests: unique ids, full papers are 100 marks / 180 min, JAM marking", () => {
  const all = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).flatMap((f) => parseJamPaper(f.replace(".md", ""), fs.readFileSync(path.join(dir, f), "utf8")));
  const tests = buildMockTests(all);
  assert.equal(new Set(tests.map((t) => t.id)).size, tests.length);
  for (const t of tests.filter((t) => t.kind === "full")) assert.deepEqual([t.questionIds.length, t.marks, t.minutes], [60, 100, 180], t.id);
  assert.equal(tests.filter((t) => t.kind === "topic").reduce((n, t) => n + t.questionIds.length, 0), all.length);

  const mcq2 = { type: "MCQ" as const, key: "B", marks: 2 };
  assert.deepEqual(markQuestion(mcq2, { picked: ["A"], nat: "" }), { result: "wrong", marks: -2 / 3 });
  assert.deepEqual(markQuestion({ type: "MSQ", key: "A,C", marks: 2 }, { picked: ["A"], nat: "" }), { result: "wrong", marks: 0 });
  assert.deepEqual(markQuestion({ type: "NAT", key: "all", marks: 1 }, undefined), { result: "bonus", marks: 1 });
  assert.deepEqual(markQuestion(mcq2, { picked: [], nat: "" }), { result: "skipped", marks: 0 });
  const paper = all.filter((q) => q.year === "2025");
  const perfect = Object.fromEntries(paper.map((q) => [q.id, { picked: q.type === "NAT" ? [] : q.key.split(","), nat: q.type === "NAT" ? q.key.split(/\.\.| or /)[0] : "" }]));
  assert.equal(scoreMock(paper, perfect).score, 100);
});
