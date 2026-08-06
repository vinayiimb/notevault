import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTermById } from "@/lib/data";
import { levelLabel } from "@/lib/utils";
import { categorizeSubject } from "@/lib/subject-category";
import { TermSubjectTabs } from "@/components/subjects/term-subject-tabs";
import { TermPapersDisplay } from "@/components/subjects/term-papers-display";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;
// Was fully dynamic (a fresh Postgres round trip on every visit). ISR-caching
// per term id for 24 hours shares that query across every visitor in the
// window; term/subject-mutating admin actions already call
// revalidatePath(`/terms/${termId}`) so edits show up immediately. See
// docs/PHASE_2_QUERY_REMEDIATION.md.
export const revalidate = 86400;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) return {};

  const title = `${term.program.name} ${term.name} – PYQs & Notes`;
  const description = `Question papers and notes for ${term.program.name} ${term.name}, organized by subject on DU PYQ Online.`;

  return {
    title,
    description,
    alternates: { canonical: `/terms/${term.id}` },
    openGraph: { title, description },
  };
}

export default async function TermPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const term = await getTermById(id);
  if (!term) notFound();

  const subjects = term.subjects.map((subject) => ({
    id: subject.id,
    name: subject.name,
    description: subject.description,
    resourceCount: subject.resourceCount,
    repeatedCount: subject.repeatedCount,
    category: categorizeSubject(subject.name),
  }));

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: term.program.name, url: `/programs/${term.program.slug}` },
    { name: term.name, url: `/terms/${term.id}` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />
      <p className="text-sm text-muted">
        {levelLabel(term.program.level)} ·{" "}
        <Link href={`/programs/${term.program.slug}`} className="hover:text-foreground">
          {term.program.name}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{term.name}</h1>

      <TermPapersDisplay papers={term.termPapers} />

      {subjects.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No subjects added yet.</p>
      ) : (
        <div className="mt-8">
          <TermSubjectTabs subjects={subjects} />
        </div>
      )}
    </div>
  );
}
