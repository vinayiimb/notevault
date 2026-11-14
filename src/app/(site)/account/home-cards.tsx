import Link from "next/link";
import { BookOpenText, ChatsCircle, Lifebuoy, MagnifyingGlass, Play, WhatsappLogo } from "@phosphor-icons/react/dist/ssr";
import { setGoalAction } from "@/lib/paid-notes-actions";
import { GOAL_CHOICES, goalPct, rankFor } from "@/lib/feathers";
import { fmtDuration, istHour } from "@/lib/student-activity-format";

// The dashboard home (Apple-style): a large greeting, "Continue reading", today's numbers in one card and
// one-tap actions. Server components; the message reply box is the only client part (notice-card.tsx).

const tile = "rounded-[24px] bg-surface shadow-[var(--shadow-tile)]";
const nf = new Intl.NumberFormat("en-IN");

export function Greeting({ name, sub }: { name: string; sub: string }) {
  const h = istHour();
  const part = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
  return (
    <header className="pb-1">
      <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-muted">{today}</p>
      <h1 className="mt-1 font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-[2.6rem]">
        {part}, {name}
      </h1>
      <p className="mt-1.5 text-[17px] leading-snug text-muted">{sub}</p>
    </header>
  );
}

/** The note they were reading last (or their first note): one big button straight back into it. */
export function ContinueCard({ note }: { note: { href: string; subject: string; meta: string; resume: boolean } | null }) {
  if (!note) {
    return (
      <section className={`${tile} flex flex-col justify-between gap-5 p-5 sm:p-6`} aria-label="Get notes">
        <div>
          <span className="flex size-12 items-center justify-center rounded-[14px] bg-brand/10 text-brand">
            <BookOpenText size={24} weight="fill" />
          </span>
          <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.025em]">Your notes live here</h2>
          <p className="mt-1 text-[15px] leading-snug text-muted">Buy a subject and it opens right on this page.</p>
        </div>
        <Link href="/notes" className="inline-flex h-12 items-center justify-center rounded-full bg-brand px-6 text-[17px] font-semibold text-brand-foreground transition hover:bg-brand-hover active:scale-[0.985]">
          Browse notes
        </Link>
      </section>
    );
  }
  return (
    <section aria-label="Continue reading" className="relative flex flex-col justify-between gap-6 overflow-hidden rounded-[24px] bg-[#1d1d1f] p-5 text-white shadow-[var(--shadow-tile)] sm:p-6 dark:bg-[#2c2c2e]">
      <span aria-hidden className="pointer-events-none absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(41,151,255,0.55),transparent_70%)]" />
      <div className="relative">
        <p className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/60">{note.resume ? "Continue reading" : "Start reading"}</p>
        <h2 className="mt-2 line-clamp-2 text-[24px] font-semibold leading-[1.15] tracking-[-0.025em] sm:text-[28px]">{note.subject}</h2>
        <p className="mt-1 text-[15px] text-white/65">{note.meta}</p>
      </div>
      <Link href={note.href} className="relative inline-flex h-12 w-fit items-center gap-2 rounded-full bg-white px-6 text-[17px] font-semibold text-[#1d1d1f] transition hover:bg-white/90 active:scale-[0.985]">
        <Play size={16} weight="fill" /> {note.resume ? "Resume" : "Open"}
      </Link>
    </section>
  );
}

