import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import Link from "next/link";
import { ArrowRight, FileText, PenTool, Target } from "lucide-react";
import { generateSubjectMetadata } from "@/lib/seo";
import { NotesPrompt } from "@/components/notes-leads/notes-prompt";
import { Metadata } from "next";

// Both queries below use an explicit `select` rather than `findFirst`/
// `include` with no field list: the live database is missing a column
// (Subject.parentSubjectId) that's in schema.prisma but was never migrated
// in, which makes any query that implicitly selects the full Subject model
// fail (P2022). Selecting only the fields this page actually uses sidesteps
// it — same underlying issue documented in practice-questions/_route-impl.ts
// and scripts/import-questions-csv.ts.
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

  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'home');
}

export default async function SubjectOverviewPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const subject = await prisma.subject.findFirst({
    where: { slug },
    select: {
      name: true,
      description: true,
      term: { select: { order: true, program: { select: { name: true } } } },
      _count: {
        select: {
          resources: true,
          questions: true,
        }
      }
    }
  });

  if (!subject) notFound();

  // In a real app we'd filter resources by type (PYQ vs Notes) directly,
  // but for the skeleton overview we just show the total resources count.
  const resourceCount = subject._count.resources;
  const questionCount = subject._count.questions;

  const quickLinks = [
    {
      title: "Previous Year Papers",
      desc: "Download full PDF papers from the last 10 years",
      icon: FileText,
      href: `/subject/${slug}/pyq`,
      count: resourceCount > 0 ? `${resourceCount} ${resourceCount === 1 ? "Paper" : "Papers"}` : "Coming Soon",
      tint: "bg-accent-soft text-accent",
    },
    {
      title: "Study Notes",
      desc: "Complete unit-wise summaries and revision notes",
      icon: PenTool,
      href: `/subject/${slug}/notes`,
      count: "Notes",
      tint: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    },
    {
      title: "Important Questions",
      desc: "Most repeated questions in recent DU exams",
      icon: Target,
      href: `/subject/${slug}/important-questions`,
      count: questionCount > 0 ? `${questionCount} ${questionCount === 1 ? "Question" : "Questions"}` : "Coming Soon",
      tint: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    },
  ];

  return (
    <div>
      <NotesPrompt
        source="pyq-page"
        course={{ name: subject.term.program.name.replace(" — University of Delhi", "") }}
        subject={subject.name}
        semester={subject.term.order}
      />
      <section>
        <h2 className="font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">
          Prepare for {subject.name}
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          {quickLinks.map((link) => (
            <Link
              key={link.title}
              href={link.href}
              className="group flex h-full flex-col rounded-[28px] bg-surface p-6 shadow-[var(--shadow-tile)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-apple)] hover:shadow-[var(--shadow-tile-hover)] motion-safe:hover:-translate-y-1 sm:p-7"
            >
              <span className={`flex size-11 items-center justify-center rounded-[14px] ${link.tint}`}>
                <link.icon className="size-5" />
              </span>
              <h3 className="mt-5 text-[19px] font-semibold tracking-[-0.02em] text-foreground">{link.title}</h3>
              <p className="mt-1.5 text-[15px] leading-snug text-muted">{link.desc}</p>
              <div className="mt-auto flex items-center justify-between pt-5">
                <span className="text-[14px] font-medium text-foreground">{link.count}</span>
                <ArrowRight className="size-4 text-brand transition-transform duration-300 group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {subject.description && (
        <section className="mt-10 rounded-[22px] bg-surface-muted p-6 sm:p-8">
          <h2 className="text-[20px] font-semibold tracking-[-0.02em] text-foreground">About this subject</h2>
          <div className="mt-3 max-w-none text-[16px] leading-relaxed text-muted">{subject.description}</div>
        </section>
      )}

      {/* Placeholder Related Links - In real usage, this would fetch sibling subjects from Prisma */}
      <RelatedLinks
        links={[
          { title: "Financial Accounting", url: "/subject/financial-accounting" },
          { title: "Business Laws", url: "/subject/business-laws" },
          { title: "B.Com Hons Semester 1 Syllabus", url: "/course/bcom-hons/semester-1" }
        ]}
      />
    </div>
  );
}
