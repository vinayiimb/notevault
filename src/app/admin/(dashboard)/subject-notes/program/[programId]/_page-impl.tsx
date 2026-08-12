export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgramWithSubjectNotesStatus } from "@/lib/subject-notes-admin-data";

export default async function SubjectNotesProgramPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const program = await getProgramWithSubjectNotesStatus(programId);
  if (!program) notFound();

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <p className="text-sm text-muted">
          <Link href="/admin/subject-notes" className="hover:text-accent">
            Subject Notes
          </Link>
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          {program.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          Pick a subject to view its uploaded PYQs and deploy notes for it.
        </p>
      </div>

      <div className="space-y-6">
        {program.terms.map((term) => (
          <div key={term.id} className="overflow-hidden rounded-2xl border border-border bg-surface">
            <div className="border-b border-border bg-surface-muted px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-muted">
              {term.name}
            </div>
            {term.subjects.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted">No subjects in this term yet.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <tbody>
                  {term.subjects.map((s) => (
                    <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                      <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                      <td className="px-4 py-3 text-xs text-muted">{s.resources.length} PYQs uploaded</td>
                      <td className="px-4 py-3">
                        {s.notes ? (
                          <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-bold text-success">
                            Deployed
                          </span>
                        ) : (
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted">
                            Not deployed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={`/admin/subject-notes/subject/${s.id}`}
                          className="text-xs font-bold text-accent hover:underline"
                        >
                          {s.notes ? "Edit notes →" : "Add notes →"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