/** Today's goal as a ring, plus streak and feathers, in one card. */
export function TodayCard({ todaySeconds, goalMin, streak, feathers }: { todaySeconds: number; goalMin: number; streak: number; feathers: number }) {
  const pct = goalPct(todaySeconds, goalMin);
  const r = 34, c = 2 * Math.PI * r;
  const { rank } = rankFor(feathers);
  return (
    <section className={`${tile} p-5 sm:p-6`} aria-label="Today">
      <div className="flex items-center gap-5">
        <div className="relative size-[88px] shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" className="stroke-foreground/[0.08]" />
            <circle cx="40" cy="40" r={r} fill="none" strokeWidth="9" strokeLinecap="round" className={pct >= 100 ? "stroke-[#34c759]" : "stroke-brand"} strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(pct, 100) / 100)} />
          </svg>
          <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
            <span className="text-[20px] font-semibold tabular-nums">{Math.floor(todaySeconds / 60)}</span>
            <span className="mt-0.5 text-[11px] text-muted">of {goalMin}m</span>
          </span>
        </div>
        <div className="min-w-0">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em]">Today</h2>
          <p role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Today's reading goal" className="mt-0.5 text-[15px] leading-snug text-muted">
            {pct >= 100 ? "Goal done. Nice work." : todaySeconds > 0 ? `${fmtDuration(goalMin * 60 - todaySeconds)} to your goal` : "Open a note and the timer starts."}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-2.5">
        <div className="rounded-[16px] bg-surface-muted px-3.5 py-3">
          <dt className="text-[13px] text-muted">Streak</dt>
          <dd className="text-[20px] font-semibold tabular-nums">{streak} {streak === 1 ? "day" : "days"}</dd>
        </div>
        <div className="rounded-[16px] bg-surface-muted px-3.5 py-3">
          <dt className="text-[13px] text-muted">Feathers · {rank.name}</dt>
          <dd className="text-[20px] font-semibold tabular-nums">{nf.format(feathers)}</dd>
        </div>
      </dl>
      <details className="group mt-3">
        <summary className="inline-flex min-h-9 cursor-pointer list-none items-center text-[15px] font-medium text-brand [&::-webkit-details-marker]:hidden">Change daily goal</summary>
        <form action={setGoalAction} className="mt-2 flex flex-wrap gap-2">
          {GOAL_CHOICES.map((m) => (
            <button key={m} name="minutes" value={m} type="submit" aria-pressed={m === goalMin} className={`min-h-10 rounded-full px-4 text-sm font-semibold transition ${m === goalMin ? "bg-brand text-brand-foreground" : "bg-foreground/[0.07] hover:bg-foreground/[0.12]"}`}>
              {m} min
            </button>
          ))}
        </form>
      </details>
    </section>
  );
}

const ACTIONS = [
  { href: "#library", label: "My notes", Icon: BookOpenText, tone: "bg-[#0071e3]" },
  { href: "/account/support?kind=PROBLEM", label: "Report a problem", Icon: Lifebuoy, tone: "bg-[#ff9500]" },
  { href: "/account/support?kind=SUBJECT_MISSING", label: "Subject missing", Icon: MagnifyingGlass, tone: "bg-[#af52de]" },
  { href: "/account/support", label: "My tickets", Icon: ChatsCircle, tone: "bg-[#5856d6]" },
] as const;

/** One-tap actions, iOS home-screen style. */
export function QuickActions({ helpWhatsApp }: { helpWhatsApp: string }) {
  const cls = "flex flex-col items-center gap-2 rounded-[20px] p-2 text-center transition active:scale-95 hover:bg-foreground/[0.04]";
  const icon = "flex size-14 items-center justify-center rounded-[16px] text-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.45)]";
  return (
    <nav aria-label="Quick actions" className={`${tile} grid grid-cols-3 gap-1 p-3 sm:grid-cols-5 sm:p-4`}>
      {ACTIONS.map(({ href, label, Icon, tone }) => (
        <Link key={label} href={href} className={cls}>
          <span className={`${icon} ${tone}`}><Icon size={26} weight="fill" /></span>
          <span className="text-[13px] font-medium leading-tight">{label}</span>
        </Link>
      ))}
      <a href={`https://wa.me/${helpWhatsApp}`} target="_blank" rel="noopener noreferrer" className={cls}>
        <span className={`${icon} bg-[#25d366]`}><WhatsappLogo size={26} weight="fill" /></span>
        <span className="text-[13px] font-medium leading-tight">WhatsApp us</span>
      </a>
    </nav>
  );
}
