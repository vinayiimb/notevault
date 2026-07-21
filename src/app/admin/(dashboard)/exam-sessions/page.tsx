import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createExamSessionAction, deleteExamSessionAction } from "@/lib/actions";

export default async function AdminExamSessionsPage() {
  const sessions = await prisma.examSession.findMany({
    include: { _count: { select: { links: true } } },
    orderBy: { order: "desc" },
  });

  return (
    <div className="p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Exam sessions</h1>
          <p className="mt-1 text-sm text-muted">
            Each session is a year/period (e.g. &ldquo;2026 (May-June) Question Papers&rdquo;) that links out
            to a Google Drive folder per course.
          </p>
        </div>
        <Link
          href="/admin/exam-sessions/subjects"
          className="shrink-0 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium transition hover:border-accent/60 hover:text-accent"
        >
          All subjects (matching table)
        </Link>
      </div>

      <form
        action={createExamSessionAction}
        className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Label</label>
          <input
            name="label"
            required
            placeholder="e.g. 2026 (May-June) Question Papers"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Order</label>
          <input
            name="order"
            type="number"
            defaultValue={0}
            placeholder="Higher = newer"
            className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Master Drive link (optional)</label>
          <input
            name="masterDriveUrl"
            type="url"
            placeholder="https://drive.google.com/drive/folders/... (ALL Search by Name)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Add session
        </button>
      </form>

      <ul className="mt-6 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {sessions.map((session) => (
          <li key={session.id} className="flex items-center justify-between gap-4 p-4">
            <Link href={`/admin/exam-sessions/${session.id}`} className="min-w-0">
              <p className="font-medium">{session.label}</p>
              <p className="text-xs text-muted">
                order {session.order} · {session._count.links} course{session._count.links === 1 ? "" : "s"} linked
              </p>
            </Link>
            <form action={deleteExamSessionAction}>
              <input type="hidden" name="id" value={session.id} />
              <button type="submit" className="text-sm text-red-500 hover:underline">
                Delete
              </button>
            </form>
          </li>
        ))}
        {sessions.length === 0 && (
          <li className="p-4 text-sm text-muted">No sessions yet. Add one above.</li>
        )}
      </ul>
    </div>
  );
}
