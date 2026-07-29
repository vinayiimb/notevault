import type { ThemeValues } from "@/lib/note-theme";

type GeometryShape = {
  id: string;
  kind: "triangle" | "circle" | "rectangle" | "line" | "angle";
  labels: string[];
  measurements: string[];
};
type GeometryVisual = { title: string; shapes: GeometryShape[]; annotations: string[] };

const SIZE = 160;

function ShapeSvg({ shape, stroke, fill }: { shape: GeometryShape; stroke: string; fill: string }) {
  const mid = SIZE / 2;
  const pad = 24;

  if (shape.kind === "triangle") {
    const points = [
      [mid, pad],
      [pad, SIZE - pad],
      [SIZE - pad, SIZE - pad],
    ];
    return (
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-36 w-full">
        <polygon points={points.map((p) => p.join(",")).join(" ")} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={2} />
        {points.map((p, i) => (
          <text key={i} x={p[0]} y={i === 0 ? p[1] - 8 : p[1] + (i === 1 ? -8 : 16)} textAnchor="middle" fontSize={11} fill="#172033">
            {shape.labels[i] ?? ""}
          </text>
        ))}
      </svg>
    );
  }

  if (shape.kind === "circle") {
    const r = mid - pad;
    return (
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-36 w-full">
        <circle cx={mid} cy={mid} r={r} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={2} />
        <circle cx={mid} cy={mid} r={2} fill={stroke} />
        <line x1={mid} y1={mid} x2={mid + r} y2={mid} stroke={stroke} strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={mid} y={pad - 8} textAnchor="middle" fontSize={11} fill="#172033">
          {shape.labels[0] ?? ""}
        </text>
        <text x={mid + r / 2} y={mid - 6} textAnchor="middle" fontSize={10} fill="#172033">
          {shape.measurements[0] ?? ""}
        </text>
      </svg>
    );
  }

  if (shape.kind === "rectangle") {
    return (
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-36 w-full">
        <rect x={pad} y={pad} width={SIZE - pad * 2} height={SIZE - pad * 2} fill={fill} fillOpacity={0.35} stroke={stroke} strokeWidth={2} />
        <text x={mid} y={pad - 8} textAnchor="middle" fontSize={11} fill="#172033">
          {shape.labels[0] ?? ""}
        </text>
        <text x={mid} y={pad + 18} textAnchor="middle" fontSize={10} fill="#172033">
          {shape.measurements[0] ?? ""}
        </text>
        <text x={pad - 6} y={mid} textAnchor="end" fontSize={10} fill="#172033">
          {shape.measurements[1] ?? ""}
        </text>
      </svg>
    );
  }

  if (shape.kind === "line") {
    return (
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-36 w-full">
        <line x1={pad} y1={mid} x2={SIZE - pad} y2={mid} stroke={stroke} strokeWidth={2} markerEnd="url(#geo-arrow)" markerStart="url(#geo-arrow)" />
        <defs>
          <marker id="geo-arrow" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill={stroke} />
          </marker>
        </defs>
        <text x={pad} y={mid - 12} fontSize={11} fill="#172033">
          {shape.labels[0] ?? ""}
        </text>
        <text x={SIZE - pad} y={mid - 12} textAnchor="end" fontSize={11} fill="#172033">
          {shape.labels[1] ?? ""}
        </text>
        <text x={mid} y={mid + 20} textAnchor="middle" fontSize={10} fill="#172033">
          {shape.measurements[0] ?? ""}
        </text>
      </svg>
    );
  }

  // angle
  const vertex = [pad, SIZE - pad];
  const arm1 = [SIZE - pad, SIZE - pad];
  const arm2 = [pad + 20, pad];
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="h-36 w-full">
      <line x1={vertex[0]} y1={vertex[1]} x2={arm1[0]} y2={arm1[1]} stroke={stroke} strokeWidth={2} />
      <line x1={vertex[0]} y1={vertex[1]} x2={arm2[0]} y2={arm2[1]} stroke={stroke} strokeWidth={2} />
      <path d={`M ${vertex[0] + 24} ${vertex[1]} A 24 24 0 0 0 ${vertex[0] + 8} ${vertex[1] - 22}`} fill="none" stroke={stroke} strokeWidth={1.5} />
      <text x={vertex[0] + 30} y={vertex[1] - 8} fontSize={10} fill="#172033">
        {shape.measurements[0] ?? ""}
      </text>
      <text x={vertex[0] - 6} y={vertex[1] + 14} fontSize={11} fill="#172033">
        {shape.labels[0] ?? ""}
      </text>
    </svg>
  );
}

export function GeometryVisual({ visual, visuals }: { visual: GeometryVisual; visuals: ThemeValues["visuals"] }) {
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        {visual.shapes.map((shape, i) => (
          <div key={shape.id} className="rounded-xl border border-border p-3">
            <ShapeSvg shape={shape} stroke={visuals.connectorColor} fill={visuals.nodeColors[i % visuals.nodeColors.length]} />
            {shape.measurements.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {shape.measurements.map((m, mi) => (
                  <li key={mi} className="rounded-full border border-border px-2 py-0.5 text-xs text-muted">
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
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
