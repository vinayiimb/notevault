import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { preprocessNotesMarkdown } from "@/lib/notes-markdown";

// Deliberately styled distinctly from the rest of the subject page (sky
// blue, not the site's indigo accent) so compiled notes read as their own
// kind of content, not just another list item next to PYQs.
export function NotesRenderer({ content }: { content: string }) {
  const markdown = preprocessNotesMarkdown(content);

  return (
    <div className="rounded-3xl border border-sky-soft bg-sky-soft/40 p-6 sm:p-8">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="mt-8 flex items-baseline gap-2 border-t border-sky/30 pt-6 font-display text-2xl font-bold text-sky-dark first:mt-0 first:border-0 first:pt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mt-6 text-lg font-bold text-sky-dark">{children}</h3>
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
            <li className="flex gap-2 pl-1 leading-relaxed marker:text-sky-dark">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-sky-dark" />
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
