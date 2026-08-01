"use client";

import { Children, isValidElement } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import rehypeKatex from "rehype-katex";
import { contentSanitizeSchema } from "@/lib/content/sanitize-schema";
import { createSlugAllocator } from "@/lib/content/toc";
import { detectCallout, CALLOUT_ICONS } from "@/lib/content/callouts";
import { ContentMermaidBlock } from "./mermaid-block";
import { ContentCodeBlock } from "./code-block";
import { NoteImage } from "./note-image";
import { DataChart } from "@/components/subjects/data-chart";

function flattenToText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenToText).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return flattenToText(node.props.children);
  return "";
}

// The one canonical Markdown engine for every rendered note in NoteVault —
// compiled subject notes, OCR-reformatted PYQ text, AI analysis panels, and
// admin previews all route through this component (see notes-renderer.tsx
// for the thin legacy-prop compatibility wrapper subject pages still use).
// Must be rendered inside a <ContentThemeProvider> (theme-provider.tsx) and
// <ContentLightboxProvider> (note-image.tsx) ancestor.
export function NotesMarkdown({ content }: { content: string }) {
  // Fresh allocator every render (cheap, and only used while this render
  // walks headings) — de-dupes slugs deterministically in document order,
  // the same allocator function extractContentHeadings
  // (src/lib/content/toc.ts) uses on the raw source, so anchors always
  // agree with the sidebar TOC.
  const slugFor = createSlugAllocator();

  const components: Components = {
    h1: ({ children }) => <h1 id={slugFor(flattenToText(children))}>{children}</h1>,
    h2: ({ children }) => <h2 id={slugFor(flattenToText(children))}>{children}</h2>,
    h3: ({ children }) => <h3 id={slugFor(flattenToText(children))}>{children}</h3>,
    h4: ({ children }) => <h4 id={slugFor(flattenToText(children))}>{children}</h4>,

    p: ({ children }) => {
      // A standalone ![]() is its own paragraph in the AST, but NoteImage
      // renders a block-level <figure> — nesting that inside a <p> is
      // invalid HTML (figure isn't allowed inside p) and causes a
      // hydration mismatch once the browser's parser silently repairs it.
      // Only unwrap when the image is the paragraph's *sole* content, so
      // "text with an inline ![]() image" still gets a normal <p>.
      const onlyChild = Children.toArray(children).filter(
        (child) => !(typeof child === "string" && child.trim() === ""),
      );
      if (onlyChild.length === 1 && isValidElement(onlyChild[0]) && onlyChild[0].type === NoteImage) {
        return <>{children}</>;
      }

      const callout = detectCallout(children);
      if (!callout) return <p>{children}</p>;
      const Icon = CALLOUT_ICONS[callout.kind];
      return (
        <div className={`nt-card ${callout.kind}`}>
          <div className="nt-card-head">
            <Icon size={14} weight="bold" />
            {callout.label}
          </div>
          <p>{callout.rest}</p>
        </div>
      );
    },

    a: ({ href, children }) => {
      const external = /^https?:\/\//.test(href ?? "");
      return (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
          {children}
        </a>
      );
    },

    img: ({ src, alt, title }) => <NoteImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} />,

    table: ({ children }) => (
      <div className="nt-table-wrap">
        <table className="nt-table">{children}</table>
      </div>
    ),

    // Fenced code blocks arrive as <pre><code class="language-x">...</code></pre>
    // in the AST — letting the default <pre> through would wrap our own
    // block-level card markup in a real <pre> (invalid nesting). `code`
    // owns every case instead: inline spans get a plain <code>, fenced
    // blocks get the mermaid/chart/syntax-highlight treatment.
    pre: ({ children }) => <>{children}</>,
    code: ({ className, children }) => {
      const raw = flattenToText(children).replace(/\n$/, "");
      const isBlock = Boolean(className);
      if (!isBlock) return <code className="nt-inline-code">{children}</code>;

      const language = /language-(\w+)/.exec(className ?? "")?.[1] ?? "";
      if (language === "mermaid") return <ContentMermaidBlock chart={raw} />;
      if (language === "chart") return <DataChart source={raw} />;
      return <ContentCodeBlock language={language} code={raw} />;
    },
  };

  return (
    <div className="nt-prose">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        // Order matters: sanitize must run on the raw-HTML-augmented tree
        // *before* rehype-katex renders math, so KaTeX's own generated
        // markup (which relies on inline `style` for glyph positioning,
        // never allowed for admin-authored raw HTML) is never re-sanitized
        // and stripped afterward.
        rehypePlugins={[rehypeRaw, [rehypeSanitize, contentSanitizeSchema], rehypeKatex]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
