import Link from "next/link";
import { notFound } from "next/navigation";
import {
  DownloadSimple,
  FileText,
  Fire,
  Exam,
  NotePencil,
  BookOpenText,
  CaretDown,
} from "@phosphor-icons/react/dist/ssr";
import { getSubjectById } from "@/lib/data";
import { formatBytes, levelLabel } from "@/lib/utils";
import { PaperAnalysisPanel } from "@/components/subjects/paper-analysis-panel";
import { NotesSection } from "@/components/subjects/notes-section";
import { OcrPaperRenderer } from "@/components/subjects/ocr-paper-renderer";

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

      {subject.notes && (
        <section className="mt-10">
          <h2 className="flex items-center gap-2 text-lg font-medium">
            <NotePencil size={20} weight="bold" className="text-sky-dark" />
            Compiled notes
          </h2>
          <NotesSection
            content={subject.notes.content}
            theme={subject.notes.theme}
            subjectName={subject.name}
          />
        </section>
      )}

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
        <PyqsByYear resources={pyqs} />
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

type PyqResource = {
  id: string;
  title: string;
  year: number | null;
  academicYear: string | null;
  fileUrl: string;
  fileSize: number;
  pageCount: number | null;
  ocrText: string | null;
};

// PYQs are grouped by year (newest first) so "which year is this from" is
// answered by the section heading, not buried in each row's fine print —
// papers with no year on file (an unset default during bulk upload) get
// their own "Year not set" group at the end instead of silently mixing in.
function PyqsByYear({
  resources,
}: {
  resources: PyqResource[];
}) {
  if (resources.length === 0) {
    return <p className="mt-3 text-sm text-muted">No PYQs uploaded yet.</p>;
  }

  const groups = new Map<string, typeof resources>();
  for (const r of resources) {
    const key = r.academicYear ?? (r.year ? String(r.year) : "Year not set");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const sortedYears = Array.from(groups.keys()).sort((a, b) => {
    if (a === "Year not set") return 1;
    if (b === "Year not set") return -1;
    return Number(b.slice(0, 4)) - Number(a.slice(0, 4));
  });

  return (
    <div className="mt-4 flex flex-col gap-6">
      {sortedYears.map((year) => (
        <div key={year}>
          <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            {year}
            <span className="rounded-full bg-surface-muted px-2 py-0.5 font-normal normal-case text-muted">
              {groups.get(year)!.length} paper{groups.get(year)!.length === 1 ? "" : "s"}
            </span>
          </p>
          <PyqResourceList resources={groups.get(year)!} />
        </div>
      ))}
    </div>
  );
}

function PyqResourceList({ resources }: { resources: PyqResource[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {resources.map((resource) => (
        <li
          key={resource.id}
          id={`paper-${resource.id}`}
          className="overflow-hidden rounded-2xl border border-border bg-surface transition-colors hover:border-accent/40"
        >
          <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{resource.title}</p>
              <p className="mt-1 text-xs text-muted">
                {resource.pageCount ? `${resource.pageCount} pages · ` : ""}
                {formatBytes(resource.fileSize)}
                {resource.ocrText ? " · Full text available" : ""}
              </p>
            </div>
            <a
              href={`/api/download/${resource.id}`}
              download
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-foreground transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <DownloadSimple size={16} weight="bold" />
              <span className="hidden sm:inline">Download PDF</span>
              <span className="sm:hidden">PDF</span>
            </a>
          </div>

          {resource.ocrText && (
            <details open className="group border-t border-border">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-accent transition hover:bg-accent-soft/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:px-5">
                <span className="flex items-center gap-2">
                  <BookOpenText size={18} weight="bold" />
                  Read complete question paper
                </span>
                <CaretDown
                  size={16}
                  weight="bold"
                  className="transition-transform duration-200 group-open:rotate-180"
                />
              </summary>
              <article className="max-h-[78vh] overflow-y-auto border-t border-[#e7e0d1] bg-[#fffdf7] px-5 py-6 dark:border-border dark:bg-surface sm:px-8">
                <OcrPaperRenderer text={resource.ocrText} />
              </article>
            </details>
          )}
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
