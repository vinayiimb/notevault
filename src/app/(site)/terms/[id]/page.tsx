import Link from "next/link";
import { notFound } from "next/navigation";
import { getTermById } from "@/lib/data";
import { levelLabel } from "@/lib/utils";
import { categorizeSubject } from "@/lib/subject-category";
import { TermSubjectTabs } from "@/components/subjects/term-subject-tabs";
import { TermPapersDisplay } from "@/components/subjects/term-papers-display";

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

      <TermPapersDisplay papers={term.termPapers} />

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
