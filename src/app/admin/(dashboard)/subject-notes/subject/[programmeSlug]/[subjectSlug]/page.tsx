export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCanonicalNote, GENERAL_PROGRAMME, subjectSlugFor } from "@/lib/canonical-subject-notes-data";
import { CanonicalNotesEditor } from "@/components/admin/canonical-notes-editor";

export default async function SubjectNotesEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ programmeSlug: string; subjectSlug: string }>;
  searchParams: Promise<{ name?: string }>;
}) {
  const { programmeSlug, subjectSlug } = await params;
  const { name } = await searchParams;
  // "Add custom note" form lands here with slug "new"; send it to the real slug (General Notes only).
  if (programmeSlug === GENERAL_PROGRAMME.slug && subjectSlug === "new" && name?.trim()) {
    const clean = name.trim();
    redirect(`/admin/subject-notes/subject/${programmeSlug}/${subjectSlugFor(programmeSlug, clean)}?name=${encodeURIComponent(clean)}`);
  }
  const note = await getCanonicalNote(programmeSlug, subjectSlug, name);
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
        initialSemester={note.semester}
        initialIsFree={note.isFree}
      />
    </div>
  );
}
