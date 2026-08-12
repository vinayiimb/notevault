export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProgrammeSubjectsWithNotesStatus } from "@/lib/canonical-subject-notes-data";

export default async function SubjectNotesProgramPage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId: programmeSlug } = await params;
  const programme = await getProgrammeSubjectsWithNotesStatus(programmeSlug);
  if (!programme) notFound();

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <p className="text-sm text-muted">
          <Link href="/admin/subject-notes" className="hover:text-accent">
            Subject Notes
          </Link>
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          {programme.name}
        </h1>
        <p className="mt-1 text-sm text-muted">{programme.subjects.length} subjects in the syllabus file.</p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-surface">
        <table className="w-full text-left text-sm">
          <tbody>
            {programme.subjects.map((s) => (
              <tr key={s.slug} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                <td className="px-4 py-3">
                  {s.hasNotes ? (
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
                    href={`/admin/subject-notes/subject/${programme.slug}/${s.slug}`}
                    className="text-xs font-bold text-accent hover:underline"
                  >
                    {s.hasNotes ? "Edit notes →" : "Add notes →"}
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
