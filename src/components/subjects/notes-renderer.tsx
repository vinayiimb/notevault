import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessNotesMarkdown, slugify } from "@/lib/notes-markdown";

export const NOTES_THEMES = ["sky", "violet", "emerald", "amber"] as const;
export type NotesTheme = (typeof NOTES_THEMES)[number];

// Tailwind can't see class names built with string interpolation (its
// scanner needs the literal text), so each theme is a fixed, fully-spelled
// class bundle rather than `bg-${theme}-soft`-style construction.
const THEME_CLASSES: Record<
  NotesTheme,
  { card: string; heading: string; divider: string; bullet: string }
> = {
  sky: {
    card: "border-sky-soft bg-sky-soft/40",
    heading: "text-sky-dark",
    divider: "border-sky/30",
    bullet: "bg-sky-dark",
  },
  violet: {
    card: "border-notes-violet-soft bg-notes-violet-soft/40",
    heading: "text-notes-violet-dark",
    divider: "border-notes-violet/30",
    bullet: "bg-notes-violet-dark",
  },
  emerald: {
    card: "border-notes-emerald-soft bg-notes-emerald-soft/40",
    heading: "text-notes-emerald-dark",
    divider: "border-notes-emerald/30",
    bullet: "bg-notes-emerald-dark",
  },
  amber: {
    card: "border-notes-amber-soft bg-notes-amber-soft/40",
    heading: "text-notes-amber-dark",
    divider: "border-notes-amber/30",
    bullet: "bg-notes-amber-dark",
  },
};

export function resolveNotesTheme(value: string | null | undefined): NotesTheme {
  return (NOTES_THEMES as readonly string[]).includes(value ?? "")
    ? (value as NotesTheme)
    : "sky";
}

// Deliberately styled distinctly from the rest of the subject page — notes
// get their own color identity (picked per-subject) so they read as their
// own kind of content, not just another list item next to PYQs.
export function NotesRenderer({
  content,
  theme = "sky",
}: {
  content: string;
  theme?: NotesTheme;
}) {
  const markdown = preprocessNotesMarkdown(content);
  const t = THEME_CLASSES[theme];

  // Assigns the same slug (and de-dupes the same way) as
  // extractNotesHeadings, since both walk the headings in document order —
  // that keeps the TOC's anchor links pointing at the right element.
  const seen = new Map<string, number>();
  function slugFor(children: React.ReactNode): string {
    const text = flattenToText(children);
    let slug = slugify(text) || "section";
    const count = seen.get(slug) ?? 0;
    seen.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;
    return slug;
  }

  return (
    <div className={`rounded-3xl border p-6 sm:p-8 ${t.card}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2
              id={slugFor(children)}
              className={`mt-8 scroll-mt-24 border-t pt-6 font-display text-2xl font-bold first:mt-0 first:border-0 first:pt-0 ${t.heading} ${t.divider}`}
            >
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 id={slugFor(children)} className={`mt-6 scroll-mt-24 text-lg font-bold ${t.heading}`}>
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mt-3 leading-relaxed text-foreground">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-foreground">{children}</strong>
          ),
          ul: ({ children }) => (
            <ul className="mt-3 flex list-none flex-col gap-2 pl-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="flex gap-2 pl-1 leading-relaxed">
              <span className={`mt-2.5 size-1.5 shrink-0 rounded-full ${t.bullet}`} />
              <span className="-mt-px flex-1">{children}</span>
            </li>
          ),
          table: ({ children }) => (
            <div className="mt-4 overflow-x-auto rounded-xl border border-border">
              <table className="w-full border-collapse text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-border bg-surface-muted px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="border-b border-border px-3 py-2">{children}</td>,
          code: ({ children }) => (
            <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono text-[0.85em]">
              {children}
            </code>
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}

function flattenToText(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(flattenToText).join("");
  if (typeof node === "object" && "props" in node) {
    return flattenToText((node as { props: { children?: React.ReactNode } }).props.children);
  }
  return "";
}
