type ChartKind = "bar" | "line";

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

  const type = entries.get("type") === "line" ? "line" : "bar";
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

export function DataChart({ source }: { source: string }) {
  const chart = parseChart(source);
  if (!chart) {
    return (
      <div className="mt-5 rounded-xl bg-surface p-4 text-sm text-muted">
        This chart could not be rendered. Use matching comma-separated <code>labels</code> and{" "}
        <code>values</code>.
      </div>
    );
  }

  const width = 720;
  const height = 300;
  const pad = { top: 24, right: 18, bottom: 52, left: 42 };
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const max = Math.max(...chart.values, 1);
  const step = plotWidth / chart.values.length;
  const points = chart.values
    .map((value, index) => {
      const x = pad.left + step * index + step / 2;
      const y = pad.top + plotHeight - (value / max) * plotHeight;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <figure className="mt-6 overflow-hidden rounded-xl bg-surface p-4 sm:p-5">
      <figcaption className="mb-3 font-semibold text-foreground">{chart.title}</figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`${chart.title}. ${chart.labels
            .map((label, index) => `${label}: ${chart.values[index]}`)
            .join(", ")}`}
          className="min-w-[620px]"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = pad.top + plotHeight - fraction * plotHeight;
            return (
              <g key={fraction}>
                <line
                  x1={pad.left}
                  x2={width - pad.right}
                  y1={y}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth="1"
                />
                <text x={pad.left - 9} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
                  {Math.round(max * fraction)}
                </text>
              </g>
            );
          })}

          {chart.type === "bar" ? (
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
                  fill="var(--accent)"
                />
              );
            })
          ) : (
            <>
              <polyline
                points={points}
                fill="none"
                stroke="var(--accent)"
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {points.split(" ").map((point) => {
                const [cx, cy] = point.split(",");
                return (
                  <circle
                    key={point}
                    cx={cx}
                    cy={cy}
                    r="5"
                    fill="var(--surface)"
                    stroke="var(--accent)"
                    strokeWidth="3"
                  />
                );
              })}
            </>
          )}

          {chart.labels.map((label, index) => (
            <text
              key={label}
              x={pad.left + step * index + step / 2}
              y={height - 20}
              textAnchor="middle"
              fill="var(--muted)"
              fontSize="11"
            >
              {label.length > 12 ? `${label.slice(0, 11)}…` : label}
            </text>
          ))}
        </svg>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted sm:hidden">
        {chart.labels.map((label, index) => (
          <span key={label}>{label}: {chart.values[index]}</span>
        ))}
      </div>
    </figure>
  );
}
