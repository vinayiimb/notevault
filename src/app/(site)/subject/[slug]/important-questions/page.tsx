import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { RelatedLinks } from "@/components/seo/related-links";
import { generateSubjectMetadata } from "@/lib/seo";
import { Metadata } from "next";
import { Target, TrendingUp, AlertCircle } from "lucide-react";

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

  return generateSubjectMetadata(subject.name, subject.term.program.name, subject.term.order.toString(), 'questions');
}

export default async function SubjectImportantQuestionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const subject = await prisma.subject.findFirst({
    where: { slug },
    select: { id: true, name: true },
  });

  if (!subject) notFound();

  // Fetch repeated questions, sorted by how often they appeared
  const questions = await prisma.question.findMany({
    where: { 
      subjectId: subject.id,
      isRepeated: true
    },
    orderBy: { repeatCount: 'desc' },
    take: 50 // Limit to top 50 to avoid massive pages
  });

  return (
    <div>
      <section>
        <div className="mb-8">
          <h2 className="flex items-center gap-2.5 font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">
            <TrendingUp className="size-6 shrink-0 text-rose-500" />
            Most repeated questions
          </h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted sm:text-[17px]">
            These questions have appeared multiple times in past DU examinations for {subject.name}. Focusing on these topics will give you the highest return on your study time.
          </p>
        </div>

        {questions.length === 0 ? (
          <div className="rounded-[22px] bg-surface-muted px-6 py-16 text-center">
            <Target className="mx-auto mb-4 size-10 text-muted/60" />
            <h3 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">Analysis pending</h3>
            <p className="mx-auto mt-2 max-w-md text-[15px] text-muted">
              We are still analyzing the previous year papers for this subject to determine the most frequently asked questions. Check back before exams.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-[18px] bg-amber-500/10 p-4">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <p className="text-[14px] leading-relaxed text-amber-800 dark:text-amber-300">
                <strong>Disclaimer:</strong> This is a statistical analysis of past papers (10 Years), not a prediction. Delhi University can change paper patterns at any time. Do not rely solely on these questions.
              </p>
            </div>

            <div className="space-y-3">
              {questions.map((q, i) => (
                <div key={q.id} className="rounded-[22px] bg-surface-muted p-5 md:p-6">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                    <div className="flex-1">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="flex size-6 items-center justify-center rounded-full bg-surface text-[12px] font-semibold text-muted">
                          {i + 1}
                        </span>
                        {q.topics.map((topic) => (
                          <span key={topic} className="rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[12px] font-semibold text-rose-600 dark:text-rose-400">
                            {topic}
                          </span>
                        ))}
                      </div>
                      <h3 className="whitespace-pre-wrap text-[17px] font-medium leading-relaxed tracking-[-0.01em] text-foreground">
                        {q.questionText}
                      </h3>
                    </div>

                    <div className="flex shrink-0 flex-row items-center justify-between gap-2 rounded-[16px] bg-surface p-3 md:w-32 md:flex-col md:items-end md:justify-start md:bg-transparent md:p-0">
                      <div className="text-center md:text-right">
                        <div className="text-[28px] font-semibold leading-none tracking-[-0.03em] text-rose-600 dark:text-rose-400">{q.repeatCount}x</div>
                        <div className="mt-1 text-[11px] font-semibold uppercase tracking-wider text-muted">Repeated</div>
                      </div>

                      {q.years && (
                        <div className="text-[13px] font-medium text-muted md:mt-2 md:text-right">
                          <span className="mb-0.5 block text-[12px] font-semibold md:hidden">Years asked</span>
                          {q.years.split(',').join(', ')}
                        </div>
                      )}
                    </div>
                  </div>

                  {q.answerText && q.answerText.length > 0 && (
                    <div className="mt-4 border-t border-border/70 pt-4">
                      <details className="group">
                        <summary className="cursor-pointer select-none text-[14px] font-semibold text-brand">
                          <span className="group-open:hidden">View solution</span>
                          <span className="hidden group-open:inline">Hide solution</span>
                        </summary>
                        <div className="mt-3 max-w-none rounded-[16px] bg-surface p-4 text-[15px] leading-relaxed text-muted">
                          {q.answerText}
                        </div>
                      </details>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      <RelatedLinks
        links={[
          { title: `${subject.name} Complete PYQs`, url: `/subject/${slug}/pyq`, type: 'pyq' },
          { title: `${subject.name} Study Notes`, url: `/subject/${slug}/notes`, type: 'notes' }
        ]}
      />
    </div>
  );
}
