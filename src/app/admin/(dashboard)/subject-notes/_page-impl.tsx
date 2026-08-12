export const dynamic = "force-dynamic";
import Link from "next/link";
import { NotePencil } from "@phosphor-icons/react/dist/ssr";
import { getProgrammesWithNotesStatus } from "@/lib/canonical-subject-notes-data";

export default async function SubjectNotesOverviewPage() {
  const programmes = await getProgrammesWithNotesStatus();

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
          The full official list of {programmes.length} DU programmes from the canonical syllabus file. Pick
          one to see its subjects and drop in a finished .md file.
        </p>
      </div>

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
            {programmes.map((p) => (
              <tr key={p.slug} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
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
                    href={`/admin/subject-notes/program/${p.slug}`}
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
    </div>
  );
}
