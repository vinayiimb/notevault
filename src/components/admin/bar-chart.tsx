// Small server-rendered bar chart for the admin pages (no chart library). Hover a bar for its exact value.
export function BarChart({
  data,
  format = (v) => String(v),
  height = 112,
  label,
  tone = "bg-accent",
}: {
  data: { label: string; value: number }[];
  format?: (v: number) => string;
  height?: number;
  /** Read out by screen readers, e.g. "Daily active students, last 30 days". */
  label: string;
  tone?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((n, d) => n + d.value, 0);
  const ticks = data.length > 1 ? [0, Math.floor((data.length - 1) / 2), data.length - 1] : [0];
  return (
    <figure>
      <div className="flex items-stretch gap-2">
        <div className="flex w-8 shrink-0 flex-col justify-between text-right text-[10px] tabular-nums text-muted" style={{ height }}>
          <span>{format(max)}</span>
          <span>0</span>
        </div>
        <div role="img" aria-label={`${label}. Total ${format(total)}, highest ${format(max)}.`} className="relative flex min-w-0 flex-1 items-end gap-[2px] border-b border-l border-border" style={{ height }}>
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-border/70" />
          {data.map((d) => (
            <div key={d.label} title={`${d.label}: ${format(d.value)}`} className="group relative flex h-full min-w-0 flex-1 items-end">
              <div className={`w-full rounded-t-[3px] ${d.value ? tone : ""} opacity-85 transition group-hover:opacity-100`} style={{ height: `${d.value ? Math.max(4, (d.value / max) * 100) : 0}%` }} />
            </div>
          ))}
        </div>
      </div>
      <figcaption className="ml-10 mt-1 flex justify-between text-[10px] text-muted">
        {ticks.map((i) => (
          <span key={i}>{data[i]?.label}</span>
        ))}
      </figcaption>
    </figure>
  );
}
