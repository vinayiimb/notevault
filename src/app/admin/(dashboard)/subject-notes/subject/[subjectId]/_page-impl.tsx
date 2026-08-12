export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSubjectById } from "@/lib/data";
import { getResolvedThemeForNote } from "@/lib/note-theme-data";
import { NotesEditor } from "@/components/admin/notes-editor";

export default async function SubjectNotesEditorPage({
  params,
}: {
  params: Promise<{ subjectId: string }>;
}) {
  const { subjectId } = await params;
  const subject = await getSubjectById(subjectId);
  if (!subject) notFound();

  const resolvedTheme = await getResolvedThemeForNote(subjectId).catch(() => null);
  const pyqCount = subject.resources.filter((r) => r.type === "PYQ").length;

  return (
    <div className="space-y-6 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <p className="text-sm text-muted">
          <Link href="/admin/subject-notes" className="hover:text-accent">
            Subject Notes
          </Link>
          {" / "}
          <Link href={`/admin/subject-notes/program/${subject.term.program.id}`} className="hover:text-accent">
            {subject.term.program.name}
          </Link>
        </p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          {subject.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {subject.term.name} · {pyqCount} PYQs uploaded
          {subject.upc ? ` · UPC ${subject.upc}` : ""}
        </p>
      </div>

      <NotesEditor
        subjectId={subject.id}
        initialContent={subject.notes?.content ?? ""}
        initialTheme={subject.notes?.theme ?? "sky"}
        pyqCount={pyqCount}
        resolvedTheme={resolvedTheme}
      />
    </div>
  );
}
