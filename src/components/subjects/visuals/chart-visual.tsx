import { DataChart } from "@/components/subjects/data-chart";
import type { ThemeValues } from "@/lib/note-theme";

type ChartVisual = {
  title: string;
  chartType: "bar" | "line" | "area" | "pie" | "donut";
  labels: string[];
  values: number[];
  annotations: string[];
};

// Reuses DataChart as-is (src/components/subjects/data-chart.tsx) by
// converting the structured visual back into the small DSL string it
// already parses, rather than duplicating its rendering logic.
export function ChartVisual({ visual, visuals }: { visual: ChartVisual; visuals?: ThemeValues["visuals"] }) {
  const source = [
    `type: ${visual.chartType}`,
    `title: ${visual.title}`,
    `labels: ${visual.labels.join(", ")}`,
    `values: ${visual.values.join(", ")}`,
  ].join("\n");

  return (
    <div>
      <DataChart source={source} palette={visuals?.chartPalette} />
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
