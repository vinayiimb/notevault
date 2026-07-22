import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { ArchiveBrowser } from "@/components/archive/archive-browser";
import { DriveArchiveBrowser, type DriveArchiveFileData } from "@/components/archive/drive-archive-browser";
import { getFullDriveArchiveIndex, getPyqArchiveIndex } from "@/lib/data";

export default async function PyqNotesArchivePage() {
  const [papers, driveFilesRaw] = await Promise.all([getPyqArchiveIndex(), getFullDriveArchiveIndex()]);
  // driveSubjectId is filtered to non-null in the query, but the relation
  // type itself stays nullable — narrow it here so the browser component
  // can assume every file has its subject.
  const driveFiles = driveFilesRaw.filter(
    (file): file is typeof file & { driveSubject: NonNullable<typeof file.driveSubject> } =>
      file.driveSubject !== null,
  ) satisfies DriveArchiveFileData[];

  const courseCount = new Set(papers.map((paper) => paper.subject.term.program.slug)).size;
  const driveCourseCount = new Set(driveFiles.map((file) => file.driveSubject.program.slug)).size;
  const totalPapers = papers.length + driveFiles.length;

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <BookOpenText size={18} weight="bold" /> Full archive
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Every question paper on the site.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Choose a course and subject to narrow the archive instantly, then open the paper — either
          read the complete OCR inline, or open the original PDF on Google Drive.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-sm text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
          {totalPapers} papers total
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {courseCount + driveCourseCount} course{courseCount + driveCourseCount === 1 ? "" : "s"}
        </span>
      </div>

      {papers.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">Read online ({papers.length})</h2>
          <p className="mt-1 text-sm text-muted">Uploaded PDFs with a full-text OCR — read in the browser, no download needed.</p>
          <ArchiveBrowser papers={papers} />
        </section>
      )}

      <section className={papers.length > 0 ? "mt-14" : "mt-12"}>
        {papers.length > 0 && <h2 className="text-lg font-semibold">Open on Google Drive ({driveFiles.length})</h2>}
        {driveFiles.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-border bg-surface-muted p-8 text-sm text-muted">
            The archive is being prepared. Please check back soon.
          </div>
        ) : (
          <DriveArchiveBrowser files={driveFiles} />
        )}
      </section>
    </div>
  );
}
