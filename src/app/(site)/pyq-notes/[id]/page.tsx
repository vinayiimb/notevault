import Link from "next/link";
import { ArrowLeft, DownloadSimple } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { getPyqResourceById } from "@/lib/data";
import { formatBytes } from "@/lib/utils";
import { PyqReadingTabs } from "@/components/pyq/pyq-reading-tabs";
import { BookmarkButton } from "@/components/pyq/bookmark-button";
import { ShareButton } from "@/components/pyq/share-button";
import { ReportOcrErrorButton } from "@/components/pyq/report-ocr-error-button";

export default async function PyqPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = await getPyqResourceById(id);
  if (!paper || !paper.ocrText) notFound();

  const subject = paper.subject;
  const pyqCount = subject.resources.length;
  const initialAnalysis = subject.analysis
    ? {
        compiledNotes: subject.analysis.compiledNotes,
        mostRepeated: JSON.parse(subject.analysis.mostRepeatedJson),
        predictedPaper: JSON.parse(subject.analysis.predictedPaperJson),
      }
    : null;

  return (
    <div className="min-h-screen bg-sky-soft/35 px-4 py-10 sm:px-6 sm:py-14">
      <div className="mx-auto max-w-6xl">
        <Link href="/pyq-notes" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground">
          <ArrowLeft size={16} weight="bold" /> Back to complete archive
        </Link>

        <header className="mt-8 border-b border-sky/25 pb-8">
          <p className="text-sm text-muted">
            <Link href={`/programs/${subject.term.program.slug}`} className="hover:text-foreground">{subject.term.program.name}</Link>
            {" · "}
            <Link href={`/terms/${subject.term.id}`} className="hover:text-foreground">{subject.term.name}</Link>
            {" · "}
            <Link href={`/subjects/${subject.id}`} className="hover:text-foreground">{subject.name}</Link>
          </p>
          <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{paper.title}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
            <span>{paper.academicYear ?? paper.year ?? "Academic year not set"}</span>
            {paper.session && <span>{paper.session}</span>}
            {paper.pageCount && <span>{paper.pageCount} pages</span>}
            <span>{formatBytes(paper.fileSize)}</span>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2">
            <a
              href={`/api/download/${paper.id}`}
              download
              className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <DownloadSimple size={17} weight="bold" /> Download PDF
            </a>
            <BookmarkButton paperId={paper.id} />
            <ShareButton title={paper.title} />
            <ReportOcrErrorButton paperId={paper.id} paperTitle={paper.title} />
          </div>
        </header>

        <div className="mt-8 overflow-hidden rounded-3xl border border-sky/25 bg-surface shadow-[0_20px_60px_rgba(66,195,243,.10)] dark:border-border">
          <PyqReadingTabs
            paper={{ id: paper.id, fileUrl: `/api/download/${paper.id}` }}
            metadata={{
              course: `${subject.term.program.name} · ${subject.term.name}`,
              semester: null,
              subject: subject.name,
              paperCode: paper.paperCode,
              year: paper.year,
              session: paper.session,
              maximumMarks: paper.maximumMarks,
              duration: paper.duration,
            }}
            ocrText={paper.ocrText}
            questions={paper.questions}
            subjectId={subject.id}
            pyqCount={pyqCount}
            initialAnalysis={initialAnalysis}
            generatedAt={subject.analysis?.generatedAt.toLocaleString() ?? null}
          />
        </div>
      </div>
    </div>
  );
}
