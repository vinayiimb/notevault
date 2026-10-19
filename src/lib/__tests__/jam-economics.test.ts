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
