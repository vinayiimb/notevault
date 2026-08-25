export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { CanonicalNotesEditor } from "@/components/admin/canonical-notes-editor";

export default async function SubjectNotesEditorPage({
  params,
}: {
  params: Promise<{ programmeSlug: string; subjectSlug: string }>;
}) {
  const { programmeSlug, subjectSlug } = await params;
  const note = await getCanonicalNote(programmeSlug, subjectSlug);
  if (!note) notFound();

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <p className="text-sm text-muted">
          <Link href="/admin/subject-notes" className="hover:text-accent">
            Subject Notes
          </Link>
          {" / "}
          <Link href={`/admin/subject-notes/program/${programmeSlug}`} className="hover:text-accent">
            {note.programmeName}
          </Link>
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          {note.subjectName}
        </h1>
        {note.updatedAt && (
          <p className="mt-1 text-sm text-muted">Last saved {new Date(note.updatedAt).toLocaleString()}</p>
        )}
      </div>

      <CanonicalNotesEditor
        programmeSlug={programmeSlug}
        programme={note.programmeName}
        subjectSlug={subjectSlug}
        subject={note.subjectName}
        initialContent={note.content}
        initialTheme={note.theme}
      />
    </div>
  );
}
