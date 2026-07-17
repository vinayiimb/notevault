import { getLeaderboard, getCurrentStudent } from "@/lib/student";
import { CurrencyIcon } from "@/components/dashboard/currency-icon";

export default async function LeaderboardPage() {
  const [rows, me] = await Promise.all([getLeaderboard(50), getCurrentStudent()]);

  return (
    <div className="bg-dashboard-bg">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏆</span>
          <h1 className="font-display text-3xl font-bold tracking-tight">Leaderboard</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          Top orange collectors across the NoteVault community.
        </p>

        {rows.length === 0 ? (
          <p className="mt-8 rounded-3xl bg-surface p-6 text-sm text-muted shadow-[0_10px_40px_rgba(0,0,0,.06)]">
            No one&apos;s on the board yet — pick a nickname on your{" "}
            <a href="/dashboard" className="font-medium text-brand hover:underline">
              dashboard
            </a>{" "}
            to be first.
          </p>
        ) : (
          <ol className="mt-6 flex flex-col gap-2">
            {rows.map((row, i) => (
              <li
                key={row.id}
                className={`flex items-center gap-4 rounded-3xl p-4 shadow-[0_10px_40px_rgba(0,0,0,.06)] ${
                  row.id === me?.id ? "bg-brand-soft" : "bg-surface"
                }`}
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-dashboard-bg font-display text-sm font-bold text-muted">
                  {i + 1}
                </span>
                <span className="flex-1 truncate font-semibold">
                  {row.nickname}
                  {row.id === me?.id && <span className="ml-2 text-xs font-normal text-brand">(you)</span>}
                </span>
                <span className="flex items-center gap-1 text-xs text-muted">
                  🔥 {row.streak}
                </span>
                <span className="flex shrink-0 items-center gap-1 font-bold">
                  <CurrencyIcon className="size-4 text-sm" /> {row.oranges.toLocaleString()}
                </span>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
