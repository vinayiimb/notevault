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
  assert.ok(qs[0].answer.includes("### 4. Diagram\n\n<!-- diagram -->\n\nShow the demand curve"), qs[0].answer);
  assert.ok(qs[0].answer.includes("Show the demand curve for ink shifting left."));
  assert.equal(qs[1].answer, "Answer body.");
});

test("normalizeMath also takes single-backslash delimiters", async () => {
  const { normalizeMath } = await import("@/lib/pyq-analyser");
  assert.equal(normalizeMath("a \\(x\\_1\\) b"), "a $x_1$ b");
  assert.equal(normalizeMath("[link](http://x.com)"), "[link](http://x.com)");
  assert.equal(normalizeMath("| \\\\(\\|E_d\\|=1\\\\) |"), "| $\\vert E_d\\vert =1$ |");
});

test("diagramContext takes the heading above and the text below the marker", async () => {
  const { diagramContext, DIAGRAM_MARKER } = await import("@/lib/pyq-analyser");
  const a = `intro\n### 3. Diagram of price control\n\n${DIAGRAM_MARKER}\n\nShow the controlled price below equilibrium.\n\n### 4. Next\nother`;
  assert.equal(diagramContext(a, a.indexOf(DIAGRAM_MARKER)), "3. Diagram of price control\nShow the controlled price below equilibrium.");
});

test("diagram library: parse cards and match each marker to the right diagram", async () => {
  const { parseDiagramLibrary, fillDiagramsFromLibrary, DIAGRAM_MARKER } = await import("@/lib/pyq-analyser");
  const fs = await import("node:fs");
  const os = await import("node:os");
  const file = `${os.homedir()}/Downloads/business_economics_coded_diagrams.html`;
  const html = fs.existsSync(file)
    ? fs.readFileSync(file, "utf8")
    : '<h3>2. Complementary goods: demand for ink falls</h3><svg viewBox="0 0 1 1"><path d="M0 0"/></svg><h3>5. Binding price ceiling and shortage</h3><svg viewBox="0 0 1 1"></svg><h3>9. Budget line: income changes</h3><svg viewBox="0 0 1 1"></svg><h3>4. Supply decreases after input costs rise</h3><svg viewBox="0 0 1 1"></svg>';
  const lib = parseDiagramLibrary(html);
  assert.ok(lib.length >= 4);
  assert.ok(lib.every((d) => d.svg.startsWith("<svg") && d.svg.endsWith("</svg>") && !/^\d/.test(d.title)));
  const pick = (q: string, ctx: string) => {
    const r = fillDiagramsFromLibrary(q, `### Diagram\n\n${DIAGRAM_MARKER}\n\n${ctx}`, lib);
    return r.answer.match(/<figcaption>([^<]+)/)?.[1];
  };
  assert.equal(pick("A consumer has preferences for two complementary goods, pen and ink.", "Show the demand curve for ink shifting left."), "Complementary goods: demand for ink falls");
  assert.equal(pick("If the government does not allow the price of cream cheese to change what problems arise?", "Show the government-controlled price ceiling below equilibrium; shortage."), "Binding price ceiling and shortage");
  assert.equal(pick("Draw the budget lines for income ₹6,000 and when income changes.", "Label BL₁, BL₂, BL₃."), "Budget line: income changes");
  assert.equal(fillDiagramsFromLibrary("zzz", `${DIAGRAM_MARKER}`, lib).filled, 0);
});

