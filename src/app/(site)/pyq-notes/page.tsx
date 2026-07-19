import Link from "next/link";
import { ArrowRight, BookOpenText, Exam, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { getPyqArchiveIndex } from "@/lib/data";

type ArchivePaper = Awaited<ReturnType<typeof getPyqArchiveIndex>>[number];

export default async function PyqNotesArchivePage() {
  const papers = await getPyqArchiveIndex();
  const programs = new Map<string, { name: string; slug: string; papers: ArchivePaper[] }>();
  for (const paper of papers) {
    const key = paper.subject.term.program.slug;
    const existing = programs.get(key);
    if (existing) existing.papers.push(paper);
    else programs.set(key, { name: paper.subject.term.program.name, slug: key, papers: [paper] });
  }

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
          The supplied OCR is preserved in full. Choose a course below, then open any paper to read
          its complete text in a clean document view—no download required.
        </p>
      </div>

      <div className="mt-10 flex flex-wrap gap-3 text-sm text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
          {papers.length} complete papers
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">Six DU science courses</span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">2017–18 through 2024–25</span>
      </div>

      {papers.length === 0 ? (
        <div className="mt-12 rounded-3xl border border-dashed border-border bg-surface-muted p-8 text-sm text-muted">
          The OCR archive is being prepared. Please check back soon.
        </div>
      ) : (
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {[...programs.values()].map((program) => {
            const semesters = new Set(program.papers.map((paper) => paper.subject.term.order));
            return (
              <section key={program.slug} className="overflow-hidden rounded-3xl border border-border bg-surface">
                <div className="border-b border-border bg-surface-muted/60 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                        <GraduationCap size={16} weight="bold" /> Course archive
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold tracking-tight">{program.name}</h2>
                    </div>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                      <Exam size={20} weight="bold" />
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {program.papers.length} papers across {semesters.size} semester{semesters.size === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {program.papers.map((paper) => (
                    <Link
                      key={paper.id}
                      href={`/pyq-notes/${paper.id}`}
                      className="group flex items-center justify-between gap-4 px-6 py-4 transition hover:bg-accent-soft/40"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-foreground group-hover:text-accent">
                          {paper.subject.name} · {paper.subject.term.name} · {paper.academicYear ?? paper.year}
                        </span>
                        <span className="mt-1 block text-xs text-muted">
                          {paper.pageCount ? `${paper.pageCount} pages · ` : ""}
                          {paper.title}
                        </span>
                      </span>
                      <ArrowRight size={18} weight="bold" className="shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
