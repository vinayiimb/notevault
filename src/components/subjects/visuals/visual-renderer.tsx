import type { Visual } from "@/lib/note-schema";
import type { ThemeValues } from "@/lib/note-theme";
import { GraphVisual } from "./graph-visual";
import { ComparisonVisual } from "./comparison-visual";
import { ChartVisual } from "./chart-visual";
import { VennVisual } from "./venn-visual";
import { GeometryVisual } from "./geometry-visual";
import { SolutionSheetVisual } from "./solution-sheet-visual";

// Only renders a visual when there's genuinely one to show — "none" (no
// diagram fits, or the AI/admin never picked one) renders nothing, matching
// "use only visuals that improve understanding."
export function VisualRenderer({ visual, visuals }: { visual: Visual; visuals: ThemeValues["visuals"] }) {
  switch (visual.type) {
    case "none":
      return null;
    case "flowchart":
    case "mind-map":
    case "timeline":
    case "concept-tree":
      return <GraphVisual visual={visual} kind={visual.type} visuals={visuals} />;
    case "comparison":
      return <ComparisonVisual visual={visual} />;
    case "chart":
      return <ChartVisual visual={visual} visuals={visuals} />;
    case "venn":
      return <VennVisual visual={visual} visuals={visuals} />;
    case "geometry":
      return <GeometryVisual visual={visual} visuals={visuals} />;
    case "solution-sheet":
      return <SolutionSheetVisual visual={visual} />;
  }
}
