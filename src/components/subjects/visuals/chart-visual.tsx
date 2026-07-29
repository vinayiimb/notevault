import { DataChart } from "@/components/subjects/data-chart";

type ChartVisual = {
  title: string;
  chartType: "bar" | "line";
  labels: string[];
  values: number[];
  annotations: string[];
};

// Reuses DataChart as-is (src/components/subjects/data-chart.tsx) by
// converting the structured visual back into the small DSL string it
// already parses, rather than duplicating its rendering logic.
export function ChartVisual({ visual }: { visual: ChartVisual }) {
  const source = [
    `type: ${visual.chartType}`,
    `title: ${visual.title}`,
    `labels: ${visual.labels.join(", ")}`,
    `values: ${visual.values.join(", ")}`,
  ].join("\n");

  return (
    <div>
      <DataChart source={source} />
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
