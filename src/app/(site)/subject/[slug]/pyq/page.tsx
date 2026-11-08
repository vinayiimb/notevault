import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import { NotesPrompt } from "@/components/notes-leads/notes-prompt";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";
import Link from "next/link";
import { FileText, Download, Eye } from "lucide-react";

// Explicit select, not `include`/bare findFirst: the live database is
// missing a column (Subject.parentSubjectId) that's in schema.prisma but
// was never migrated in, which makes any query implicitly selecting the
// full Subject model fail (P2022) — same issue documented in
// subject/[slug]/layout.tsx and practice-questions/_route-impl.ts.
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

  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'pyq');
}

export default async function SubjectPYQPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const subject = await prisma.subject.findFirst({
    where: { slug },
    select: {
      id: true,
      name: true,
      term: { select: { order: true, program: { select: { name: true } } } },
    },
  });

  if (!subject) notFound();

  // Fetch actual PYQs from the database
  const pyqs = await prisma.resource.findMany({
    where: { 
      subjectId: subject.id,
      type: "PYQ"
    },
    orderBy: { year: 'desc' }
  });

  return (
    <div>
      <NotesPrompt
        source="pyq-page"
        course={{ name: subject.term.program.name.replace(" — University of Delhi", "") }}
        subject={subject.name}
        semester={subject.term.order}
      />
      <section>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">Previous year question papers</h2>
            <p className="mt-1.5 text-[15px] text-muted sm:text-[17px]">Download original PDF question papers for {subject.name}</p>
          </div>
          <div className="rounded-full bg-accent-soft px-4 py-2 text-[14px] font-semibold text-accent">
            {pyqs.length} {pyqs.length === 1 ? "Paper" : "Papers"}
          </div>
        </div>

        {pyqs.length === 0 ? (
          <div className="rounded-[22px] bg-surface-muted px-6 py-16 text-center">
            <FileText className="mx-auto mb-4 size-10 text-muted/60" />
            <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">No PYQs available yet</h3>
            <p className="mt-1 text-[15px] text-muted">Check back later for updated question papers.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pyqs.map((pyq) => (
              <div key={pyq.id} className="rounded-[22px] bg-surface-muted p-5 flex flex-col transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{pyq.year || pyq.academicYear || "Question Paper"}</h3>
                    <p className="mt-1 line-clamp-1 text-[14px] text-muted">{pyq.title}</p>
                  </div>
                  {pyq.session && (
                    <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 text-[12px] font-medium text-muted">
                      {pyq.session}
                    </span>
                  )}
                </div>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Link href={`/pyq-notes/${pyq.id}`} className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand py-2.5 text-[14px] font-semibold text-brand-foreground transition-colors duration-300 hover:bg-brand-hover">
                    <Eye className="size-4" /> View
                  </Link>
                  <a href={`/api/download/${pyq.id}`} aria-label="Download" className="inline-flex items-center justify-center gap-2 rounded-full bg-surface px-4 py-2.5 text-[14px] font-semibold text-foreground ring-1 ring-border transition-colors duration-300 hover:bg-background">
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
          { title: `${subject.name} Study Notes`, url: `/subject/${slug}/notes`, type: 'notes' },
          { title: `${subject.name} Important Questions`, url: `/subject/${slug}/important-questions`, type: 'important' }
        ]}
      />
    </div>
  );
}
