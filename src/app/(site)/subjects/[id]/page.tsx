import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DownloadSimple,
  FileText,
  Fire,
  Exam,
} from "@phosphor-icons/react/dist/ssr";
import { getSubjectById } from "@/lib/data";
import { formatBytes, levelLabel } from "@/lib/utils";
import { PaperAnalysisPanel } from "@/components/subjects/paper-analysis-panel";

export default async function SubjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const subject = await getSubjectById(id);
  if (!subject) notFound();

  const notes = subject.resources.filter((r) => r.type === "NOTES");
  const pyqs = subject.resources.filter((r) => r.type === "PYQ");
  const repeated = subject.questions.filter((q) => q.isRepeated);
  const others = subject.questions.filter((q) => !q.isRepeated);
  const initialAnalysis = subject.analysis
    ? {
        compiledNotes: subject.analysis.compiledNotes,
        mostRepeated: JSON.parse(subject.analysis.mostRepeatedJson),
        predictedPaper: JSON.parse(subject.analysis.predictedPaperJson),
      }
    : null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">
        {levelLabel(subject.term.program.level)} ·{" "}
        <Link href={`/programs/${subject.term.program.slug}`} className="hover:text-foreground">
          {subject.term.program.name}
        </Link>{" "}
        ·{" "}
        <Link href={`/terms/${subject.term.id}`} className="hover:text-foreground">
          {subject.term.name}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{subject.name}</h1>
      {subject.description && <p className="mt-2 text-muted">{subject.description}</p>}

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <FileText size={20} weight="bold" className="text-accent" />
          Notes
        </h2>
        <ResourceList resources={notes} emptyLabel="No notes uploaded yet." />
      </section>

      <section className="mt-10">
        <h2 className="flex items-center gap-2 text-lg font-medium">
          <Exam size={20} weight="bold" className="text-accent" />
          Previous year question papers
        </h2>
        <ResourceList resources={pyqs} emptyLabel="No PYQs uploaded yet." />
      </section>

      {repeated.length > 0 && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <Fire size={20} weight="bold" className="text-accent" />
            Most repeated questions
          </h2>
          <p className="mt-1 text-sm text-muted">
            Questions flagged as frequently repeated across previous papers.
          </p>
          <div className="mt-4 flex flex-col gap-3">
            {repeated.map((q) => (
              <QuestionItem key={q.id} question={q} />
            ))}
          </div>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-10">
          <h2 className="text-lg font-medium">More questions</h2>
          <div className="mt-4 flex flex-col gap-3">
            {others.map((q) => (
              <QuestionItem key={q.id} question={q} />
            ))}
          </div>
        </section>
      )}

      <PaperAnalysisPanel
        subjectId={subject.id}
        pyqCount={pyqs.length}
        initialAnalysis={initialAnalysis}
        generatedAt={subject.analysis?.generatedAt.toLocaleString() ?? null}
      />
    </div>
  );
}

function ResourceList({
  resources,
  emptyLabel,
}: {
  resources: { id: string; title: string; year: number | null; fileUrl: string; fileSize: number }[];
  emptyLabel: string;
}) {
  if (resources.length === 0) {
    return <p className="mt-3 text-sm text-muted">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-4 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
      {resources.map((r) => (
        <li key={r.id} className="flex items-center justify-between gap-4 p-4">
          <div className="min-w-0">
            <p className="truncate font-medium">{r.title}</p>
            <p className="text-xs text-muted">
              {r.year ? `${r.year} · ` : ""}
              {formatBytes(r.fileSize)}
            </p>
          </div>
          <a
            href={`/api/download/${r.id}`}
            download
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-foreground transition hover:opacity-90"
          >
            <DownloadSimple size={16} weight="bold" />
            Download
          </a>
        </li>
      ))}
    </ul>
  );
}

function QuestionItem({
  question,
}: {
  question: {
    id: string;
    questionText: string;
    answerText: string;
    marks: number | null;
    years: string | null;
    repeatCount: number;
    isRepeated: boolean;
  };
}) {
  return (
    <details className="group rounded-xl border border-border bg-surface p-4 open:border-accent">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-4">
        <span className="font-medium">{question.questionText}</span>
        <span className="flex shrink-0 items-center gap-2 text-xs text-muted">
          {question.marks && <span>{question.marks} marks</span>}
          {question.isRepeated && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent">
              seen {question.repeatCount}x
            </span>
          )}
        </span>
      </summary>
      <div className="mt-3 border-t border-border pt-3 text-sm text-muted">
        <p className="whitespace-pre-wrap text-foreground">{question.answerText}</p>
        {question.years && <p className="mt-2 text-xs">Appeared in: {question.years}</p>}
      </div>
    </details>
  );
}
