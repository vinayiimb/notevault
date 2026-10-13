import { test } from "node:test";
import assert from "node:assert/strict";
import { findRepeat, parseYears, similarity, tally } from "@/lib/pyq-analyser";

test("parseYears dedupes, sorts and ignores junk", () => {
  assert.deepEqual(parseYears("2023, 2021 ,2023, abc, 99"), ["2021", "2023"]);
  assert.deepEqual(parseYears(null), []);
});

test("re-worded repeat matches, different question does not", () => {
  const existing = [
    { id: "a", questionText: "Explain price elasticity of demand and the factors that determine it." },
    { id: "b", questionText: "What is a production possibility curve? Explain with a diagram." },
  ];
  assert.equal(findRepeat("Discuss the factors that determine price elasticity of demand.", existing)?.id, "a");
  assert.equal(findRepeat("Explain the law of variable proportions.", existing), null);
  // Short re-ask of a long question (real case from the dev DB).
  const long = [{ questionText: "Explain the concept of price elasticity of demand. Discuss the factors that determine whether a good has elastic or inelastic demand, and derive the formula used to measure it." }];
  assert.ok(findRepeat("Explain the concept of price elasticity of demand. What are its determinants?", long));
  // A tiny question sharing one topic word must not merge into it.
  assert.equal(findRepeat("Write a short note on elasticity of supply.", long), null);
  assert.equal(findRepeat("Distinguish between movement along and shift in demand curve.", long), null);
  assert.equal(similarity("", "anything"), 0);
});

test("tally counts each topic once per question, most common first", () => {
  assert.deepEqual(tally([["A", "B"], ["A", "A"], ["C"]]), [
    { key: "A", count: 2 },
    { key: "B", count: 1 },
    { key: "C", count: 1 },
  ]);
});
