import type { ReactNode } from "react";
import { isValidElement } from "react";
import {
  Article,
  Calculator,
  CheckCircle,
  GraduationCap,
  Info,
  Lightbulb,
  ListChecks,
  Sigma,
  Star,
  Warning,
  WarningCircle,
} from "@phosphor-icons/react";

// Recognizes exam-answer paragraph labels ("**Definition:** ...",
// "**Working Note 1:** ...", "Exam tip: ...") that already occur naturally
// in AI-compiled, hand-written, and OCR-reformatted notes, and turns just
// those paragraphs into a labeled card — no new markdown syntax to learn.
//
// This is the union of two vocabularies that used to live in two separate,
// independently-maintained files: the original exam-answer-oriented set
// (definition/formula/working/final/example/note/warning) that real
// published notes already depend on, plus a more general study-notes set
// (tip/error/important/exam-tip/summary) from a later prototype. Both are
// kept — dropping either would visually break live content.
export type CalloutKind =
  | "definition"
  | "formula"
  | "working"
  | "final"
  | "example"
  | "note"
  | "warning"
  | "tip"
  | "error"
  | "important"
  | "exam-tip"
  | "summary";

const CALLOUT_LABELS: Record<string, CalloutKind> = {
  definition: "definition",
  meaning: "definition",
  introduction: "definition",
  given: "working",
  required: "working",
  formula: "formula",
  method: "formula",
  substitution: "working",
  calculation: "working",
  working: "working",
  verification: "working",
  assumption: "working",
  assumptions: "working",
  units: "working",
  "final answer": "final",
  answer: "final",
  result: "final",
  conclusion: "final",
  example: "example",
  "examiner tip": "example",
  note: "note",
  "source note": "note",
  warning: "warning",
  precaution: "warning",
  precautions: "warning",
  caution: "warning",
  tip: "tip",
  mistake: "error",
  "common mistake": "error",
  important: "important",
  "key point": "important",
  "exam tip": "exam-tip",
  "exam point": "exam-tip",
  summary: "summary",
  remember: "summary",
};

function labelToKind(rawLabel: string): CalloutKind | null {
  const key = rawLabel.trim().toLowerCase();
  if (CALLOUT_LABELS[key]) return CALLOUT_LABELS[key];
  if (/^working note\b/.test(key)) return "working";
  return null;
}

function flattenToText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenToText).join("");
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    return flattenToText(props.children);
  }
  return "";
}

// Handles two shapes: a plain-text label ("Definition: ...") and a
// bold-wrapped label as its own inline element ("**Definition:** ..." —
// bold creates a separate child node from the text after it). Dropping
// either path would break real published content authored in that style.
export function detectCallout(
  children: ReactNode,
): { kind: CalloutKind; label: string; rest: ReactNode[] } | null {
  const nodes = Array.isArray(children) ? children : [children];
  const [first, ...restNodes] = nodes;
  if (first == null) return null;

  if (typeof first === "string") {
    const match = first.match(/^\s*([A-Za-z][A-Za-z \d]{1,28}?)\s*:\s*([\s\S]*)$/);
    if (!match) return null;
    const kind = labelToKind(match[1]);
    if (!kind) return null;
    return { kind, label: match[1].trim(), rest: [match[2], ...restNodes] };
  }

  if (isValidElement(first)) {
    const text = flattenToText(first).trim();
    const match = text.match(/^([A-Za-z][A-Za-z \d]{1,28}?)\s*:?\s*$/);
    if (!match) return null;
    const kind = labelToKind(match[1]);
    if (!kind) return null;
    const rest = [...restNodes];
    if (typeof rest[0] === "string") {
      rest[0] = rest[0].replace(/^\s*:\s*/, "");
    }
    return { kind, label: match[1].trim(), rest };
  }

  return null;
}

// Canonical display heading per kind — used when a callout is authored
// directly as structured data (Phase G's standalone CalloutBox) rather than
// detected from a typed label, so there's no original label text to echo.
export const CANONICAL_HEADING: Record<CalloutKind, string> = {
  definition: "Definition",
  formula: "Formula",
  working: "Working note",
  final: "Final answer",
  example: "Example",
  note: "Note",
  warning: "Warning",
  tip: "Tip",
  error: "Common mistake",
  important: "Important",
  "exam-tip": "Exam tip",
  summary: "Remember",
};

// Icon per kind, shared by the Markdown-detected callout cards
// (notes-markdown.tsx) and the standalone CalloutBox (Phase G).
export const CALLOUT_ICONS: Record<CalloutKind, typeof Article> = {
  definition: Article,
  formula: Sigma,
  working: Calculator,
  final: CheckCircle,
  example: Lightbulb,
  note: Info,
  warning: Warning,
  tip: Lightbulb,
  error: WarningCircle,
  important: Star,
  "exam-tip": GraduationCap,
  summary: ListChecks,
};

// Tailwind class bundles keyed by kind, reused by both the Markdown-detected
// callout cards and the standalone CalloutBox.
export const CALLOUT_STYLES: Record<CalloutKind, { card: string; label: string }> = {
  definition: { card: "border-sky-soft bg-sky-soft/40", label: "text-sky-dark" },
  formula: { card: "border-notes-violet-soft bg-notes-violet-soft/40", label: "text-notes-violet-dark" },
  working: { card: "border-notes-amber-soft bg-notes-amber-soft/40", label: "text-notes-amber-dark" },
  final: { card: "border-notes-emerald-soft bg-notes-emerald-soft/40", label: "text-notes-emerald-dark" },
  example: { card: "border-accent-soft bg-accent-soft/40", label: "text-accent" },
  note: { card: "border-border bg-surface-muted", label: "text-muted" },
  warning: {
    card: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
    label: "text-red-700 dark:text-red-300",
  },
  tip: {
    card: "border-notes-emerald-soft bg-notes-emerald-soft/40",
    label: "text-notes-emerald-dark",
  },
  error: {
    card: "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30",
    label: "text-red-700 dark:text-red-300",
  },
  important: { card: "border-accent-soft bg-accent-soft/40", label: "text-accent" },
  "exam-tip": { card: "border-notes-amber-soft bg-notes-amber-soft/40", label: "text-notes-amber-dark" },
  summary: { card: "border-sky-soft bg-sky-soft/40", label: "text-sky-dark" },
};
