import Link from "next/link";
import { CaretRight, Exam, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { getExamSessions } from "@/lib/data";

export default async function ExamSessionsPage() {
  const sessions = await getExamSessions();
  const newestId = sessions[0]?.id;
  const totalLinks = sessions.reduce((sum, s) => sum + s._count.links, 0);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
        <Exam size={28} weight="bold" className="text-accent" />
        Question papers
      </h1>
      <p className="mt-2 text-muted">
        Every exam session we have, from {sessions[sessions.length - 1]?.label ?? "the earliest year"} to{" "}
        {sessions[0]?.label ?? "now"} — pick a session to see every course&rsquo;s Google Drive folder.
        {totalLinks > 0 && ` ${totalLinks} course folders in total.`}
      </p>

      {sessions.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No sessions added yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/exam-sessions/${session.id}`}
              className="group flex items-center justify-between gap-4 rounded-2xl border border-border bg-surface p-5 transition hover:border-accent/50 hover:shadow-sm"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium">{session.label}</p>
                  {session.id === newestId && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">
                      <Sparkle size={11} weight="fill" />
                      Latest
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {session._count.links} course{session._count.links === 1 ? "" : "s"} linked
                </p>
              </div>
              <CaretRight
                size={16}
                weight="bold"
                className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
