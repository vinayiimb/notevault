export const dynamic = "force-dynamic";
import Link from "next/link";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import { getProgramsWithNotesStatus } from "@/lib/subject-notes-admin-data";

export default async function SubjectNotesOverviewPage() {
  let programs;
  let loadError: string | null = null;
  try {
    programs = await getProgramsWithNotesStatus();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "Could not load programmes.";
  }

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <NotePencil size={20} weight="bold" />
          <span>Subject Notes</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          Deploy study notes by programme &amp; subject
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Pick a programme to see its subjects and which ones already have published notes. Open a subject
          to paste in a finished .md file (or write notes directly) and publish it to the subject&apos;s
          public page.
        </p>
      </div>

      {loadError ? (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-700 dark:text-red-300">
          <p className="font-bold">Couldn&apos;t load programmes</p>
          <p className="mt-1 opacity-90">{loadError}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-surface-muted text-xs uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Programme</th>
                <th className="px-4 py-3 text-right">Subjects</th>
                <th className="px-4 py-3 text-right">Notes deployed</th>
                <th className="w-10 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {programs!.map((p) => (
                <tr key={p.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                  <td className="px-4 py-3 font-semibold text-foreground">{p.name}</td>
                  <td className="px-4 py-3 text-right">{p.subjectCount}</td>
                  <td className="px-4 py-3 text-right">
                    {p.notesCount > 0 ? (
                      <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                        {p.notesCount} / {p.subjectCount}
                      </span>
                    ) : (
                      <span className="text-muted">0 / {p.subjectCount}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/subject-notes/program/${p.id}`}
                      className="text-xs font-bold text-accent hover:underline"
                    >
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
