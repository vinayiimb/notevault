import { ReactNode } from "react";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SubjectTabs } from "@/components/subjects/subject-tabs";

export default async function SubjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  
  // Explicit select, not `include`: the live database is missing a column
  // (Subject.parentSubjectId) that's in schema.prisma but was never
  // migrated in, which makes any query implicitly selecting the full
  // Subject model fail (P2022) — same issue documented in
  // subject/[slug]/page.tsx and practice-questions/_route-impl.ts.
  const subject = await prisma.subject.findFirst({
    where: { slug },
    select: {
      name: true,
      upc: true,
      term: {
        select: { order: true, program: { select: { name: true } } },
      },
    },
  });

  if (!subject) notFound();

  return (
    <div className="pb-6">
      <div className="mx-auto max-w-5xl px-4 pt-6 sm:px-6 sm:pt-10">
        <div className="rounded-[28px] bg-surface-muted px-5 py-7 sm:rounded-[32px] sm:px-10 sm:py-12">
          <span className="inline-block max-w-full rounded-2xl bg-accent-soft px-3 py-1 text-[12px] font-semibold leading-snug text-accent">
            {subject.term.program.name} · Semester {subject.term.order}
          </span>
          <h1 className="mt-3 text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground sm:text-5xl">
            {subject.name}
          </h1>
          {subject.upc && <p className="mt-2 text-[15px] text-muted">UPC {subject.upc}</p>}
          <SubjectTabs slug={slug} />
        </div>
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">{children}</main>
    </div>
  );
}
