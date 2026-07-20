import Link from "next/link";
import { notFound } from "next/navigation";
import { FileArchive } from "@phosphor-icons/react/dist/ssr";
import { getTermById } from "@/lib/data";
import { levelLabel } from "@/lib/utils";
import { categorizeSubject } from "@/lib/subject-category";
import { TermSubjectTabs } from "@/components/subjects/term-subject-tabs";

export default async function TermPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();

  const subjects = term.subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    description: subject.description,
    resourceCount: subject.resources.length,
    repeatedCount: subject.questions.filter((q) => q.isRepeated).length,
    category: categorizeSubject(subject.name),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">
        {levelLabel(term.program.level)} ·{" "}
        <Link href={`/programs/${term.program.slug}`} className="hover:text-foreground">
          {term.program.name}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{term.name}</h1>

      {term.termPapers.length > 0 && (
        <div className="mt-6 rounded-2xl border border-border bg-surface p-4">
          <p className="text-sm font-medium">Combined papers for this semester</p>
          <p className="mt-1 text-xs text-muted">
            One file covering every subject, instead of split per subject below.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {term.termPapers.map((paper) => (
              <li key={paper.id}>
                <a
                  href={paper.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-sm hover:border-accent hover:text-accent"
                >
                  <FileArchive size={16} weight="bold" />
                  {paper.academicYear ?? paper.year ?? "Undated"} · {paper.fileName}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {subjects.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No subjects added yet.</p>
      ) : (
        <div className="mt-8">
          <TermSubjectTabs subjects={subjects} />
        </div>
      )}
    </div>
  );
}
