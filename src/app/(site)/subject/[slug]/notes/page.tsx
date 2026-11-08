import { slugify } from "@/lib/utils";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";
import { PenTool, Download, Eye, BookOpen, ArrowRight } from "lucide-react";

// Explicit select, not `include`/bare findFirst: the live database is
// missing a column (Subject.parentSubjectId) that's in schema.prisma but
// was never migrated in, which makes any query implicitly selecting the
// full Subject model fail (P2022) — same issue documented in
// subject/[slug]/layout.tsx and practice-questions/_route-impl.ts. The
// `notes` relation was previously included but never actually read below,
// so it's dropped rather than reselected narrowly.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const subject = await prisma.subject.findFirst({
    where: { slug },
    select: {
      name: true,
      term: { select: { order: true, program: { select: { name: true } } } },
    },
  });
  if (!subject) return { title: 'Not Found' };

  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'notes');
}

export default async function SubjectNotesPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const subject = await prisma.subject.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      term: { select: { program: { select: { name: true } } } },
    },
  });

  if (!subject) notFound();

  // Fetch PDF Notes from Resources
  const pdfNotes = await prisma.resource.findMany({
    where: { 
      subjectId: subject.id,
      type: "NOTES"
    },
    orderBy: { createdAt: 'desc' }
  });

  const programmeSlug = slugify(subject.term.program.name);
  const canonicalNote = await getCanonicalNote(programmeSlug, subject.slug);
  const hasStructuredNotes = !!canonicalNote?.content?.trim();
  const totalNotes = pdfNotes.length + (hasStructuredNotes ? 1 : 0);

  return (
    <div>
      <section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">Study notes &amp; material</h2>
            <p className="mt-1.5 text-[15px] text-muted sm:text-[17px]">Complete unit-wise summaries for {subject.name}</p>
          </div>
          <div className="rounded-full bg-violet-500/10 px-4 py-2 text-[14px] font-semibold text-violet-600 dark:text-violet-400">
            {totalNotes} {totalNotes === 1 ? "Resource" : "Resources"}
          </div>
        </div>

        {totalNotes === 0 ? (
          <div className="rounded-[22px] bg-surface-muted px-6 py-16 text-center">
            <PenTool className="mx-auto mb-4 size-10 text-muted/60" />
            <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">No notes available yet</h3>
            <p className="mt-1 text-[15px] text-muted">We are currently gathering study material for this subject.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {/* Structured/Markdown Compiled Notes (if they exist) */}
            {hasStructuredNotes && (
              <div className="flex flex-col rounded-[28px] bg-surface p-6 shadow-[var(--shadow-tile)] md:col-span-2 sm:p-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-violet-500/10 text-violet-600 dark:text-violet-400">
                      <BookOpen className="size-5" />
                    </span>
                    <div>
                      <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">Official compiled notes</h3>
                      <p className="mt-0.5 text-[15px] text-muted">Comprehensive unit-wise revision notes</p>
                    </div>
                  </div>
                  <span className="hidden shrink-0 rounded-full bg-violet-500/10 px-3 py-1 text-[12px] font-semibold text-violet-600 dark:text-violet-400 sm:inline">
                    Recommended
                  </span>
                </div>

                <div className="mt-5 flex justify-end">
                  <Link
                    href={`/notes/${programmeSlug}/${subject.slug}`}
                    className="inline-flex items-center gap-2 rounded-full bg-brand px-6 py-2.5 text-[15px] font-semibold text-brand-foreground transition-colors duration-300 hover:bg-brand-hover"
                  >
                    Read notes <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>
            )}

            {/* PDF Notes */}
            {pdfNotes.map((note) => (
              <div key={note.id} className="rounded-[22px] bg-surface-muted p-5 flex flex-col transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{note.title}</h3>
                    {note.year && <p className="mt-1 text-[14px] text-muted">Year: {note.year}</p>}
                  </div>
                  <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-muted">PDF</span>
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Link href={`/pyq-notes/${note.id}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-[14px] font-semibold text-brand-foreground transition-colors duration-300 hover:bg-brand-hover">
                    <Eye className="size-4" /> View
                  </Link>
                  <a href={`/api/download/${note.id}`} aria-label="Download" className="inline-flex items-center justify-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[14px] font-semibold text-foreground ring-1 ring-border transition-colors duration-300 hover:bg-background">
                    <Download className="size-4" />
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <RelatedLinks
        links={[
          { title: `${subject.name} PYQs`, url: `/subject/${slug}/pyq`, type: 'pyq' },
          { title: `${subject.name} Important Questions`, url: `/subject/${slug}/important-questions`, type: 'important' }
        ]}
      />
    </div>
  );
}
