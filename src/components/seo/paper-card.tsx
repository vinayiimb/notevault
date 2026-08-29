import { ArrowSquareOut, DownloadSimple, FileText } from "@phosphor-icons/react/dist/ssr";
import Link from "next/link";
import type { SeoPaper } from "@/lib/du-pyp-seo";

/**
 * One question-paper row. Links to the internal `/paper/[slug]` page (crawlable)
 * and offers direct View / Download of the external PDF. There is deliberately
 * no separate indexable URL for View vs Download — both point at the same file.
 */
export function PaperCard({ paper, showSubject = false }: { paper: SeoPaper; showSubject?: boolean }) {
  const when = [paper.session, paper.year].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col rounded-xl border border-border bg-surface p-4 transition-colors hover:border-accent/50">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/paper/${paper.slug}`}
            className="block font-semibold text-foreground hover:text-accent"
          >
            {showSubject ? paper.subjectName : when || "Question Paper"}
          </Link>
          <p className="mt-0.5 truncate text-sm text-muted">
            {showSubject ? when : paper.programmeName}
            {paper.set ? ` · ${paper.set}` : ""}
            {paper.college ? ` · ${paper.college}` : ""}
          </p>
        </div>
        {paper.paperCode && (
          <Link
            href={`/paper-code/${paper.paperCode}`}
            className="shrink-0 rounded bg-background px-2 py-1 text-xs font-medium text-muted hover:text-accent"
          >
            {paper.paperCode}
          </Link>
        )}
      </div>
      <div className="mt-auto flex flex-wrap gap-2 text-sm">
        <Link
          href={`/paper/${paper.slug}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 font-medium text-foreground hover:bg-accent/10"
        >
          <FileText size={15} weight="bold" /> Details
        </Link>
        <a
          href={paper.fileUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 font-medium text-foreground hover:bg-accent/10"
        >
          <ArrowSquareOut size={15} weight="bold" /> View PDF
        </a>
        <a
          href={paper.fileUrl}
          download
          rel="nofollow"
          className="inline-flex items-center gap-1.5 rounded-lg bg-background px-3 py-1.5 font-medium text-foreground hover:bg-accent/10"
        >
          <DownloadSimple size={15} weight="bold" /> Download
        </a>
      </div>
    </div>
  );
}
