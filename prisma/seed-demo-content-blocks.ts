// Demonstration content for the unified study-content rendering system —
// attaches a full StudyContentBlock[] answer (markdown, callout, LaTeX,
// table, mermaid, mind-map, chart, image, embedded PDF reference, quiz) to
// one real Question on a real Delhi University subject/paper, so the demo
// flows end-to-end through the actual system (DB -> admin editor ->
// student Solutions/Practice tabs) instead of being a disconnected mock.
//
// Run with: npx tsx prisma/seed-demo-content-blocks.ts

import { prisma } from "../src/lib/prisma";
import type { StudyContentBlock } from "../src/lib/content/content-block-schema";

const DEMO_OCR_TEXT = `Delhi University
Course: B.Com (Hons)
Subject: Business Economics (DSC-5.2)
Semester: V
Duration: 3 Hours
Maximum Marks: 75

1. What do you understand by the law of diminishing marginal utility? Explain with a suitable example.

2. Distinguish between fixed cost and variable cost. How does the shape of the average cost curve change in the short run versus the long run?

(a) Define perfect competition.
(b) State two conditions necessary for a market to be perfectly competitive.

3. "A monopolist is a price maker, not a price taker." Discuss this statement with reference to the demand curve faced by a monopoly firm.

4. Explain the concept of market equilibrium with the help of a demand-supply diagram. What happens to equilibrium price and quantity when supply increases while demand remains constant?

5. Explain the concept of price elasticity of demand. Discuss the factors that determine whether a good has elastic or inelastic demand, and derive the formula used to measure it.
`;

