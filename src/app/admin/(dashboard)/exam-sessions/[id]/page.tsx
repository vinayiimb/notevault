import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  updateExamSessionAction,
  linkProgramToSessionAction,
  deleteSessionProgramLinkAction,
} from "@/lib/actions";
import { ImportSessionCsv } from "@/components/exam-sessions/import-session-csv";

export default async function AdminExamSessionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.examSession.findUnique({
    where: { id },
    include: {
      links: {
        include: { program: true, _count: { select: { driveFiles: true } } },
        orderBy: [{ program: { name: "asc" } }, { variantLabel: "asc" }],
      },
    },
  });
  if (!session) notFound();

  const programs = await prisma.program.findMany({ orderBy: { name: "asc" } });

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href="/admin/exam-sessions" className="hover:text-accent">
          Exam sessions
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{session.label}</h1>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Session details</h2>
        <form
          action={updateExamSessionAction}
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="id" value={session.id} />
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Label</label>
            <input
              name="label"
              required
              defaultValue={session.label}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Order</label>
            <input
              name="order"
              type="number"
              defaultValue={session.order}
              className="w-32 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Master Drive link (optional)</label>
            <input
              name="masterDriveUrl"
              type="url"
              defaultValue={session.masterDriveUrl ?? ""}
              placeholder="https://drive.google.com/drive/folders/..."
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Save
          </button>
        </form>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Import course links from CSV</h2>
        <p className="mt-1 text-sm text-muted">
          Columns: <code>course</code> (or <code>program</code>/<code>name</code>) and <code>url</code>{" "}
          (or <code>link</code>/<code>drive</code>/<code>folder</code>). Rows that confidently match an
          existing course are linked automatically; anything uncertain is left for you to resolve below
          instead of being silently created.
        </p>
        <div className="mt-4">
          <ImportSessionCsv sessionId={session.id} programs={programs} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-muted">Linked courses</h2>
        <ul className="mt-3 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {session.links.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-4 p-3">
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  {link.program.name}
                  {link.variantLabel && (
                    <span className="ml-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                      {link.variantLabel}
                    </span>
                  )}
                </p>
                <a
                  href={link.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-xs text-accent hover:underline"
                >
                  {link.driveUrl}
                </a>
                {link._count.driveFiles > 0 && (
                  <p className="mt-0.5 text-xs text-muted">{link._count.driveFiles} file(s) synced</p>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <Link
                  href={`/admin/exam-sessions/${session.id}/links/${link.id}`}
                  className="text-xs font-medium text-accent hover:underline"
                >
                  Files
                </Link>
                <form action={deleteSessionProgramLinkAction}>
                  <input type="hidden" name="id" value={link.id} />
                  <input type="hidden" name="sessionId" value={session.id} />
                  <button type="submit" className="text-xs text-red-500 hover:underline">
                    Remove
                  </button>
                </form>
              </div>
            </li>
          ))}
          {session.links.length === 0 && (
            <li className="p-3 text-sm text-muted">No courses linked yet.</li>
          )}
        </ul>
      </section>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Add a course link manually</h2>
        <p className="mt-1 text-sm text-muted">
          Use the &ldquo;Variant&rdquo; field when a course needs more than one Drive folder in the same
          session (e.g. DU&rsquo;s Common Pool has separate SEC/VAC/AEC folders) — leave it blank
          otherwise.
        </p>
        <form
          action={linkProgramToSessionAction}
          className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <input type="hidden" name="sessionId" value={session.id} />
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Course</label>
            <select
              name="programId"
              required
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            >
              {programs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Variant (optional)</label>
            <input
              name="variantLabel"
              placeholder="e.g. SEC"
              className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <label className="text-xs font-medium text-muted">Drive link</label>
            <input
              name="driveUrl"
              type="url"
              required
              placeholder="https://drive.google.com/drive/folders/..."
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            Link
          </button>
        </form>
      </section>
    </div>
  );
}
