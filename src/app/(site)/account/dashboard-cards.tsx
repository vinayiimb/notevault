import Link from "next/link";
import { ArrowUpRight } from "@phosphor-icons/react/dist/ssr";
import { MascotArt } from "@/components/landing/mascot";
import { setGoalAction } from "@/lib/paid-notes-actions";
import { FEATHERS_PER_ACTIVE_DAY, GOAL_CHOICES, goalPct, rankFor } from "@/lib/feathers";
import { fmtDuration } from "@/lib/student-activity-format";

// The dashboard's top row (progress, streak, feathers, community), the
// overview numbers and the tool tiles. Plain server components: no client JS.

const card = "rounded-[28px] bg-surface shadow-[var(--shadow-tile)]";
const nf = new Intl.NumberFormat("en-IN");

export function ProgressCard({ todaySeconds, goalMin }: { todaySeconds: number; goalMin: number }) {
  const pct = goalPct(todaySeconds, goalMin);
  const done = pct >= 100;
  const minutes = Math.floor(todaySeconds / 60);
  return (
    <section className={`${card} relative flex flex-col justify-between overflow-hidden p-5 sm:p-7`} aria-label="Today's progress">
      <div>
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-[1.35rem] font-semibold tracking-[-0.03em] sm:text-[1.6rem]">Today&apos;s progress</h2>
          {done && (
            <span className="rounded-full bg-emerald-500/12 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">Goal done 🎉</span>
          )}
        </div>
        <div
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Today's reading goal"
          className="mt-4 h-3 overflow-hidden rounded-full bg-foreground/[0.07]"
        >
          <div
            className={`dash-fill h-full rounded-full ${done ? "bg-gradient-to-r from-emerald-400 to-emerald-600" : "bg-gradient-to-r from-[#3fa0ff] to-[#0071e3]"}`}
            style={{ width: `${Math.max(pct, todaySeconds > 0 ? 4 : 0)}%` }}
          />
        </div>
        <p className="mt-4 text-[1.05rem] leading-snug sm:text-[1.2rem]">
          You&apos;ve read <b className="text-[1.3em] font-semibold tracking-[-0.02em]">{minutes}</b>
          <br className="sm:hidden" /> of <b className="font-semibold">{goalMin}</b> targeted minutes
        </p>
        {!done && todaySeconds === 0 && (
          <p className="mt-1 text-sm text-muted">Open any note and the timer starts by itself. Finish the goal for +{FEATHERS_PER_ACTIVE_DAY} bonus feathers.</p>
        )}
      </div>
      <details className="group mt-4">
        <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-[15px] font-medium text-muted transition hover:text-foreground [&::-webkit-details-marker]:hidden">
          Update target <ArrowUpRight size={14} weight="bold" className="transition group-open:rotate-90" />
        </summary>
        <form action={setGoalAction} className="mt-2 flex flex-wrap gap-2">
          {GOAL_CHOICES.map((m) => (
            <button
              key={m}
              name="minutes"
              value={m}
              type="submit"
              aria-pressed={m === goalMin}
              className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${
                m === goalMin ? "bg-brand text-brand-foreground" : "bg-foreground/[0.07] text-foreground hover:bg-foreground/[0.12]"
              }`}
            >
              {m} min
            </button>
          ))}
        </form>
      </details>
    </section>
  );
}

export function StreakTile({ streak }: { streak: number }) {
  return (
    <div className={`${card} flex flex-col items-center justify-center px-4 py-5 text-center sm:px-6`}>
      <span aria-hidden className={`text-[2.6rem] leading-none sm:text-[3.2rem] ${streak > 0 ? "dash-flame" : "opacity-40 grayscale"}`}>🔥</span>
      <p className="mt-2 font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] sm:text-[2.4rem]">{streak}</p>
      <p className="mt-1 text-[15px] text-muted">{streak === 1 ? "day strong" : "days strong"}</p>
    </div>
  );
}

export function FeatherTile({ feathers }: { feathers: number }) {
  const { rank, next, pct, toNext } = rankFor(feathers);
  return (
    <div className={`${card} flex flex-col items-center justify-center bg-gradient-to-b from-emerald-500/[0.08] to-transparent px-4 py-5 text-center sm:px-6`}>
      <span aria-hidden className="dash-float text-[2.6rem] leading-none sm:text-[3.2rem]">🪶</span>
      <p className="mt-2 font-display text-[2rem] font-semibold leading-none tracking-[-0.03em] sm:text-[2.4rem]">{nf.format(feathers)}</p>
      <p className="mt-1 text-[15px] text-muted">feathers collected</p>
      <div className="mt-3 w-full max-w-[11rem]">
        <div className="h-1.5 overflow-hidden rounded-full bg-foreground/[0.08]">
          <div className="dash-fill h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-1.5 text-xs font-medium text-muted">
          {rank.emoji} {rank.name}
          {next ? ` · ${nf.format(toNext)} to ${next.name}` : " · top rank"}
        </p>
      </div>
    </div>
  );
}

export function CommunityCard({ readers }: { readers: number }) {
  return (
    <div className={`${card} relative flex min-h-[10.5rem] items-center overflow-hidden bg-gradient-to-br from-emerald-500/[0.1] via-transparent to-transparent pl-[6.75rem] pr-4 sm:pl-[9.5rem] sm:pr-7`}>
      {/* The parrot is a bust with a flat bottom: it sits on the card's bottom edge. */}
      <span aria-hidden className="absolute -bottom-1 left-3 block w-[5.75rem] sm:left-4 sm:w-[8.5rem]">
        <MascotArt />
      </span>
      <div className="py-5">
        <p className="font-display text-[1.5rem] font-semibold leading-tight tracking-[-0.03em] sm:text-[1.8rem]">DU PYQ community</p>
        <p className="mt-2 flex items-start gap-1.5 text-[15px] font-semibold sm:text-base">
          <span className="mt-[0.5em] size-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          {readers > 0 ? `${nf.format(readers)} ${readers === 1 ? "student" : "students"} read this week` : "Be the first to read this week"}
        </p>
      </div>
    </div>
  );
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-9 px-1 text-[13px] font-semibold uppercase tracking-[0.07em] text-muted sm:mt-11">{children}</h2>;
}

const TOOLS = [
  { emoji: "📚", label: "My notes", href: "#library" },
  { emoji: "📄", label: "PYQ papers", href: "/papers" },
  { emoji: "📅", label: "Datesheet", href: "/exam-help/datesheet" },
  { emoji: "🩺", label: "Result doctor", href: "/tools/result-doctor" },
] as const;

export function ToolTiles() {
  return (
    <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {TOOLS.map((t) => (
        <li key={t.label}>
          <Link
            href={t.href}
            className="group flex h-full min-h-[8.5rem] flex-col items-center justify-center gap-3 rounded-[24px] bg-surface px-3 py-5 text-center shadow-[var(--shadow-tile)] transition duration-300 ease-[var(--ease-apple)] hover:-translate-y-0.5 hover:shadow-[var(--shadow-tile-hover)] active:scale-[0.98]"
          >
            <span aria-hidden className="text-[2.4rem] leading-none transition duration-300 ease-[var(--ease-apple)] group-hover:scale-110">{t.emoji}</span>
            <span className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">{t.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function OverviewTiles({ notes, totalSeconds, activeDays, subjects }: { notes: number; totalSeconds: number; activeDays: number; subjects: number }) {
  const items = [
    { emoji: "📖", value: String(notes), label: notes === 1 ? "note unlocked" : "notes unlocked" },
    { emoji: "⏱️", value: fmtDuration(totalSeconds), label: "total reading" },
    { emoji: "📆", value: String(activeDays), label: activeDays === 1 ? "day you read" : "days you read" },
    { emoji: "🎯", value: String(subjects), label: subjects === 1 ? "subject listed" : "subjects listed" },
  ];
  return (
    <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-3.5 rounded-[24px] bg-surface px-4 py-4 shadow-[var(--shadow-tile)] sm:px-5">
          <span aria-hidden className="flex size-12 shrink-0 items-center justify-center rounded-[16px] bg-foreground/[0.05] text-[1.5rem]">{i.emoji}</span>
          <div className="min-w-0">
            <dd className="font-display text-[1.45rem] font-semibold leading-none tracking-[-0.03em]">{i.value}</dd>
            <dt className="mt-1 text-[13px] leading-tight text-muted">{i.label}</dt>
          </div>
        </div>
      ))}
    </dl>
  );
}
