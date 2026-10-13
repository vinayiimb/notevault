import { z } from "zod";

// A ```diagram code block in a PYQ solution: a two-axis economics graph
// (demand/supply, IC + budget line, cost curves …) on a 0–10 grid.
// Written by free Groq from the answer's "Draw …" instructions, or by hand.

const Pt = z.object({ x: z.number(), y: z.number() });

export const DiagramSchema = z.object({
  title: z.string().describe("Short caption, e.g. 'Rise in milk prices shifts supply of cream cheese left'"),
  xLabel: z.string().describe("Horizontal axis, e.g. 'Quantity'"),
  yLabel: z.string().describe("Vertical axis, e.g. 'Price'"),
  curves: z
    .array(
      z.object({
        label: z.string().describe("Shown at the curve's last point, e.g. 'D', 'S₁', 'IC₂', 'MC'"),
        points: z.array(Pt).min(2).max(8).describe("0–10 grid. 2 points = straight line; 3+ = smooth curve through them, left to right"),
        dashed: z.boolean().describe("true for the new/shifted curve"),
      }),
    )
    .min(1)
    .max(6),
  points: z
    .array(
      z.object({
        label: z.string().describe("e.g. 'E₁'"),
        x: z.number(),
        y: z.number(),
        guides: z.boolean().describe("dashed lines down to the x-axis and across to the y-axis"),
        xMark: z.string().describe("label on the x-axis under the point, e.g. 'Q₁'; empty for none"),
        yMark: z.string().describe("label on the y-axis beside the point, e.g. 'P₁'; empty for none"),
      }),
    )
    .max(6),
  arrows: z
    .array(z.object({ x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(), label: z.string() }))
    .max(4)
    .describe("e.g. a shift from S₁ to S₂"),
});

export type Diagram = z.infer<typeof DiagramSchema>;

export function parseDiagram(source: string): Diagram | null {
  try {
    const parsed = DiagramSchema.safeParse(JSON.parse(source));
    if (!parsed.success) return null;
    // Left to right, so each curve's label lands at its right-hand end (D low, S high).
    const curves = parsed.data.curves.map((c) => ({ ...c, points: [...c.points].sort((a, b) => a.x - b.x || a.y - b.y) }));
    return snapPoints({ ...parsed.data, curves });
  } catch {
    return null;
  }
}

type P = { x: number; y: number };

function segmentHit(a: P, b: P, c: P, d: P): P | null {
  const den = (b.x - a.x) * (d.y - c.y) - (b.y - a.y) * (d.x - c.x);
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * (d.y - c.y) - (c.y - a.y) * (d.x - c.x)) / den;
  const u = ((c.x - a.x) * (b.y - a.y) - (c.y - a.y) * (b.x - a.x)) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) } : null;
}

/**
 * LLMs place "E₂" a little off the crossing it names. Snap each point to the
 * nearest crossing of two curves within 1.2 grid units.
 * ponytail: smooth curves are treated as their control polyline; close enough for 4-6 points.
 */
export function snapPoints(d: Diagram): Diagram {
  const hits: P[] = [];
  for (let i = 0; i < d.curves.length; i++)
    for (let j = i + 1; j < d.curves.length; j++) {
      const a = d.curves[i].points;
      const b = d.curves[j].points;
      for (let s = 0; s < a.length - 1; s++)
        for (let t = 0; t < b.length - 1; t++) {
          const hit = segmentHit(a[s], a[s + 1], b[t], b[t + 1]);
          if (hit) hits.push(hit);
        }
    }
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    ...d,
    points: d.points.map((p) => {
      let best: P | null = null;
      let dist = 1.2;
      for (const h of hits) {
        const dd = Math.hypot(h.x - p.x, h.y - p.y);
        if (dd < dist) [best, dist] = [h, dd];
      }
      return best ? { ...p, x: round(best.x), y: round(best.y) } : p;
    }),
  };
}

const clamp = (n: number) => Math.min(10, Math.max(0, n));

/** SVG path through grid points; `toPx` maps grid → pixels. Smooth (Catmull-Rom) for 3+ points. */
export function curvePath(points: { x: number; y: number }[], toPx: (p: { x: number; y: number }) => [number, number]): string {
  const px = points.map((p) => toPx({ x: clamp(p.x), y: clamp(p.y) }));
  if (px.length === 2) return `M${px[0][0]},${px[0][1]} L${px[1][0]},${px[1][1]}`;
  let d = `M${px[0][0]},${px[0][1]}`;
  for (let i = 0; i < px.length - 1; i++) {
    const p0 = px[i - 1] ?? px[i];
    const p1 = px[i];
    const p2 = px[i + 1];
    const p3 = px[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}
