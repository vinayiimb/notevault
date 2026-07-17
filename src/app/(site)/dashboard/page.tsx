import Link from "next/link";
import { ensureStudent, getCommunityOrangesTotal, getTodayOranges, DAILY_TARGET_ORANGES } from "@/lib/student";
import { getResourceHighlights } from "@/lib/data";
import { NicknamePrompt } from "@/components/dashboard/nickname-prompt";
import { CurrencyIcon } from "@/components/dashboard/currency-icon";

const EXAM_KIT_MODES = [
  { emoji: "📖", label: "Flashcards" },
  { emoji: "✅", label: "Quiz" },
  { emoji: "✏️", label: "Fill blanks" },
  { emoji: "🗺️", label: "Concept map" },
  { emoji: "📝", label: "Skeleton answer" },
  { emoji: "😈", label: "Devil's advocate" },
] as const;

export default async function DashboardPage() {
  const student = await ensureStudent();
  const [todayOranges, communityTotal, highlights] = await Promise.all([
    getTodayOranges(student.id),
    getCommunityOrangesTotal(),
    getResourceHighlights(),
  ]);

  const progressPct = Math.min(100, Math.round((todayOranges / DAILY_TARGET_ORANGES) * 100));

  return (
    <div className="bg-dashboard-bg">
      <div className="mx-auto w-full max-w-[1800px] px-4 py-10 sm:px-6 lg:px-10">
        {!student.nickname && (
          <div className="mb-6">
            <NicknamePrompt />
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[2fr_1fr_1fr]">
          <div className="rounded-3xl bg-surface p-6 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
            <p className="font-display text-xl font-bold">Today&apos;s Progress</p>
            <div className="mt-4 h-1.5 max-w-xs overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-foreground transition-all"
                style={{ width: `${Math.max(progressPct, 3)}%` }}
              />
            </div>
            <p className="mt-4 text-base text-foreground">
              You&apos;ve collected <span className="font-bold">{todayOranges}</span> of{" "}
              <span className="font-bold">{DAILY_TARGET_ORANGES}</span> targeted oranges
            </p>
            <button type="button" className="mt-2 text-sm text-muted">
              Update Target ↗
            </button>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-surface p-6 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
            <span className="text-3xl">🔥</span>
            <p className="font-display text-3xl font-bold">{student.streak}</p>
            <p className="text-sm text-muted">days strong</p>
          </div>

          <div className="flex flex-col items-center justify-center gap-2 rounded-3xl bg-surface p-6 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
            <CurrencyIcon className="size-8 text-3xl" />
            <p className="font-display text-3xl font-bold">{student.oranges.toLocaleString()}</p>
            <p className="text-sm text-muted">oranges collected</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 rounded-3xl bg-surface p-6 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
          <CurrencyIcon className="size-14 text-5xl" />
          <div>
            <p className="inline-block rounded-lg bg-yellow-soft px-2 font-display text-3xl font-black text-foreground">
              {communityTotal.toLocaleString()}
            </p>
            <p className="mt-1 text-sm text-muted">collected by the NoteVault community</p>
          </div>
          <Link
            href="/leaderboard"
            className="ml-auto shrink-0 text-sm font-semibold text-brand hover:underline"
          >
            View Leaderboard ↗
          </Link>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
          <HighlightCard
            title="Latest Notes"
            badge={`${highlights.noteCount} notes`}
            resource={highlights.latestNote}
            viewAllHref="/browse/college"
            viewAllLabel="View All Notes"
          />
          <HighlightCard
            title="Latest PYQs"
            badge={`${highlights.pyqCount} papers`}
            resource={highlights.latestPyq}
            viewAllHref="/browse/college"
            viewAllLabel="View All Papers"
          />
        </div>

        <p className="mt-10 text-xs font-semibold uppercase tracking-wide text-muted">Exam Kit</p>
        <div className="mt-4 grid grid-cols-3 gap-4 sm:grid-cols-6">
          {EXAM_KIT_MODES.map(({ emoji, label }) => (
            <Link
              key={label}
              href="/tools/exam-kit"
              className="flex flex-col items-center gap-3 rounded-3xl bg-surface p-5 text-center shadow-[0_10px_40px_rgba(0,0,0,.06)] transition hover:-translate-y-1 hover:shadow-[0_14px_44px_rgba(0,0,0,.1)]"
            >
              <span className="text-3xl">{emoji}</span>
              <span className="text-sm font-semibold">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function HighlightCard({
  title,
  badge,
  resource,
  viewAllHref,
  viewAllLabel,
}: {
  title: string;
  badge: string;
  resource: { id: string; title: string; subject: { id: string; name: string } } | null;
  viewAllHref: string;
  viewAllLabel: string;
}) {
  return (
    <div className="relative rounded-3xl bg-surface p-6 shadow-[0_10px_40px_rgba(0,0,0,.06)]">
      <span className="absolute right-6 top-6 rounded-full bg-green-soft px-3 py-1 text-xs font-semibold text-green">
        {badge}
      </span>
      <p className="font-display text-lg font-bold">{title}</p>

      {resource ? (
        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-foreground">
            📅 {resource.subject.name}: {resource.title}
          </span>
          <Link
            href={`/subjects/${resource.subject.id}`}
            className="shrink-0 rounded-full bg-brand px-4 py-1.5 text-sm font-semibold text-brand-foreground transition hover:opacity-90"
          >
            Open →
          </Link>
        </div>
      ) : (
        <p className="mt-5 text-sm text-muted">Nothing uploaded yet.</p>
      )}

      <Link href={viewAllHref} className="mt-4 block text-sm text-muted hover:text-foreground">
        {viewAllLabel} →
      </Link>
    </div>
  );
}
