import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Cards,
  CheckSquare,
  Fire,
  NotePencil,
  Scales,
  ShareNetwork,
  Sparkle,
  TextT,
  Trophy,
} from "@phosphor-icons/react/dist/ssr";
import { ensureStudent, getCommunityOrangesTotal, getTodayOranges, DAILY_TARGET_ORANGES } from "@/lib/student";
import { getResourceHighlights } from "@/lib/data";
import { NicknamePrompt } from "@/components/dashboard/nickname-prompt";
import { CurrencyIcon } from "@/components/dashboard/currency-icon";

const EXAM_KIT_MODES = [
  { icon: Cards, label: "Flashcards", detail: "Recall fast" },
  { icon: CheckSquare, label: "Quiz", detail: "Check retention" },
  { icon: TextT, label: "Fill blanks", detail: "Train memory" },
  { icon: ShareNetwork, label: "Concept map", detail: "See connections" },
  { icon: NotePencil, label: "Answer skeleton", detail: "Structure replies" },
  { icon: Scales, label: "Devil's advocate", detail: "Stress-test ideas" },
] as const;

export default async function DashboardPage() {
  const student = await ensureStudent();
  const [todayOranges, communityTotal, highlights] = await Promise.all([
    getTodayOranges(student.id),
    getCommunityOrangesTotal(),
    getResourceHighlights(),
  ]);
  const progressPct = Math.min(100, Math.round((todayOranges / DAILY_TARGET_ORANGES) * 100));
  const latestResource = highlights.latestPyq ?? highlights.latestNote;

  return (
    <div className="min-h-full bg-dashboard-bg">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 grid gap-6 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold text-brand">Today in your vault</p>
            <h1 className="mt-2 text-balance font-display text-4xl font-bold tracking-[-0.035em] sm:text-5xl">
              {student.nickname ? `Welcome back, ${student.nickname}` : "Make today count"}
            </h1>
            <p className="mt-2 max-w-2xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
              One focused paper beats ten open tabs. Start with the latest upload or turn it into a quick drill.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            {latestResource && (
              <Link
                href={`/subjects/${latestResource.subject.id}`}
                className="group inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-semibold text-foreground hover:border-brand/40 hover:text-brand"
              >
                <BookOpen size={17} weight="bold" />
                Open latest paper
                <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
            <Link
              href="/tools/exam-kit"
              className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-brand-foreground hover:-translate-y-0.5 hover:bg-brand-hover"
            >
              <Sparkle size={17} weight="fill" />
              Start a study session
              <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </header>

        {!student.nickname && (
          <div className="mb-5">
            <NicknamePrompt />
          </div>
        )}

        <section aria-label="Today's study board" className="overflow-hidden rounded-2xl bg-surface">
          <div className="grid lg:grid-cols-[1.25fr_.75fr]">
            <div className="p-6 sm:p-8 lg:p-10">
              <p className="text-sm font-semibold text-muted">Daily target</p>
              <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
                <div
                  className="grid size-36 shrink-0 place-items-center rounded-full p-3"
                  style={{
                    background: `conic-gradient(var(--brand) ${progressPct}%, var(--surface-muted) ${progressPct}% 100%)`,
                  }}
                >
                  <div className="grid size-full place-items-center rounded-full bg-surface text-center">
                    <div>
                      <span className="block font-mono text-3xl font-bold tabular-nums">{progressPct}%</span>
                      <span className="mt-1 block text-xs text-muted">complete</span>
                    </div>
                  </div>
                </div>
                <div className="max-w-md">
                  <h2 className="text-balance font-display text-3xl font-bold tracking-[-0.03em]">
                    {progressPct >= 100 ? "Target cleared. Keep the momentum." : "Your next paper moves the ring."}
                  </h2>
                  <p className="mt-3 text-pretty text-sm leading-relaxed text-muted">
                    You have collected <strong className="text-foreground">{todayOranges}</strong> of {DAILY_TARGET_ORANGES} oranges today.
                    Opening a paper or finishing an exam-kit session adds to the total.
                  </p>
                  <Link href="/browse/college" className="group mt-5 inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline">
                    Find the right paper
                    <ArrowRight size={15} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 border-t border-border lg:border-t-0 lg:border-l">
              <Metric icon={<Fire size={22} weight="fill" />} value={student.streak} label="day streak" />
              <Metric icon={<CurrencyIcon className="size-6 text-2xl" />} value={student.oranges} label="your oranges" />
              <Metric icon={<Trophy size={22} weight="fill" />} value={communityTotal} label="community total" />
              <Link
                href="/leaderboard"
                className="group flex min-h-40 flex-col justify-between border-t border-l border-border p-5 hover:bg-brand-soft sm:p-6"
              >
                <ArrowUpRight size={22} weight="bold" className="ml-auto text-muted group-hover:text-brand" />
                <span>
                  <span className="block font-semibold text-foreground">See your rank</span>
                  <span className="mt-1 block text-xs text-muted">Open leaderboard</span>
                </span>
              </Link>
            </div>
          </div>

          <div className="border-t border-border px-6 py-6 sm:px-8 lg:px-10">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brand">A focused 20-minute route</p>
                <p className="mt-1 text-sm text-muted">Use one paper three ways instead of collecting more tabs.</p>
              </div>
              <span className="text-xs font-medium text-muted">Suggested, not required</span>
            </div>
            <ol className="mt-5 grid overflow-hidden rounded-xl border border-border md:grid-cols-3">
              <StudyStep
                number="01"
                title="Open one paper"
                detail={latestResource ? latestResource.subject.name : "Choose a subject"}
                href={latestResource ? `/subjects/${latestResource.subject.id}` : "/browse/college"}
              />
              <StudyStep number="02" title="Turn it into a drill" detail="Quiz or flashcards" href="/tools/exam-kit" />
              <StudyStep number="03" title="Bank the progress" detail="Check your daily total" href="/leaderboard" />
            </ol>
          </div>
        </section>

        <section aria-labelledby="library-stream" className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">Library stream</p>
              <h2 id="library-stream" className="mt-1 font-display text-2xl font-bold tracking-tight">
                New material, without the hunt
              </h2>
            </div>
            <Link href="/browse/college" className="text-sm font-semibold text-brand hover:underline">
              Browse the full library →
            </Link>
          </div>
          <div className="overflow-hidden rounded-2xl bg-surface">
            <ResourceRow title="Latest notes" count={`${highlights.noteCount} notes`} resource={highlights.latestNote} />
            <ResourceRow title="Latest PYQ" count={`${highlights.pyqCount} papers`} resource={highlights.latestPyq} />
          </div>
        </section>

        <section aria-labelledby="practice-modes" className="mt-12">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-muted">Practice modes</p>
              <h2 id="practice-modes" className="mt-1 font-display text-2xl font-bold tracking-tight">
                Same syllabus. Six ways to learn it.
              </h2>
            </div>
            <Link href="/tools/exam-kit" className="text-sm font-semibold text-brand hover:underline">
              Open exam kit →
            </Link>
          </div>
          <div className="grid overflow-hidden rounded-2xl bg-surface sm:grid-cols-2 lg:grid-cols-3">
            {EXAM_KIT_MODES.map(({ icon: Icon, label, detail }) => (
              <Link
                key={label}
                href="/tools/exam-kit"
                className="group flex min-h-28 items-center gap-4 border-b border-border p-5 hover:bg-brand-soft sm:border-r lg:p-6"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand group-hover:bg-brand group-hover:text-brand-foreground">
                  <Icon size={21} weight="bold" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-foreground">{label}</span>
                  <span className="mt-1 block text-xs text-muted">{detail}</span>
                </span>
                <ArrowRight size={15} weight="bold" className="ml-auto text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex min-h-40 flex-col justify-between border-l border-border p-5 odd:border-l-0 [&:nth-child(n+3)]:border-t sm:p-6">
      <span className="text-brand">{icon}</span>
      <span>
        <span className="block font-mono text-3xl font-bold tabular-nums">{value.toLocaleString()}</span>
        <span className="mt-1 block text-xs text-muted">{label}</span>
      </span>
    </div>
  );
}

function StudyStep({ number, title, detail, href }: { number: string; title: string; detail: string; href: string }) {
  return (
    <li className="border-b border-border last:border-b-0 md:border-r md:border-b-0 md:last:border-r-0">
      <Link href={href} className="group flex min-h-24 items-center gap-4 px-5 py-4 hover:bg-brand-soft">
        <span className="font-mono text-xs font-semibold text-brand">{number}</span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{title}</span>
          <span className="mt-1 block truncate text-xs text-muted">{detail}</span>
        </span>
        <ArrowRight size={15} weight="bold" className="ml-auto shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand" />
      </Link>
    </li>
  );
}

function ResourceRow({
  title,
  count,
  resource,
}: {
  title: string;
  count: string;
  resource: { id: string; title: string; subject: { id: string; name: string } } | null;
}) {
  return (
    <article className="grid gap-4 border-b border-border p-5 last:border-b-0 sm:grid-cols-[10rem_1fr_auto] sm:items-center sm:p-6">
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-xs text-muted">{count}</p>
      </div>
      {resource ? (
        <div className="min-w-0">
          <p className="text-xs font-semibold text-brand">{resource.subject.name}</p>
          <p className="mt-1 truncate text-sm text-foreground">{resource.title}</p>
        </div>
      ) : (
        <p className="text-sm text-muted">Nothing uploaded yet. Check the full library for PYQs.</p>
      )}
      <Link
        href={resource ? `/subjects/${resource.subject.id}` : "/browse/college"}
        className="group inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-brand-soft px-4 py-2 text-sm font-semibold text-brand hover:bg-brand hover:text-brand-foreground"
      >
        {resource ? "Open" : "Browse"}
        <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
