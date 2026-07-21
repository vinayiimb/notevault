import { FileArchive, Download, Calendar } from "@phosphor-icons/react/dist/ssr";

type TermPaper = {
  id: string;
  academicYear: string | null;
  year: number | null;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
};

export function TermPapersDisplay({ papers }: { papers: TermPaper[] }) {
  if (papers.length === 0) return null;

  const validPapers = papers.filter((p) => p.fileUrl && p.fileUrl.trim());

  if (validPapers.length === 0) return null;

  return (
    <div className="mt-8">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            <FileArchive size={20} weight="bold" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-foreground">Term Papers</h2>
            <p className="mt-1 text-sm text-muted">
              Complete year papers covering all subjects in this semester
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3">
        {validPapers.map((paper) => (
          <a
            key={paper.id}
            href={paper.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-gradient-to-r from-surface via-surface to-surface-muted/20 p-4 transition-all hover:border-accent hover:shadow-lg hover:shadow-accent/10 hover:from-accent-soft hover:via-surface hover:to-surface-muted/40"
          >
            {/* Background accent */}
            <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-transparent to-accent/0 opacity-0 transition-opacity group-hover:opacity-10" />

            {/* Icon */}
            <div className="relative shrink-0">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-600/20 text-blue-600 transition-all group-hover:from-blue-500/30 group-hover:to-purple-600/30">
                <FileArchive size={24} weight="bold" />
              </div>
            </div>

            {/* Content */}
            <div className="relative flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-foreground truncate group-hover:text-accent transition-colors">
                  {paper.academicYear ?? paper.year ?? "Undated"}
                </h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-accent-soft text-xs font-medium text-accent-foreground">
                  <Calendar size={12} weight="bold" />
                  {new Date(paper.fileName).getFullYear() ?? ""}
                </span>
              </div>
              <p className="mt-1 text-xs text-muted truncate group-hover:text-muted/80 transition-colors">
                {paper.fileName}
              </p>
            </div>

            {/* Action */}
            <div className="relative shrink-0 flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent transition-all group-hover:bg-accent/20">
                <Download size={18} weight="bold" />
              </div>
              <span className="hidden sm:inline text-sm font-medium text-muted group-hover:text-accent transition-colors">
                Download
              </span>
            </div>
          </a>
        ))}
      </div>

      {papers.length > validPapers.length && (
        <div className="mt-4 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-700">
          <p className="font-medium">Note:</p>
          <p className="mt-1">
            {papers.length - validPapers.length} paper{papers.length - validPapers.length === 1 ? "" : "s"} {papers.length - validPapers.length === 1 ? "is" : "are"} being processed.
            Check back soon for them to be available.
          </p>
        </div>
      )}
    </div>
  );
}