test("the ChatGPT prompt names the paper and its answer format round-trips through the parser", async () => {
  const { solvedPaperPrompt, parseSolvedText } = await import("@/lib/pyq-analyser");
  const prompt = solvedPaperPrompt({ course: "B.Com. (Hons.)", semester: 5, subject: "Business Economics", upc: "2412083502", paperType: "DSC", year: "2024" });
  assert.match(prompt, /Paper: Business Economics \(DSC, UPC 2412083502\)/);
  assert.match(prompt, /## BUSINESS ECONOMICS — QUESTION 1\(a\)/);
  // A reply written the way the prompt asks, including an inline SVG.
  const reply = [
    "## BUSINESS ECONOMICS — QUESTION 1(a)",
    "Question: Explain the law of supply.",
    "",
    "Unit tag: Unit 1 — Introduction to Business Economics",
    "",
    "### 1. Meaning",
    "Supply rises with price \\(P\\).",
    "",
    "### 2. Diagram",
    '<svg class="diagram" viewBox="0 0 440 300"><path class="axis" d="M55 25V250H405"/><path class="curve green" d="M90 220L365 55"/><text x="370" y="55">S</text></svg>',
    "Draw an upward-sloping S curve.",
    "",
    "## BUSINESS ECONOMICS — QUESTION 1(a) OR",
    "Question: Explain elasticity of supply.",
    "",
    "Unit tag: Unit 1 — Introduction to Business Economics",
    "",
    "Answer.",
  ].join("\n");
  const qs = parseSolvedText(reply);
  assert.deepEqual(qs.map((q) => q.questionNumber), ["1(a)", "1(a) OR"]);
  assert.ok(qs[0].answer.includes("<svg") && qs[0].answer.includes("$P$"));
});

test("bundles: detection, asset inlining and per-question documents", async () => {
  const { isBundle, inlineBundleAssets, bundleDocument } = await import("@/lib/pyq-analyser");
  assert.ok(isBundle("  <!DOCTYPE html><html>…"));
  assert.ok(isBundle("<html lang='en'>"));
  assert.ok(!isBundle("### 1. Meaning\n<svg></svg>"));
  const html = '<link rel="stylesheet" href="./styles.css"><link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css"><script src="app.js"></script><script src="https://cdn.jsdelivr.net/npm/chart.js"></script>';
  const out = inlineBundleAssets(html, { "styles.css": "body{color:red}", "app.js": "console.log('</script>')" });
  assert.ok(out.includes("<style>body{color:red}</style>"));
  assert.ok(out.includes('href="https://cdn.jsdelivr.net/npm/katex/dist/katex.min.css"'), "CDN links stay");
  assert.ok(out.includes("<script>console.log('<\\/script>')</script>"), "inlined JS can't close the tag early");
  assert.ok(out.includes('src="https://cdn.jsdelivr.net/npm/chart.js"'));
  const doc = bundleDocument("<style>x</style>", '<section data-question="1(a)">A</section>');
  assert.ok(isBundle(doc) && doc.includes('<head><meta charset="utf-8">') && doc.includes("<section"));
});

test("section.q bundles: question heading, labels, diagram CSS and prompts", async () => {
  const { parseQuestionHeading, stripLabel, bundleDocument, solvedBundlePrompt, solvedPaperPrompt } = await import("@/lib/pyq-analyser");
  assert.deepEqual(parseQuestionHeading("CLIMATOLOGY — QUESTION 1(a)"), { group: "CLIMATOLOGY", questionNumber: "1(a)" });
  assert.deepEqual(parseQuestionHeading(" BUSINESS ECONOMICS (HONS.) –  QUESTION 3(b) OR "), { group: "BUSINESS ECONOMICS (HONS.)", questionNumber: "3(b) OR" });
  assert.equal(parseQuestionHeading("1. Meaning"), null);
  assert.equal(stripLabel(" Question:  Write short notes on (a) Humidity"), "Write short notes on (a) Humidity");
  assert.equal(stripLabel("Unit II — Atmospheric Moisture"), "Unit II — Atmospheric Moisture");
  const doc = bundleDocument("<style>.own{}</style>", "<section></section>");
  assert.ok(doc.indexOf("svg.flow rect.n") < doc.indexOf(".own{}"), "bundle's own CSS comes after and wins");
  const s = { course: "B.A. (Hons) Geography", semester: 3, subject: "Climatology", upc: "2292102301", paperType: "DSC", year: "2025" };
  const bundle = solvedBundlePrompt(s);
  assert.ok(bundle.includes("<h2>CLIMATOLOGY — QUESTION 1(a)</h2>") && bundle.includes('class="qtext"') && bundle.includes('class="diagram flow"'));
  const text = solvedPaperPrompt(s);
  assert.ok(text.includes("## CLIMATOLOGY — QUESTION 1(a)") && text.includes("never Mermaid") && !text.includes("```mermaid"));
});
