import type { StructuredNote } from "@/lib/note-schema";

// Fixture used by the Note Designer's live preview (src/components/admin/
// note-theme-editor.tsx) — a real, complete StructuredNote so every themed
// component (including a graph visual) actually renders while an admin
// edits colors/typography/layout, without needing a real note in the DB.
export const SAMPLE_NOTE: StructuredNote = {
  metadata: {
    subject: "Economics",
    chapter: "Money & Banking",
    title: "How Commercial Banks Create Credit",
    estimatedReadingMinutes: 6,
    tags: ["money", "banking", "macro"],
  },
  summary:
    "Commercial banks don't just store deposits — they create new money by lending out a fraction of what's deposited, a process economists call credit creation. This note walks through how a single deposit expands into a much larger amount of total credit across the banking system.",
  keyFacts: [
    "Banks keep a fraction of deposits as reserves and lend out the rest.",
    "The reserve ratio determines how much new credit one deposit can create.",
    "The credit multiplier = 1 / reserve ratio.",
    "Central banks use the reserve ratio as a monetary policy tool.",
  ],
  sections: [
    {
      id: "how-it-starts",
      heading: "How it starts",
      content:
        "A customer deposits ₹1,000 into Bank A. Assuming a 10% reserve ratio, Bank A keeps ₹100 in reserve and lends out the remaining ₹900.",
      callout: { type: "definition", text: "Reserve ratio: the fraction of deposits a bank must hold back rather than lend out." },
    },
    {
      id: "the-multiplier-effect",
      heading: "The multiplier effect",
      content:
        "The ₹900 loan is spent and re-deposited into Bank B, which keeps ₹90 in reserve and lends ₹810. This repeats across the banking system, and the total credit created is a multiple of the original deposit.",
      callout: { type: "exam-tip", text: "Total credit created = original deposit × (1 / reserve ratio)." },
    },
  ],
  definitions: [
    { term: "Credit creation", definition: "The process by which banks generate new deposits/loans beyond their initial reserves." },
  ],
  formulas: [{ name: "Credit multiplier", expression: "1 / reserve ratio", description: "Also called the money multiplier." }],
  examples: [
    {
      title: "10% reserve ratio",
      prompt: "A ₹1,000 deposit is made with a 10% reserve ratio. What is the maximum total credit created?",
      solution: "Multiplier = 1 / 0.10 = 10. Total credit = ₹1,000 × 10 = ₹10,000.",
    },
  ],
  commonMistakes: ["Forgetting that the multiplier applies to the whole banking system, not just one bank."],
  visual: {
    type: "flowchart",
    title: "Credit creation across banks",
    nodes: [
      { id: "deposit", label: "₹1,000 deposit", group: "start", order: null },
      { id: "banka", label: "Bank A lends ₹900", group: "bank", order: null },
      { id: "bankb", label: "Bank B lends ₹810", group: "bank", order: null },
      { id: "total", label: "Total credit: ₹10,000", group: "result", order: null },
    ],
    edges: [
      { from: "deposit", to: "banka", label: null },
      { from: "banka", to: "bankb", label: "re-deposited" },
      { from: "bankb", to: "total", label: "repeats..." },
    ],
    annotations: ["Assumes a 10% reserve ratio held constant at every bank."],
    highlight: "total",
  },
  takeaway: "A single deposit expands into a much larger amount of system-wide credit — the smaller the reserve ratio, the bigger the multiplier.",
  sources: ["NCERT Macroeconomics, Chapter 3"],
};
