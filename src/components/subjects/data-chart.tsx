type ChartKind = "bar" | "line" | "area" | "pie" | "donut";

type ParsedChart = {
  type: ChartKind;
  title: string;
  labels: string[];
  values: number[];
};

function parseChart(source: string): ParsedChart | null {
  const entries = new Map<string, string>();
  for (const line of source.split("\n")) {
    const match = line.match(/^\s*([a-z]+)\s*:\s*(.+?)\s*$/i);
    if (match) entries.set(match[1].toLowerCase(), match[2]);
  }

  const rawType = entries.get("type")?.toLowerCase();
  const type: ChartKind =
    rawType === "line" || rawType === "area" || rawType === "pie" || rawType === "donut" ? rawType : "bar";
  const labels = (entries.get("labels") ?? "")
    .split(",")
    .map((label) => label.trim())
    .filter(Boolean)
    .slice(0, 12);
  const values = (entries.get("values") ?? "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter(Number.isFinite)
    .slice(0, 12);

  if (labels.length < 2 || labels.length !== values.length) return null;
  return {
    type,
    title: entries.get("title")?.trim() || "Data analysis",
    labels,
    values,
  };
}

const DEFAULT_PALETTE = ["var(--accent)"];

function colorAt(palette: string[], index: number): string {
  return palette[index % palette.length];
}

// A pure-text sentence describing the data, in addition to the visual
// chart — screen readers get a real summary instead of just an <svg> label,
// and it doubles as the small-screen fallback list.
function summarize(chart: ParsedChart): string {
  return `${chart.title}. ${chart.labels.map((label, i) => `${label}: ${chart.values[i]}`).join(", ")}`;
}

export function DataChart({ source, palette = DEFAULT_PALETTE }: { source: string; palette?: string[] }) {
  const chart = parseChart(source);
  if (!chart) {
    return (
      <div className="mt-5 rounded-xl bg-surface p-4 text-sm text-muted">
        This chart could not be rendered. Use matching comma-separated <code>labels</code> and{" "}
        <code>values</code>.
      </div>
    );
  }

  return (
    <figure className="mt-6 overflow-hidden rounded-xl bg-surface p-4 sm:p-5">
      <figcaption className="mb-3 font-semibold text-foreground">{chart.title}</figcaption>
      {chart.type === "pie" || chart.type === "donut" ? (
        <PieChart chart={chart} palette={palette} donut={chart.type === "donut"} />
      ) : (
        <CartesianChart chart={chart} palette={palette} />
      )}
      <p className="sr-only">{summarize(chart)}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted sm:hidden" aria-hidden="true">
        {chart.labels.map((label, index) => (
          <span key={label}>{label}: {chart.values[index]}</span>
        ))}
      </div>
    </figure>
  );
}

function CartesianChart({ chart, palette }: { chart: ParsedChart; palette: string[] }) {
  const width = 720;
  const height = 300;
  const pad = { top: 24, right: 18, bottom: 52, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(...chart.values, 1);
  const step = plotWidth / chart.values.length;
  const points = chart.values.map((value, index) => {
    const x = pad.left + step * index + step / 2;
    const y = pad.top + plotHeight - (value / max) * plotHeight;
    return { x, y };
  });
  const pointsAttr = points.map((p) => `${p.x},${p.y}`).join(" ");
  const baseline = pad.top + plotHeight;
  const areaPath =
    `M${points[0].x},${baseline} ` +
    points.map((p) => `L${p.x},${p.y}`).join(" ") +
    ` L${points[points.length - 1].x},${baseline} Z`;
  const lineColor = colorAt(palette, 0);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={summarize(chart)}
        className="min-w-[620px]"
      >
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = pad.top + plotHeight - fraction * plotHeight;
          return (
            <g key={fraction}>
              <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.left - 9} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
                {Math.round(max * fraction)}
              </text>
            </g>
          );
        })}

        {chart.type === "bar" &&
          chart.values.map((value, index) => {
            const barHeight = (value / max) * plotHeight;
            return (
              <rect
                key={`${chart.labels[index]}-${value}`}
                x={pad.left + step * index + step * 0.18}
                y={pad.top + plotHeight - barHeight}
                width={step * 0.64}
                height={barHeight}
                rx="5"
                fill={colorAt(palette, index)}
              />
            );
          })}

        {chart.type === "area" && <path d={areaPath} fill={lineColor} fillOpacity="0.18" stroke="none" />}

        {(chart.type === "line" || chart.type === "area") && (
          <>
            <polyline points={pointsAttr} fill="none" stroke={lineColor} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            {points.map((p, index) => (
              <circle key={chart.labels[index]} cx={p.x} cy={p.y} r="5" fill="var(--surface)" stroke={lineColor} strokeWidth="3" />
            ))}
          </>
        )}

        {chart.labels.map((label, index) => (
          <text key={label} x={pad.left + step * index + step / 2} y={height - 20} textAnchor="middle" fill="var(--muted)" fontSize="11">
            {label.length > 12 ? `${label.slice(0, 11)}…` : label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function PieChart({ chart, palette, donut }: { chart: ParsedChart; palette: string[]; donut: boolean }) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 8;
  const innerR = donut ? r * 0.6 : 0;
  const total = chart.values.reduce((sum, v) => sum + Math.max(v, 0), 0) || 1;

  // Cumulative fractions computed via reduce (not a reassigned outer `let`
  // read back inside the subsequent .map) so slice boundaries stay a pure
  // function of `chart.values` alone.
  const cumulative = chart.values.reduce<number[]>((acc, value, index) => {
    const fraction = Math.max(value, 0) / total;
    acc.push((acc[index - 1] ?? 0) + fraction);
    return acc;
  }, []);
  const slices = chart.values.map((value, index) => {
    const fraction = Math.max(value, 0) / total;
    const start = -Math.PI / 2 + (cumulative[index - 1] ?? 0) * Math.PI * 2;
    const end = -Math.PI / 2 + cumulative[index] * Math.PI * 2;
    return { index, start, end, fraction, value };
  });

  function arcPath(start: number, end: number): string {
    const large = end - start > Math.PI ? 1 : 0;
    const p1 = { x: cx + r * Math.cos(start), y: cy + r * Math.sin(start) };
    const p2 = { x: cx + r * Math.cos(end), y: cy + r * Math.sin(end) };
    if (innerR === 0) {
      return `M${cx},${cy} L${p1.x},${p1.y} A${r},${r} 0 ${large} 1 ${p2.x},${p2.y} Z`;
    }
    const ip1 = { x: cx + innerR * Math.cos(start), y: cy + innerR * Math.sin(start) };
    const ip2 = { x: cx + innerR * Math.cos(end), y: cy + innerR * Math.sin(end) };
    return `M${ip1.x},${ip1.y} L${p1.x},${p1.y} A${r},${r} 0 ${large} 1 ${p2.x},${p2.y} L${ip2.x},${ip2.y} A${innerR},${innerR} 0 ${large} 0 ${ip1.x},${ip1.y} Z`;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={summarize(chart)} className="w-full max-w-[260px] shrink-0">
        {slices.map((slice) => (
          <path key={chart.labels[slice.index]} d={arcPath(slice.start, slice.end)} fill={colorAt(palette, slice.index)} stroke="var(--surface)" strokeWidth="2" />
        ))}
      </svg>
      <ul className="flex flex-col gap-1.5 text-sm">
        {chart.labels.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span className="size-2.5 shrink-0 rounded-full" style={{ background: colorAt(palette, index) }} />
            <span className="text-foreground">{label}</span>
            <span className="text-muted">
              {chart.values[index]} ({Math.round((Math.max(chart.values[index], 0) / total) * 100)}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
