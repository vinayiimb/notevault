"use client";

import { isValidElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { contentSanitizeSchema } from "@/lib/content/sanitize-schema";
import { ContentThemeProvider } from "@/components/content/notes/theme-provider";
import { ContentMermaidBlock } from "@/components/content/notes/mermaid-block";
import { DataChart } from "@/components/subjects/data-chart";
import type { NotesLabColorTokens } from "@/lib/content/theme-presets";
import { EconDiagram } from "./econ-diagram";
import { ZoomableFigure } from "./zoomable-figure";
import "./solution.css";

function text(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return text(node.props.children);
  return "";
}

// Greyscale tokens so mermaid flowcharts match the plain solution style.
const mono = (dark: boolean): NotesLabColorTokens => {
  const [bg, fg, muted, line, soft] = dark
    ? ["#0b0b0c", "#f4f4f5", "#a1a1aa", "#3f3f46", "#18181b"]
    : ["#ffffff", "#111111", "#52525b", "#d4d4d8", "#f4f4f5"];
  return {
    background: bg, surface: bg, surfaceMuted: soft, border: line, text: fg, textMuted: muted,
    primary: fg, primaryText: bg, secondary: muted, accent: fg, success: fg, warning: fg, error: fg,
    info: fg, link: fg, selection: soft, gradientFrom: fg, gradientTo: fg,
  };
};
const MONO = { light: mono(false), dark: mono(true) };

// Admin-supplied coded SVG diagrams (the Business Economics diagram library):
// shapes, text and presentation attributes only — no style, href, <use>,
// <foreignObject> or event handlers, which the base schema already drops.
const SVG_TAGS = ["svg", "g", "path", "line", "polyline", "polygon", "circle", "ellipse", "rect", "text", "tspan"];
const SVG_ATTRS = [
  "className", "viewBox", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points",
  "fill", "fillOpacity", "stroke", "strokeWidth", "strokeDasharray", "strokeLinecap", "strokeLinejoin", "opacity",
  "textAnchor", "dominantBaseline", "fontSize", "fontWeight", "transform", "dx", "dy",
];
const schema = {
  ...contentSanitizeSchema,
  tagNames: [...(contentSanitizeSchema.tagNames ?? []), ...SVG_TAGS],
  attributes: { ...contentSanitizeSchema.attributes, ...Object.fromEntries(SVG_TAGS.map((t) => [t, SVG_ATTRS])) },
};

// A bare <svg> pasted in an answer becomes its own HTML block (blank lines
// inside it would otherwise end the block and leak markup as text).
function wrapSvgs(md: string) {
  return md.replace(/(<figure class="pyq-svg">)?(<svg[\s\S]*?<\/svg>)/g, (_, fig, svg: string) => {
    const tight = svg.replace(/\n\s*\n/g, "\n");
    return fig ? fig + tight : `\n\n<figure class="pyq-svg">${tight}</figure>\n\n`;
  });
}

const components: Components = {
  figure: ({ className, children }) => (
    <ZoomableFigure>
      <figure className={className}>{children}</figure>
    </ZoomableFigure>
  ),
  table: ({ children }) => (
    <div className="pyq-table">
      <table>{children}</table>
    </div>
  ),
  pre: ({ children }) => <>{children}</>,
  code: ({ className, children }) => {
    const lang = /language-([\w-]+)/.exec(className ?? "")?.[1];
    if (!lang) return <code>{children}</code>;
    const raw = text(children).replace(/\n$/, "");
    if (lang === "diagram")
      return (
        <ZoomableFigure>
          <EconDiagram source={raw} />
        </ZoomableFigure>
      );
    if (lang === "mermaid") return <ContentMermaidBlock chart={raw} />;
    if (lang === "chart") return <DataChart source={raw} />;
    return (
      <pre className="overflow-x-auto rounded-lg bg-surface-muted p-3 text-sm">
        <code>{raw}</code>
      </pre>
    );
  },
};

/** Exam-sheet rendering for PYQ solutions: tables, KaTeX, inline <svg>, ```diagram, ```mermaid, ```chart. */
export function SolutionMarkdown({ content }: { content: string }) {
  return (
    <ContentThemeProvider subjectTheme={MONO}>
      <div className="pyq-solution">
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, [rehypeSanitize, schema], rehypeKatex]}
          components={components}
        >
          {wrapSvgs(content)}
        </ReactMarkdown>
      </div>
    </ContentThemeProvider>
  );
}
