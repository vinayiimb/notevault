import Link from "next/link";
import { ArrowLeft, DownloadSimple, FileText } from "@phosphor-icons/react/dist/ssr";
import { notFound } from "next/navigation";
import { getPyqResourceById } from "@/lib/data";
import { formatBytes } from "@/lib/utils";

function OcrDocument({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  return (
    <div className="ocr-document font-sans text-[0.98rem] leading-7 text-foreground">
      {lines.map((line, index) =>
        line.trim() ? (
          <p key={`${index}-${line.slice(0, 12)}`} className="min-h-7 text-pretty">
            {line}
          </p>
        ) : (
          <div key={`${index}-blank`} className="h-3" aria-hidden="true" />
        ),
      )}
    </div>
  );
}

export default async function PyqPaperPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const paper = await getPyqResourceById(id);
  if (!paper || !paper.ocrText) notFound();

  const subject = paper.subject;
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/pyq-notes" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-foreground">
        <ArrowLeft size={16} weight="bold" /> Back to complete archive
      </Link>

      <header className="mt-8 border-b border-border pb-8">
        <p className="text-sm text-muted">
          {subject.term.program.name} · {subject.term.name} · {subject.name}
        </p>
        <h1 className="mt-2 max-w-3xl text-3xl font-semibold tracking-tight sm:text-4xl">{paper.title}</h1>
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted">
          <span>{paper.academicYear ?? paper.year ?? "Academic year not set"}</span>
          {paper.pageCount && <span>{paper.pageCount} pages</span>}
          <span>{formatBytes(paper.fileSize)}</span>
          <span className="inline-flex items-center gap-1.5 text-accent"><FileText size={16} weight="bold" /> Complete OCR text</span>
        </div>
        <a
          href={`/api/download/${paper.id}`}
          download
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <DownloadSimple size={17} weight="bold" /> Download PDF
        </a>
      </header>

      <article className="mt-8 rounded-3xl border border-border bg-surface px-5 py-7 shadow-[0_15px_45px_rgba(15,23,42,.06)] sm:px-10 sm:py-10">
        <div className="mb-7 border-b border-border pb-5 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
          Original extracted question paper
        </div>
        <OcrDocument text={paper.ocrText} />
      </article>
    </div>
  );
}
