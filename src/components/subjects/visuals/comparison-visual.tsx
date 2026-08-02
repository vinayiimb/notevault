import { ResponsiveTable } from "@/components/content/responsive-table";

type ComparisonVisual = {
  title: string;
  columns: string[];
  rows: { label: string; cells: string[] }[];
  annotations: string[];
};

export function ComparisonVisual({ visual }: { visual: ComparisonVisual }) {
  return (
    <div>
      <ResponsiveTable
        headers={["", ...visual.columns]}
        rows={visual.rows.map((row) => [row.label, ...row.cells])}
      />
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
