import { z } from "zod";

// The single source of truth for a "structured note" — the AI generation
// pipeline (src/lib/ai.ts's generateStructuredNote* functions) validates its
// assembled output against this before anything is saved, and
// StructuredNoteRenderer's props are this schema's inferred type. Content
// (this file) and presentation (src/lib/note-theme.ts) are deliberately
// separate modules — nothing here describes color, font, or spacing.

export const CalloutTypeSchema = z.enum(["none", "definition", "important", "warning", "exam-tip"]);
export type CalloutType = z.infer<typeof CalloutTypeSchema>;

export const CalloutSchema = z.object({
  type: CalloutTypeSchema,
  text: z.string(),
});

export const NoteMetadataSchema = z.object({
  subject: z.string(),
  chapter: z.string(),
  title: z.string(),
  estimatedReadingMinutes: z.number().int().min(1).max(60),
  tags: z.array(z.string()).max(8),
});
export type NoteMetadata = z.infer<typeof NoteMetadataSchema>;

export const SectionSchema = z.object({
  id: z.string(),
  heading: z.string(),
  content: z.string(),
  callout: CalloutSchema.nullable(),
});
export type NoteSection = z.infer<typeof SectionSchema>;

export const DefinitionSchema = z.object({
  term: z.string(),
  definition: z.string(),
});

export const FormulaSchema = z.object({
  name: z.string(),
  expression: z.string(),
  description: z.string().nullable(),
});

export const ExampleSchema = z.object({
  title: z.string().nullable(),
  prompt: z.string(),
  solution: z.string(),
});

// ---------- Visual (one of nine diagram families, or none) ----------
// Each variant carries only the data its own renderer actually needs (see
// src/components/subjects/visuals/*) rather than forcing every diagram type
// through one generic nodes/edges shape — a Venn diagram's set-membership
// data and a chart's labels/values have nothing in common with a
// flowchart's graph, and pretending otherwise would make every renderer
// worse. `title`/`highlight`/`annotations` stay common across the
// graph-like family so the shared GraphVisual component can render all of
// flowchart/mind-map/timeline/concept-tree/geometry-adjacent cases with one
// implementation, matching "3 to 7 primary nodes, short labels, no crossed
// connectors" from the visual-design rules.

const GraphNodeSchema = z.object({
  id: z.string(),
  label: z.string().max(60),
  group: z.string().nullable(), // pastel grouping color key, e.g. "cause" | "effect"
  // Timeline: an ISO date or free-text period ("1857", "Q3"); ignored by
  // every other graph-like visual type.
  order: z.string().nullable(),
});
const GraphEdgeSchema = z.object({
  from: z.string(),
  to: z.string(),
  label: z.string().nullable(),
});

const GraphVisualBase = z.object({
  title: z.string(),
  nodes: z.array(GraphNodeSchema).min(2).max(7),
  edges: z.array(GraphEdgeSchema).max(12),
  annotations: z.array(z.string()).max(5),
  highlight: z.string().nullable(), // id of the node to visually highlight
});

const ComparisonVisualSchema = z.object({
  type: z.literal("comparison"),
  title: z.string(),
  columns: z.array(z.string()).min(2).max(4),
  rows: z.array(z.object({ label: z.string(), cells: z.array(z.string()) })).min(2).max(8),
  annotations: z.array(z.string()).max(5),
});

const ChartVisualSchema = z.object({
  type: z.literal("chart"),
  title: z.string(),
  chartType: z.enum(["bar", "line", "area", "pie", "donut"]),
  labels: z.array(z.string()).min(2).max(12),
  values: z.array(z.number()).min(2).max(12),
  annotations: z.array(z.string()).max(5),
});

const VennVisualSchema = z.object({
  type: z.literal("venn"),
  title: z.string(),
  sets: z.array(z.object({ id: z.string(), label: z.string(), items: z.array(z.string()).max(6) })).min(2).max(3),
  overlapItems: z.array(z.string()).max(6),
  annotations: z.array(z.string()).max(5),
});

const GeometryShapeSchema = z.object({
  id: z.string(),
  kind: z.enum(["triangle", "circle", "rectangle", "line", "angle"]),
  labels: z.array(z.string()).max(6),
  measurements: z.array(z.string()).max(6),
});
const GeometryVisualSchema = z.object({
  type: z.literal("geometry"),
  title: z.string(),
  shapes: z.array(GeometryShapeSchema).min(1).max(4),
  annotations: z.array(z.string()).max(5),
});

const SolutionSheetVisualSchema = z.object({
  type: z.literal("solution-sheet"),
  title: z.string(),
  steps: z.array(z.object({ step: z.number().int().min(1), description: z.string(), expression: z.string().nullable() })).min(1).max(10),
  annotations: z.array(z.string()).max(5),
});

const NoneVisualSchema = z.object({ type: z.literal("none") });

export const VisualSchema = z.discriminatedUnion("type", [
  NoneVisualSchema,
  GraphVisualBase.extend({ type: z.literal("flowchart") }),
  GraphVisualBase.extend({ type: z.literal("mind-map") }),
  GraphVisualBase.extend({ type: z.literal("timeline") }),
  GraphVisualBase.extend({ type: z.literal("concept-tree") }),
  ComparisonVisualSchema,
  ChartVisualSchema,
  VennVisualSchema,
  GeometryVisualSchema,
  SolutionSheetVisualSchema,
]);
export type Visual = z.infer<typeof VisualSchema>;
export type GraphVisual = Extract<Visual, { nodes: unknown }>;

export const StructuredNoteSchema = z.object({
  metadata: NoteMetadataSchema,
  summary: z.string(),
  keyFacts: z.array(z.string()).min(3).max(7),
  sections: z.array(SectionSchema).min(1).max(8),
  definitions: z.array(DefinitionSchema).max(12),
  formulas: z.array(FormulaSchema).max(8),
  examples: z.array(ExampleSchema).max(6),
  commonMistakes: z.array(z.string()).max(6),
  visual: VisualSchema,
  takeaway: z.string(),
  sources: z.array(z.string()).max(10),
});
export type StructuredNote = z.infer<typeof StructuredNoteSchema>;

export function isGraphVisual(visual: Visual): visual is GraphVisual {
  return "nodes" in visual;
}
