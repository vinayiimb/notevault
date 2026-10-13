"use client";

import { useId } from "react";
import { curvePath, parseDiagram } from "@/lib/econ-diagram";

// Textbook-style economics graph: black on white (inverts in dark mode via
// currentColor), the way students are expected to draw it in the exam.
const W = 340;
const H = 270;
const M = { l: 52, r: 34, t: 18, b: 34 };
const toPx = (p: { x: number; y: number }): [number, number] => [
  M.l + (p.x / 10) * (W - M.l - M.r),
  M.t + (1 - p.y / 10) * (H - M.t - M.b),
];

// Background-coloured outline so labels stay readable where they cross a line.
const HALO = { stroke: "var(--surface)", strokeWidth: 3, paintOrder: "stroke" as const, strokeLinejoin: "round" as const };

// "Q_d" / "P_{c}" → Q with a subscript d (LLMs write these instead of Unicode subscripts).
function Label({ text }: { text: string }) {
  const parts = text.split(/_\{([^}]*)\}|_([A-Za-z0-9]+)/);
  return (
    <>
      {parts.map((part, i) =>
        part === undefined || part === "" ? null : i % 3 === 0 ? (
          <tspan key={i}>{part}</tspan>
        ) : (
          <tspan key={i} baselineShift="sub" fontSize="0.75em">
            {part}
          </tspan>
        ),
      )}
    </>
  );
}

export function EconDiagram({ source }: { source: string }) {
  const id = useId().replace(/:/g, "");
  const d = parseDiagram(source);
  if (!d) {
    return <p className="pyq-diagram-error">Diagram could not be drawn.</p>;
  }
  const [ox, oy] = toPx({ x: 0, y: 0 });
  const [xEnd] = toPx({ x: 10.6, y: 0 });
  const [, yEnd] = toPx({ x: 0, y: 10.6 });

  return (
    <figure className="pyq-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={d.title} className="h-auto w-full max-w-[420px]">
        <defs>
          <marker id={`ah-${id}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="currentColor" />
          </marker>
        </defs>

        {/* axes */}
        <line x1={ox} y1={oy} x2={xEnd} y2={oy} stroke="currentColor" strokeWidth="1.4" markerEnd={`url(#ah-${id})`} />
        <line x1={ox} y1={oy} x2={ox} y2={yEnd} stroke="currentColor" strokeWidth="1.4" markerEnd={`url(#ah-${id})`} />
        <text x={ox - 6} y={oy + 14} fontSize="11" textAnchor="end" fill="currentColor" {...HALO}>O</text>
        <text x={xEnd} y={oy + 24} fontSize="11" textAnchor="end" fill="currentColor" {...HALO}>
          <Label text={d.xLabel} />
        </text>
        <text
          x={14}
          y={(oy + yEnd) / 2}
          fontSize="11"
          textAnchor="middle"
          transform={`rotate(-90 14 ${(oy + yEnd) / 2})`}
          fill="currentColor"
          {...HALO}
        >
          <Label text={d.yLabel} />
        </text>

        {/* equilibrium guides first, so curves draw over them */}
        {d.points.map((p, i) => {
          const [x, y] = toPx(p);
          return (
            <g key={`g${i}`} opacity="0.75">
              {p.guides && (
                <>
                  <line x1={x} y1={y} x2={x} y2={oy} stroke="currentColor" strokeWidth="0.9" strokeDasharray="3 3" />
                  <line x1={x} y1={y} x2={ox} y2={y} stroke="currentColor" strokeWidth="0.9" strokeDasharray="3 3" />
                </>
              )}
              {p.xMark && <text x={x} y={oy + 13} fontSize="10.5" textAnchor="middle" fill="currentColor" {...HALO}><Label text={p.xMark} /></text>}
              {p.yMark && <text x={ox - 5} y={y + 3.5} fontSize="10.5" textAnchor="end" fill="currentColor" {...HALO}><Label text={p.yMark} /></text>}
            </g>
          );
        })}

        {d.curves.map((c, i) => {
          const last = toPx(c.points[c.points.length - 1]);
          // Drop the label below the line end if a labelled point sits there.
          const crowded = d.points.some((p) => {
            const [px, py] = toPx(p);
            return Math.hypot(px - last[0], py - last[1]) < 18;
          });
          return (
            <g key={`c${i}`}>
              <path
                d={curvePath(c.points, toPx)}
                fill="none"
                stroke="currentColor"
                strokeWidth={c.dashed ? 1.5 : 1.9}
                strokeDasharray={c.dashed ? "6 4" : undefined}
                opacity={c.dashed ? 0.8 : 1}
              />
              <text x={last[0] + 4} y={last[1] + (crowded ? 16 : -4)} fontSize="11.5" fontWeight="600" fill="currentColor" {...HALO}>
                <Label text={c.label} />
              </text>
            </g>
          );
        })}

        {d.arrows.map((a, i) => {
          const [x1, y1] = toPx({ x: a.x1, y: a.y1 });
          const [x2, y2] = toPx({ x: a.x2, y: a.y2 });
          return (
            <g key={`a${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth="1.1" markerEnd={`url(#ah-${id})`} />
              {a.label && <text x={(x1 + x2) / 2 + 4} y={(y1 + y2) / 2 - 4} fontSize="10" fill="currentColor" {...HALO}><Label text={a.label} /></text>}
            </g>
          );
        })}

        {d.points.map((p, i) => {
          const [x, y] = toPx(p);
          return (
            <g key={`p${i}`}>
              <circle cx={x} cy={y} r="2.8" fill="currentColor" />
              {p.label && <text x={x + 6} y={y - 6} fontSize="11" fontWeight="600" fill="currentColor" {...HALO}><Label text={p.label} /></text>}
            </g>
          );
        })}
      </svg>
      {d.title && <figcaption>{d.title}</figcaption>}
    </figure>
  );
}
