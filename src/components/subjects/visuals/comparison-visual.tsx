type ComparisonVisual = {
  title: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
  annotations: string[];
};

// Same visual language as NotesRenderer's markdown table styling, just fed
// from structured rows/columns instead of a markdown table body.
export function ComparisonVisual({ visual }: { visual: ComparisonVisual }) {
  return (
    <div>
      <div className="overflow-hidden overflow-x-auto rounded-xl border border-border bg-surface">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="px-6 py-4 text-left font-semibold text-foreground"></th>
              {visual.columns.map((col) => (
                <th key={col} className="px-6 py-4 text-left font-semibold text-foreground">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visual.rows.map((row) => (
              <tr
                key={row.label}
                className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-muted/60"
              >
                <td className="px-6 py-4 font-semibold text-foreground">{row.label}</td>
                {row.cells.map((cell, i) => (
                  <td key={i} className="px-6 py-4 text-foreground/90">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visual.annotations.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
          {visual.annotations.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
