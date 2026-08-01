import { z } from "zod";

// A single, extensible content-block schema for places that need rich,
// mixed-media content OUTSIDE the existing SubjectNotes/StructuredNote
// system (src/lib/note-schema.ts) — specifically per-question PYQ content
// (Question.contentBlocks) and the reusable Content Blocks admin library
// (the ContentBlock model). StructuredNote's own section/definition/example
// model is intentionally left alone; this is a second, narrower schema for
// a genuinely different use case (arbitrary ordered blocks on one question),
// not a replacement.
//
// Every block gets an explicit `type` — content authors (admins) always
// pick the type; nothing here tries to auto-detect it from content.

const baseBlock = { id: z.string() };

export const MarkdownBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("markdown"),
  content: z.string(),
});

export const LatexBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("latex"),
  expression: z.string(),
  displayMode: z.boolean().default(true),
});

export const MermaidBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("mermaid"),
  chart: z.string(),
});

export const TableBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("table"),
  headers: z.array(z.string()).min(1),
  rows: z.array(z.array(z.string())),
  caption: z.string().optional(),
  highlightRows: z.array(z.number().int().min(0)).optional(),
  stickyFirstColumn: z.boolean().optional(),
});

export const ChartBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("chart"),
  title: z.string(),
  chartType: z.enum(["bar", "line", "area", "pie", "donut"]),
  labels: z.array(z.string()).min(2).max(12),
  values: z.array(z.number()).min(2).max(12),
});

export const ImageBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("image"),
  src: z.string(),
  alt: z.string().min(1, "Alt text is required"),
  caption: z.string().optional(),
  source: z.string().optional(),
});

export const PdfBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("pdf"),
  url: z.string(),
  title: z.string(),
  downloadable: z.boolean().default(true),
});

export const CalloutBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("callout"),
  variant: z.enum(["info", "important", "warning", "tip", "definition"]),
  title: z.string().optional(),
  content: z.string(),
});

export const QuizBlockSchema = z.object({
  ...baseBlock,
  type: z.literal("quiz"),
  question: z.string(),
  options: z.array(z.string()).min(2).max(6),
  correctAnswer: z.number().int().min(0),
  explanation: z.string().optional(),
});

export const StudyContentBlockSchema = z.discriminatedUnion("type", [
  MarkdownBlockSchema,
  LatexBlockSchema,
  MermaidBlockSchema,
  TableBlockSchema,
  ChartBlockSchema,
  ImageBlockSchema,
  PdfBlockSchema,
  CalloutBlockSchema,
  QuizBlockSchema,
]);
export type StudyContentBlock = z.infer<typeof StudyContentBlockSchema>;
export type StudyContentBlockType = StudyContentBlock["type"];

export const StudyContentBlockListSchema = z.array(StudyContentBlockSchema);

export const BLOCK_TYPE_LABELS: Record<StudyContentBlockType, string> = {
  markdown: "Markdown",
  latex: "Formula (LaTeX)",
  mermaid: "Diagram (Mermaid)",
  table: "Table",
  chart: "Chart",
  image: "Image",
  pdf: "PDF",
  callout: "Callout",
  quiz: "Practice question",
};

// A minimal, valid block of the given type with a fresh id — the single
// source of truth for "what does a brand-new block of type X look like",
// used both server-side (createContentBlockAction in src/lib/actions.ts)
// and client-side (the "Add block" control in BlockListEditor).
export function createDefaultBlock(type: StudyContentBlockType, id: string = crypto.randomUUID()): StudyContentBlock {
  switch (type) {
    case "latex":
      return { id, type: "latex", expression: "E = mc^2", displayMode: true };
    case "mermaid":
      return { id, type: "mermaid", chart: "flowchart TD\n  A[Start] --> B[End]" };
    case "table":
      return { id, type: "table", headers: ["Column A", "Column B"], rows: [["", ""]] };
    case "chart":
      return { id, type: "chart", title: "Untitled chart", chartType: "bar", labels: ["A", "B"], values: [1, 2] };
    case "image":
      return { id, type: "image", src: "", alt: "" };
    case "pdf":
      return { id, type: "pdf", url: "", title: "Untitled PDF", downloadable: true };
    case "callout":
      return { id, type: "callout", variant: "info", content: "" };
    case "quiz":
      return { id, type: "quiz", question: "", options: ["", ""], correctAnswer: 0 };
    case "markdown":
    default:
      return { id, type: "markdown", content: "" };
  }
}