const DEMO_BLOCKS: StudyContentBlock[] = [
  {
    id: "demo-markdown",
    type: "markdown",
    content:
      "**Price elasticity of demand** measures how responsive the quantity demanded of a good is to a change in its price. It is one of the most frequently tested concepts in DU Business Economics papers — examiners typically ask for the definition, the formula, the determining factors, and a worked numerical example together, exactly as in this question.",
  },
  {
    id: "demo-callout",
    type: "callout",
    variant: "definition",
    title: "Definition",
    content:
      "Price elasticity of demand (Ed) is the percentage change in quantity demanded divided by the percentage change in price, holding all other determinants of demand constant (ceteris paribus).",
  },
  {
    id: "demo-latex",
    type: "latex",
    expression: "E_d = \\dfrac{\\%\\Delta Q_d}{\\%\\Delta P}",
    displayMode: true,
  },
  {
    id: "demo-mermaid",
    type: "mermaid",
    chart: `flowchart TD
    A[Change in price] --> B{Compute %ΔQd and %ΔP}
    B --> C[Ed = %ΔQd / %ΔP]
    C --> D{|Ed| value}
    D -->|Ed > 1| E[Elastic demand]
    D -->|Ed = 1| F[Unit elastic demand]
    D -->|Ed < 1| G[Inelastic demand]`,
  },
  {
    id: "demo-table",
    type: "table",
    headers: ["Factor", "Effect on elasticity"],
    rows: [
      ["Availability of substitutes", "More substitutes → more elastic demand"],
      ["Necessity vs luxury", "Necessities tend to be inelastic; luxuries tend to be elastic"],
      ["Proportion of income spent", "Higher proportion of income → more elastic demand"],
      ["Time period", "Demand is more elastic in the long run than the short run"],
    ],
    caption: "Key determinants of price elasticity of demand",
  },
  {
    id: "demo-chart",
    type: "chart",
    title: "Elasticity by good category (illustrative)",
    chartType: "bar",
    labels: ["Salt", "Rice", "Restaurant meals", "Air travel"],
    values: [0.1, 0.4, 1.2, 1.8],
  },
  {
    id: "demo-image",
    type: "image",
    src:
      "data:image/svg+xml;utf8," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" font-family="sans-serif">
          <rect width="400" height="260" fill="#FFFFFF"/>
          <line x1="50" y1="20" x2="50" y2="220" stroke="#172033" stroke-width="2"/>
          <line x1="50" y1="220" x2="380" y2="220" stroke="#172033" stroke-width="2"/>
          <text x="10" y="120" font-size="13" fill="#172033" transform="rotate(-90 10,120)">Price</text>
          <text x="360" y="245" font-size="13" fill="#172033">Quantity</text>
          <line x1="60" y1="40" x2="360" y2="200" stroke="#DC2626" stroke-width="3"/>
          <text x="290" y="185" font-size="13" fill="#DC2626">Elastic (Ed &gt; 1)</text>
          <line x1="80" y1="30" x2="200" y2="210" stroke="#2563EB" stroke-width="3"/>
          <text x="205" y="60" font-size="13" fill="#2563EB">Inelastic (Ed &lt; 1)</text>
        </svg>`,
      ),
    alt: "Line diagram comparing a flat (elastic) demand curve against a steep (inelastic) demand curve on the same price-quantity axes",
    caption: "A flatter demand curve corresponds to more elastic demand; a steeper curve to less elastic demand.",
    source: "Illustrative diagram for NoteVault",
  },
  {
    id: "demo-quiz",
    type: "quiz",
    question: "If a 10% rise in the price of a good causes quantity demanded to fall by 20%, the demand for that good is:",
    options: ["Perfectly inelastic", "Inelastic (Ed < 1)", "Elastic (Ed > 1)", "Perfectly elastic"],
    correctAnswer: 2,
    explanation: "Ed = %ΔQd / %ΔP = -20% / 10% = -2 (magnitude 2), which is greater than 1 — so demand is elastic.",
  },
];

async function main() {
  const resource = await prisma.resource.findFirst({
    where: { type: "PYQ", subject: { name: { contains: "Business Economics", mode: "insensitive" } } },
    include: { subject: true },
  });

  if (!resource) {
    console.error("No matching PYQ resource found (expected a 'Business Economics' subject) — nothing to seed.");
    process.exit(1);
  }

  await prisma.resource.update({
    where: { id: resource.id },
    data: {
      ocrText: resource.ocrText ?? DEMO_OCR_TEXT,
      paperCode: resource.paperCode ?? "DSC-5.2",
      session: resource.session ?? "May-June",
      duration: resource.duration ?? "3 hours",
      maximumMarks: resource.maximumMarks ?? 75,
      ocrStatus: "COMPLETED",
    },
  });

  const existing = await prisma.question.findFirst({
    where: { resourceId: resource.id, questionNumber: "5" },
  });

  const data = {
    subjectId: resource.subjectId,
    resourceId: resource.id,
    questionText:
      "Explain the concept of price elasticity of demand. Discuss the factors that determine whether a good has elastic or inelastic demand, and derive the formula used to measure it.",
    answerText:
      "Price elasticity of demand measures the responsiveness of quantity demanded to a change in price. It is calculated as the percentage change in quantity demanded divided by the percentage change in price. Demand is elastic when this value exceeds 1, unit elastic when it equals 1, and inelastic when it is less than 1. Key determinants include the availability of substitutes, whether the good is a necessity or luxury, the proportion of income it represents, and the time period under consideration. See the diagrams, formula, and table below for a full worked breakdown.",
    marks: 10,
    questionNumber: "5",
    section: "Section B",
    topics: ["Elasticity of Demand", "Microeconomics", "Business Economics"],
    difficulty: "MEDIUM" as const,
    contentBlocks: DEMO_BLOCKS,
    isRepeated: true,
    repeatCount: 3,
    years: "2022,2023,2024",
  };

  const question = existing
    ? await prisma.question.update({ where: { id: existing.id }, data })
    : await prisma.question.create({ data });

  console.log(`Seeded demo question ${question.id} on resource ${resource.id} (${resource.title}).`);
  console.log(`View it at /pyq-notes/${resource.id} (Solutions / Practice tabs) once deployed.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
