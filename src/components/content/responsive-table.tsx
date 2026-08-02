// Reusable structured-data table: horizontal scroll on narrow screens,
// zebra rows, optional sticky first column, optional caption, optional
// highlighted rows. Used both for structured "table" content blocks
// (src/lib/content/content-block-schema.ts) and by ComparisonVisual
// (src/components/subjects/visuals/comparison-visual.tsx), which used to
// hand-roll a near-identical <table> — this de-duplicates the two.
//
// Deliberately styled with the site's global Tailwind tokens (border/
// surface/surface-muted/foreground/muted), matching every other non-note
// surface in the app — the Markdown engine's own tables
// (src/components/content/notes/notes-markdown.tsx) stay on the separate
// --nt-* themed table styling in notes-content.css, since those render
// inside a Note Designer-themed .nt-root context this component isn't used
// in.
export function ResponsiveTable({
  headers,
  rows,
  caption,
  highlightRows,
  stickyFirstColumn = false,
}: {
  headers: string[];
  rows: string[][];
  caption?: string;
  highlightRows?: number[];
  stickyFirstColumn?: boolean;
}) {
  const highlighted = new Set(highlightRows ?? []);

  return (
    <div className="overflow-hidden overflow-x-auto rounded-xl border border-border bg-surface">
      <table className="w-full border-collapse text-sm">
        {caption && <caption className="border-b border-border px-6 py-3 text-left text-xs text-muted">{caption}</caption>}
        <thead className="bg-surface-muted">
          <tr>
            {headers.map((header, i) => (
              <th
                key={i}
                scope="col"
                className={`px-6 py-4 text-left font-semibold text-foreground ${
                  stickyFirstColumn && i === 0 ? "sticky left-0 z-10 bg-surface-muted" : ""
                }`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b border-border/60 transition-colors last:border-0 hover:bg-surface-muted/60 ${
                highlighted.has(rowIndex) ? "bg-accent-soft/40" : rowIndex % 2 === 1 ? "bg-surface-muted/30" : ""
              }`}
            >
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className={`px-6 py-4 text-foreground/90 first:font-semibold first:text-foreground ${
                    stickyFirstColumn && cellIndex === 0 ? `sticky left-0 z-10 ${highlighted.has(rowIndex) ? "bg-accent-soft/40" : "bg-surface"}` : ""
                  }`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
