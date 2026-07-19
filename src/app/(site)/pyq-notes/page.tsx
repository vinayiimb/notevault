import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { ArchiveBrowser } from "@/components/archive/archive-browser";
import { getPyqArchiveIndex } from "@/lib/data";

export default async function PyqNotesArchivePage() {
  const papers = await getPyqArchiveIndex();
  const courseCount = new Set(papers.map((paper) => paper.subject.term.program.slug)).size;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <BookOpenText size={18} weight="bold" /> Complete OCR library
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Read every question paper on the site.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Choose a course, semester, and year to narrow the library instantly. Select any subject
          in the table to read the complete OCR in a clean document view—no download required.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-sm text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
          {papers.length} complete papers
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {courseCount} course{courseCount === 1 ? "" : "s"}
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">2017–18 through 2024–25</span>
      </div>

      {papers.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border bg-surface-muted p-8 text-sm text-muted">
          The OCR archive is being prepared. Please check back soon.
        </div>
      ) : (
        <ArchiveBrowser papers={papers} />
      )}
    </div>
  );
}
