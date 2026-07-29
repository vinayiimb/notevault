import { MermaidDiagram } from "@/components/subjects/mermaid-diagram";
import type { GraphVisual as GraphVisualData } from "@/lib/note-schema";
import type { ThemeValues } from "@/lib/note-theme";

// flowchart / mind-map / timeline / concept-tree all share one data shape
// (nodes + edges, see note-schema.ts's GraphVisualBase) and are converted
// here into real Mermaid syntax — deterministically, from structured data,
// never by asking the AI to hand-write Mermaid (which is exactly the kind
// of thing a small model gets subtly wrong). A `%%{init: ...}%%` front-matter
// block themes each diagram from the resolved ThemeValues without touching
// mermaid's global config, so this never fights other MermaidDiagram
// instances (e.g. an admin-pasted ```mermaid block) on the same page.

function escapeLabel(label: string) {
  return label.replace(/"/g, "&quot;");
}

function sanitizeId(id: string) {
  return id.replace(/[^a-zA-Z0-9_]/g, "_") || "n";
}

function initDirective(visuals: ThemeValues["visuals"]) {
  const themeVariables = {
    primaryColor: visuals.nodeColors[0] ?? "#2563EB",
    primaryBorderColor: visuals.connectorColor,
    primaryTextColor: "#172033",
    lineColor: visuals.connectorColor,
    fontFamily: "Inter, sans-serif",
  };
  return `%%{init: ${JSON.stringify({ theme: "base", themeVariables })}}%%`;
}

function classDefs(visuals: ThemeValues["visuals"], groups: string[]) {
  const shape = visuals.flowchartNodeStyle === "sharp" ? "" : "rx:8,ry:8";
  const lines = groups.map((group, i) => {
    const color = visuals.nodeColors[i % visuals.nodeColors.length];
    return `classDef group${i} fill:${color},stroke:${visuals.connectorColor},color:#172033${shape ? "," + shape : ""};`;
  });
  lines.push(
    `classDef highlighted fill:${visuals.highlightedNode.background},stroke:${visuals.highlightedNode.border},color:${visuals.highlightedNode.text},font-weight:bold;`,
  );
  return { lines, groups };
}

function nodeClass(nodeId: string, group: string | null, groups: string[], highlight: string | null) {
  if (nodeId === highlight) return "highlighted";
  const idx = group ? groups.indexOf(group) : -1;
  return idx >= 0 ? `group${idx}` : null;
}

function buildFlowchart(visual: GraphVisualData, visuals: ThemeValues["visuals"]) {
  const groups = [...new Set(visual.nodes.map((n) => n.group).filter((g): g is string => !!g))];
  const { lines: classLines } = classDefs(visuals, groups);
  const lines: string[] = [initDirective(visuals), "flowchart TD"];
  for (const node of visual.nodes) {
    const shape = visuals.flowchartNodeStyle === "sharp" ? `[${escapeLabel(node.label)}]` : `("${escapeLabel(node.label)}")`;
    lines.push(`  ${sanitizeId(node.id)}${shape}`);
  }
  for (const edge of visual.edges) {
    const arrow = visual.highlight === edge.to ? "==>" : "-->";
    const label = edge.label ? `|${escapeLabel(edge.label)}|` : "";
    lines.push(`  ${sanitizeId(edge.from)} ${arrow}${label} ${sanitizeId(edge.to)}`);
  }
  lines.push(...classLines);
  for (const node of visual.nodes) {
    const cls = nodeClass(node.id, node.group, groups, visual.highlight);
    if (cls) lines.push(`  class ${sanitizeId(node.id)} ${cls};`);
  }
  return lines.join("\n");
}

function buildTree(visual: GraphVisualData) {
  const childrenOf = new Map<string, string[]>();
  const hasParent = new Set<string>();
  for (const edge of visual.edges) {
    childrenOf.set(edge.from, [...(childrenOf.get(edge.from) ?? []), edge.to]);
    hasParent.add(edge.to);
  }
  const root =
    visual.nodes.find((n) => n.id === visual.highlight && !hasParent.has(n.id))?.id ??
    visual.nodes.find((n) => !hasParent.has(n.id))?.id ??
    visual.nodes[0]?.id;
  return { childrenOf, root };
}

function buildMindMap(visual: GraphVisualData) {
  const { childrenOf, root } = buildTree(visual);
  const byId = new Map(visual.nodes.map((n) => [n.id, n]));
  const lines = ["mindmap"];

  function walk(id: string | undefined, depth: number, seen: Set<string>) {
    if (!id || seen.has(id)) return;
    seen.add(id);
    const node = byId.get(id);
    if (!node) return;
    const indent = "  ".repeat(depth + 1);
    const shape = depth === 0 ? `((${escapeLabel(node.label)}))` : `(${escapeLabel(node.label)})`;
    lines.push(`${indent}${sanitizeId(node.id)}${shape}`);
    for (const childId of childrenOf.get(id) ?? []) walk(childId, depth + 1, seen);
  }

  const seen = new Set<string>();
  walk(root, 0, seen);
  // Any node not reached from the detected root (a disconnected mention)
  // still needs to appear rather than silently vanish from the diagram.
  for (const node of visual.nodes) if (!seen.has(node.id)) walk(node.id, 1, seen);
  return lines.join("\n");
}

function buildTimeline(visual: GraphVisualData, title: string) {
  const lines = ["timeline", `  title ${escapeLabel(title)}`];
  visual.nodes.forEach((node, i) => {
    const marker = node.order ?? String(i + 1);
    lines.push(`  ${escapeLabel(marker)} : ${escapeLabel(node.label)}`);
  });
  return lines.join("\n");
}

export function GraphVisual({
  visual,
  kind,
  visuals,
}: {
  visual: GraphVisualData;
  kind: "flowchart" | "mind-map" | "timeline" | "concept-tree";
  visuals: ThemeValues["visuals"];
}) {
  const source =
    kind === "mind-map"
      ? buildMindMap(visual)
      : kind === "timeline"
        ? buildTimeline(visual, visual.title)
        : buildFlowchart(visual, visuals); // flowchart + concept-tree both render as a themed flowchart

  return (
    <div>
      <MermaidDiagram chart={source} />
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
