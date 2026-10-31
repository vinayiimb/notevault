"use client";

import { Children, isValidElement, useState } from "react";
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
import { InfoCards } from "./info-cards";

// Drops a leading "Q1. " / "3. " etc. from the first text child, keeping any inline formatting after it.
function stripLead(children: React.ReactNode, re: RegExp): React.ReactNode {
  const parts = Children.toArray(children);
  if (typeof parts[0] === "string") parts[0] = parts[0].replace(re, "");
  return parts;
}

// react-markdown gives the paragraph renderer the element it made from `components.img`, so the "lone image" check below has to
// compare against THIS component (comparing against NoteImage never matched, and the <figure> ended up inside a <p>).
function MarkdownImg({ src, alt, title }: { src?: string | Blob; alt?: string; title?: string }) {
  return <NoteImage src={typeof src === "string" ? src : undefined} alt={alt} title={title} />;
}

// A question heading. On a phone the text is held to two lines (CSS) and a tap shows the rest.
function QuestionHeading({ id, no, children }: { id: string; no: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <h3 id={id} className="nt-q" data-open={open} onClick={() => setOpen((o) => !o)}>
      <span className="nt-q-body">
        <span className="nt-q-no">Q{no}</span>
        <span className="nt-q-text">{children}</span>
      </span>
    </h3>
  );
}

const Q_HEAD = /^Q(\d+)\.\s+/;
const UNIT_HEAD = /^(Unit\s+[\w.]+)\s*[—–:-]\s+/i;
const STEP_HEAD = /^(\d+)\.\s+/;
// "Asked 4× · 2020, 2022 · 19 marks" — the one-line quote the Paper OCR Studio writes under each question
const META_LINE = /^(?:Asked\s+\d+×|\d{4}|\d+\s+marks?)(?:\s*[·,]\s*|$)/i;

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
  const allocate = createSlugAllocator();
  const assigned = new Map<number, string>();
  // A heading asks for its id by its position in the source, so asking again (React calls renderers twice in dev, and a
  // re-render may repeat a call) returns the same id instead of the next free one ("x", then "x-1"): ids then match the
  // server's HTML and the TOC. Without a position it falls back to plain allocation.
  const slugFor = (text: string, node?: { position?: { start?: { offset?: number } } }): string => {
    const at = node?.position?.start?.offset;
    if (at == null) return allocate(text);
    let slug = assigned.get(at);
    if (slug === undefined) { slug = allocate(text); assigned.set(at, slug); }
    return slug;
  };

  const components: Components = {
    h1: ({ node, children }) => <h1 id={slugFor(flattenToText(children), node)}>{children}</h1>,
    h2: ({ node, children }) => {
      const text = flattenToText(children);
      const id = slugFor(text, node);
      const unit = UNIT_HEAD.exec(text);
      if (!unit) return <h2 id={id}>{children}</h2>;
      return (
        <h2 id={id} className="nt-unit">
          <span className="nt-unit-tag">{unit[1]}</span>
          {stripLead(children, UNIT_HEAD)}
        </h2>
      );
    },
    h3: ({ node, children }) => {
      const text = flattenToText(children);
      const id = slugFor(text, node);
      const q = Q_HEAD.exec(text);
      if (!q) return <h3 id={id}>{children}</h3>;
      return <QuestionHeading id={id} no={q[1]}>{stripLead(children, Q_HEAD)}</QuestionHeading>;
    },
    h4: ({ node, children }) => {
      const text = flattenToText(children);
      const id = slugFor(text, node);
      const step = STEP_HEAD.exec(text);
      if (!step) return <h4 id={id}>{children}</h4>;
      return (
        <h4 id={id} className="nt-step">
          <span className="nt-step-no">{step[1]}</span>
          <span>{stripLead(children, STEP_HEAD)}</span>
        </h4>
      );
    },
    h5: ({ node, children }) => <h5 id={slugFor(flattenToText(children), node)}>{children}</h5>,

    // "Asked 4× · 2020, 2022 · 19 marks" becomes a row of chips; any other quote stays a quote.
    blockquote: ({ children }) => {
      const text = flattenToText(children).trim();
      if (META_LINE.test(text) && !text.includes("\n")) {
        return (
          <div className="nt-meta">
            {text.split(/\s*·\s*/).map((chip, i) => (
              <span key={i} className={`nt-chip${/^Asked/i.test(chip) ? " hot" : ""}`}>{chip}</span>
            ))}
          </div>
        );
      }
      return <blockquote>{children}</blockquote>;
    },

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
      if (onlyChild.length === 1 && isValidElement(onlyChild[0]) && onlyChild[0].type === MarkdownImg) {
        return <>{children}</>;
      }

      const callout = detectCallout(children);
      if (!callout) return <p>{children}</p>;
      const Icon = CALLOUT_ICONS[callout.kind];
      // "Keywords: power, authority, legitimacy" — the marks-earning terms, shown as chips
      if (/^key\s?(words?|terms)$/i.test(callout.label)) {
        const terms = flattenToText(callout.rest).split(/\s*[,;•·]\s*/).map((t) => t.replace(/\.$/, "").trim()).filter(Boolean);
        if (terms.length > 1) {
          return (
            <div className={`nt-card ${callout.kind} keywords`}>
              <div className="nt-card-head">
                <Icon size={14} weight="bold" />
                {callout.label}
              </div>
              <div className="nt-chips">
                {terms.map((t) => <span key={t} className="nt-chip">{t}</span>)}
              </div>
            </div>
          );
        }
      }
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

    img: MarkdownImg,

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
      if (language === "cards") return <InfoCards source={raw} />;
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
