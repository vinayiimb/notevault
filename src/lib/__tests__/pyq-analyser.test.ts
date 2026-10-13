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

test("parseSolvedText reads ChatGPT-style solved papers", async () => {
  const { parseSolvedText } = await import("@/lib/pyq-analyser");
  const text = [
    "# BUSINESS ECONOMICS — COMPLETE SOLVED PYQs",
    "# UNIT 1 — INTRODUCTION TO BUSINESS ECONOMICS",
    "## BUSINESS ECONOMICS (PROGRAMME) — QUESTION 1(b)",
    "Question: A consumer has preferences for two complementary goods, pen and ink. Measure the cross elasticity.",
    "Unit tag: Unit 1 — Introduction to Business Economics",
    "### 3. Formula",
    "\\\\[ E\\_{xy}=\\frac{-50\\\\%}{100\\\\%}=\\boxed{-0.5} \\\\]",
    "| Type | Value |",
    "| --- | --- |",
    "| Inelastic | \\\\(0\\<E_s<1\\\\) |",
    "### 4. Diagram",
    "[Supply And Demand Graph](https://images.openai.com/static-rsc-4/abc?purpose=inline)",
    "",
    "[storage.googleapis.com](https://storage.googleapis.com/x.html)",
    "",
    "Show the demand curve for ink shifting left.",
    "## BUSINESS ECONOMICS (HONS.) — QUESTION 2(b) OR",
    "Question: Ram divides his income in consumption and savings.",
    "Unit tag: Unit 2 — Consumer Behaviour",
    "Answer body.",
    "##",
  ].join("\n");
  const qs = parseSolvedText(text);
  assert.equal(qs.length, 2);
  assert.deepEqual(
    qs.map((q) => [q.group, q.questionNumber, q.unit]),
    [
      ["BUSINESS ECONOMICS (PROGRAMME)", "1(b)", "Unit 1 — Introduction to Business Economics"],
      ["BUSINESS ECONOMICS (HONS.)", "2(b) OR", "Unit 2 — Consumer Behaviour"],
    ],
  );
  assert.match(qs[0].questionText, /^A consumer has preferences/);
  assert.ok(qs[0].answer.includes("$$\nE_{xy}=\\frac{-50\\%}{100\\%}=\\boxed{-0.5}\n$$"), qs[0].answer);
  assert.ok(qs[0].answer.includes("| Inelastic | $0<E_s<1$ |"));
  assert.ok(!qs[0].answer.includes("images.openai.com") && !qs[0].answer.includes("storage.googleapis"));
  assert.ok(qs[0].answer.includes("Show the demand curve for ink shifting left."));
  assert.equal(qs[1].answer, "Answer body.");
});

test("normalizeMath also takes single-backslash delimiters", async () => {
  const { normalizeMath } = await import("@/lib/pyq-analyser");
  assert.equal(normalizeMath("a \\(x\\_1\\) b"), "a $x_1$ b");
  assert.equal(normalizeMath("[link](http://x.com)"), "[link](http://x.com)");
});
