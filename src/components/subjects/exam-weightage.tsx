import { ChartBar, Exam, Fire, Ranking } from "@phosphor-icons/react/dist/ssr";

// Deterministic, source-only exam analytics: everything here is derived
// straight from the subject's Question rows (their `years`, `marks`, and
// `repeatCount` fields). No AI, no invented figures — if the data isn't
// there, the relevant panel simply doesn't render.

type QuestionInput = {
  questionText: string;
  marks: number | null;
  years: string | null;
  repeatCount: number;
  isRepeated: boolean;
};

type YearWeight = { year: string; questions: number; marks: number };
type MarksBucket = { marks: number; count: number };

function parseYears(raw: string | null): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((y) => y.trim())
    .filter((y) => /^\d{4}$/.test(y));
}

function buildWeightage(questions: QuestionInput[]) {
  const yearMap = new Map<string, YearWeight>();
  const marksMap = new Map<number, number>();
  let totalMarks = 0;

  for (const q of questions) {
    const years = parseYears(q.years);
    for (const year of years) {
      const entry = yearMap.get(year) ?? { year, questions: 0, marks: 0 };
      entry.questions += 1;
      entry.marks += q.marks ?? 0;
      yearMap.set(year, entry);
    }
    if (typeof q.marks === "number" && q.marks > 0) {
      marksMap.set(q.marks, (marksMap.get(q.marks) ?? 0) + 1);
      totalMarks += q.marks;
    }
  }

  const years = [...yearMap.values()].sort((a, b) => a.year.localeCompare(b.year));
  const marksBuckets: MarksBucket[] = [...marksMap.entries()]
    .map(([marks, count]) => ({ marks, count }))
    .sort((a, b) => a.marks - b.marks);

  return { years, marksBuckets, totalMarks };
}

export function ExamWeightage({ questions }: { questions: QuestionInput[] }) {
  const { years, marksBuckets, totalMarks } = buildWeightage(questions);
  const repeatedCount = questions.filter((q) => q.isRepeated).length;
  const topRepeated = [...questions]
    .filter((q) => q.repeatCount > 1)
    .sort((a, b) => b.repeatCount - a.repeatCount)
    .slice(0, 5);

  // Nothing worth charting — don't render an empty shell.
  if (years.length === 0 && marksBuckets.length === 0 && topRepeated.length === 0) {
    return null;
  }

  return (
    <section className="mt-10">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <ChartBar size={20} weight="bold" className="text-accent" />
        Exam weightage
      </h2>
      <p className="mt-1 text-sm text-muted">
        Computed directly from the question bank — no predictions, just what the papers actually asked.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile icon={<Exam size={18} weight="bold" />} label="Questions" value={questions.length} />
        <StatTile icon={<Fire size={18} weight="bold" />} label="Repeated" value={repeatedCount} />
        <StatTile icon={<ChartBar size={18} weight="bold" />} label="Years covered" value={years.length} />
        <StatTile icon={<Ranking size={18} weight="bold" />} label="Marks in bank" value={totalMarks} />
      </div>

      {years.length > 0 && <YearWeightChart years={years} />}
      {marksBuckets.length > 0 && <MarksDistribution buckets={marksBuckets} />}
      {topRepeated.length > 0 && <RepeatLeaderboard questions={topRepeated} />}
    </section>
  );
}

function StatTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
        <span className="text-accent">{icon}</span>
        {label}
      </span>
      <p className="mt-2 font-mono text-2xl font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

// Grouped column chart: for each year, questions asked plus marks weight.
// Pure SVG so it renders on the server and prints cleanly.
function YearWeightChart({ years }: { years: YearWeight[] }) {
  const width = 720;
  const height = 280;
  const pad = { top: 24, right: 18, bottom: 46, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxQuestions = Math.max(...years.map((y) => y.questions), 1);
  const step = plotW / years.length;
  const barW = Math.min(step * 0.5, 56);

  return (
    <figure className="mt-6 overflow-hidden rounded-xl border border-border bg-surface p-4 sm:p-5">
      <figcaption className="mb-3 font-semibold text-foreground">
        Questions asked per year
      </figcaption>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Questions per year. ${years
            .map((y) => `${y.year}: ${y.questions} question${y.questions === 1 ? "" : "s"}`)
            .join(", ")}.`}
          className="min-w-[560px]"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = pad.top + plotH - fraction * plotH;
            return (
              <g key={fraction}>
                <line x1={pad.left} x2={width - pad.right} y1={y} y2={y} stroke="var(--border)" strokeWidth="1" />
                <text x={pad.left - 8} y={y + 4} textAnchor="end" fill="var(--muted)" fontSize="11">
                  {Math.round(maxQuestions * fraction)}
                </text>
              </g>
            );
          })}

          {years.map((entry, index) => {
            const barH = (entry.questions / maxQuestions) * plotH;
            const cx = pad.left + step * index + step / 2;
            return (
              <g key={entry.year}>
                <rect
                  x={cx - barW / 2}
                  y={pad.top + plotH - barH}
                  width={barW}
                  height={barH}
                  rx="5"
                  fill="var(--accent)"
                />
                <text x={cx} y={pad.top + plotH - barH - 6} textAnchor="middle" fill="var(--muted)" fontSize="11" fontWeight="600">
                  {entry.questions}
                </text>
                <text x={cx} y={height - 16} textAnchor="middle" fill="var(--muted)" fontSize="11">
                  {entry.year}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </figure>
  );
}

// Horizontal share of the mark bank across question weights (2-mark,
// 6-mark, etc.), so students can see where the marks concentrate.
function MarksDistribution({ buckets }: { buckets: MarksBucket[] }) {
  const totalWeighted = buckets.reduce((sum, b) => sum + b.marks * b.count, 0) || 1;

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="font-semibold text-foreground">Marks distribution</h3>
      <p className="mt-1 text-sm text-muted">
        Share of the total mark bank held by each question weight.
      </p>
      <div className="mt-4 space-y-4">
        {buckets.map((bucket) => {
          const weighted = bucket.marks * bucket.count;
          const share = Math.round((weighted / totalWeighted) * 100);
          return (
            <div key={bucket.marks}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium text-foreground">
                  {bucket.marks}-mark question{bucket.count === 1 ? "" : "s"}
                </span>
                <span className="font-mono text-xs text-muted">
                  {bucket.count} × {bucket.marks} = {weighted} marks · {share}%
                </span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${Math.max(4, share)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// The most-repeated questions, ranked by how many papers they showed up in.
function RepeatLeaderboard({ questions }: { questions: QuestionInput[] }) {
  const max = Math.max(...questions.map((q) => q.repeatCount), 1);

  return (
    <div className="mt-6 rounded-xl border border-border bg-surface p-4 sm:p-5">
      <h3 className="flex items-center gap-2 font-semibold text-foreground">
        <Fire size={18} weight="fill" className="text-accent" />
        High-frequency questions
      </h3>
      <p className="mt-1 text-sm text-muted">Ranked by how often they recur across papers.</p>
      <ol className="mt-4 space-y-4">
        {questions.map((q, index) => (
          <li key={`${q.questionText}-${index}`} className="flex items-start gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <p className="line-clamp-2 text-sm font-medium leading-5 text-foreground">{q.questionText}</p>
                <span className="shrink-0 font-mono text-xs font-bold text-accent">{q.repeatCount}×</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{ width: `${Math.max(8, (q.repeatCount / max) * 100)}%` }}
                />
              </div>
              {q.years && (
                <p className="mt-1.5 text-xs text-muted">Appeared in: {parseYears(q.years).join(" · ")}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
