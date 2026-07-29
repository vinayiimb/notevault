import type { ThemeValues } from "@/lib/note-theme";

type VennVisual = {
  title: string;
  sets: { id: string; label: string; items: string[] }[];
  overlapItems: string[];
  annotations: string[];
};

// Circle labels stay short (set name + item count) since packing arbitrary-
// length item text inside overlapping circles at mobile sizes is unreadable
// — the actual item lists render as chips below instead, grouped under each
// set and the shared overlap, which stays legible at every screen size.
const TWO_SET_CIRCLES = [
  { cx: 130, cy: 110, r: 90 },
  { cx: 210, cy: 110, r: 90 },
];
const THREE_SET_CIRCLES = [
  { cx: 140, cy: 95, r: 85 },
  { cx: 210, cy: 95, r: 85 },
  { cx: 175, cy: 160, r: 85 },
];

export function VennVisual({ visual, visuals }: { visual: VennVisual; visuals: ThemeValues["visuals"] }) {
  const circles = visual.sets.length >= 3 ? THREE_SET_CIRCLES : TWO_SET_CIRCLES;
  const width = 340;
  const height = visual.sets.length >= 3 ? 260 : 220;

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="mx-auto h-auto w-full max-w-sm" role="img" aria-label={visual.title}>
        {visual.sets.map((set, i) => {
          const circle = circles[i];
          const fill = visuals.nodeColors[i % visuals.nodeColors.length];
          return (
            <g key={set.id}>
              <circle
                cx={circle.cx}
                cy={circle.cy}
                r={circle.r}
                fill={fill}
                fillOpacity={0.35}
                stroke={visuals.connectorColor}
                strokeWidth={visuals.connectorThickness}
              />
            </g>
          );
        })}
        {visual.sets.map((set, i) => {
          const circle = circles[i];
          const labelY = visual.sets.length >= 3 ? (i === 2 ? circle.cy + circle.r * 0.55 : circle.cy - circle.r * 0.55) : circle.cy - circle.r * 0.55;
          return (
            <text
              key={`${set.id}-label`}
              x={circle.cx}
              y={labelY}
              textAnchor="middle"
              className="text-xs font-semibold"
              fill="#172033"
            >
              {set.label} ({set.items.length})
            </text>
          );
        })}
      </svg>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {visual.sets.map((set, i) => (
          <div key={set.id} className="rounded-xl border border-border p-3">
            <p className="text-xs font-bold tracking-wide text-muted uppercase">{set.label}</p>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {set.items.map((item) => (
                <li
                  key={item}
                  className="rounded-full px-2.5 py-1 text-xs"
                  style={{ backgroundColor: visuals.nodeColors[i % visuals.nodeColors.length] }}
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {visual.overlapItems.length > 0 && (
        <div className="mt-3 rounded-xl border border-border p-3">
          <p className="text-xs font-bold tracking-wide text-muted uppercase">Shared / overlap</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {visual.overlapItems.map((item) => (
              <li key={item} className="rounded-full border border-border px-2.5 py-1 text-xs">
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}

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
