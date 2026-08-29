import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowSquareOut, DownloadSimple, FileText } from "@phosphor-icons/react/dist/ssr";
import {
  getSeoPaper,
  getSeoSubject,
  getIndexablePaperUrls,
  isPaperSlugIndexable,
} from "@/lib/du-pyp-seo";
import { individualPaperMetadata } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { PaperCard } from "@/components/seo/paper-card";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const urls = await getIndexablePaperUrls();
  // 20k+ paper pages is too many to pre-render; build the first 300 and let
  // the rest be ISR-on-demand (cached after first request).
  return urls.slice(0, 300).map((u) => ({ slug: u.path.split("/").pop()! }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const paper = await getSeoPaper(slug);
  if (!paper) return { title: "Paper not found", robots: { index: false, follow: false } };
  const meta = individualPaperMetadata({
    subjectName: paper.subjectName,
    programmeName: paper.programmeName,
    year: paper.year,
    session: paper.session,
    slug: paper.slug,
  });
  if (!(await isPaperSlugIndexable(slug))) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function IndividualPaperPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paper = await getSeoPaper(slug);
  if (!paper) notFound();

  const subjectCtx = await getSeoSubject(paper.programmeSlug, paper.subjectSlug);
  const otherYears = (subjectCtx?.subject.papers ?? []).filter((p) => p.slug !== paper.slug);

  const when = [paper.session, paper.year].filter(Boolean).join(" ");
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: paper.programmeName, url: `/papers/${paper.programmeSlug}` },
    { name: paper.subjectName, url: `/papers/${paper.programmeSlug}/${paper.subjectSlug}` },
    { name: paper.year || "Paper", url: `/paper/${paper.slug}` },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <header className="mb-6">
        <div className="mb-2 flex items-center gap-2 text-accent">
          <FileText size={20} weight="bold" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            <Link href={`/papers/${paper.programmeSlug}/${paper.subjectSlug}`} className="hover:underline">
              {paper.subjectName}
            </Link>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {paper.subjectName} Question Paper{paper.year ? ` ${paper.year}` : ""}
        </h1>
        <p className="mt-2 text-muted">
          Delhi University · {paper.programmeName}
          {when ? ` · ${when}` : ""}
        </p>
      </header>

      <dl className="mb-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-xl border border-border bg-surface p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">Subject</dt>
          <dd className="font-medium text-foreground">
            <Link href={`/papers/${paper.programmeSlug}/${paper.subjectSlug}`} className="text-accent hover:underline">
              {paper.subjectName}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Programme</dt>
          <dd className="font-medium text-foreground">
            <Link href={`/papers/${paper.programmeSlug}`} className="text-accent hover:underline">
              {paper.programmeName}
            </Link>
          </dd>
        </div>
        {paper.semesters.length > 0 && (
          <div>
            <dt className="text-muted">Semester</dt>
            <dd className="font-medium text-foreground">{paper.semesters.join(", ")}</dd>
          </div>
        )}
        {paper.paperType && (
          <div>
            <dt className="text-muted">Paper type</dt>
            <dd className="font-medium text-foreground">{paper.paperType}</dd>
          </div>
        )}
        {paper.paperCode && (
          <div>
            <dt className="text-muted">Paper code</dt>
            <dd className="font-medium text-foreground">
              <Link href={`/paper-code/${paper.paperCode}`} className="text-accent hover:underline">
                {paper.paperCode}
              </Link>
            </dd>
          </div>
        )}
        {paper.session && (
          <div>
            <dt className="text-muted">Exam session</dt>
            <dd className="font-medium text-foreground">{paper.session}</dd>
          </div>
        )}
        {paper.year && (
          <div>
            <dt className="text-muted">Year</dt>
            <dd className="font-medium text-foreground">{paper.year}</dd>
          </div>
        )}
        {paper.set && (
          <div>
            <dt className="text-muted">Set</dt>
            <dd className="font-medium text-foreground">{paper.set}</dd>
          </div>
        )}
        {paper.marks && (
          <div>
            <dt className="text-muted">Maximum marks</dt>
            <dd className="font-medium text-foreground">{paper.marks}</dd>
          </div>
        )}
        {paper.college && (
          <div>
            <dt className="text-muted">Source</dt>
            <dd className="font-medium text-foreground">{paper.college}</dd>
          </div>
        )}
        <div>
          <dt className="text-muted">University</dt>
          <dd className="font-medium text-foreground">Delhi University</dd>
        </div>
      </dl>

      <div className="mb-8 flex flex-wrap gap-3">
        <a
          href={paper.fileUrl}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-semibold text-white hover:opacity-90"
        >
          <ArrowSquareOut size={17} weight="bold" /> View PDF
        </a>
        <a
          href={paper.fileUrl}
          download
          rel="nofollow"
          className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 font-semibold text-foreground hover:border-accent/50"
        >
          <DownloadSimple size={17} weight="bold" /> Download PDF
        </a>
      </div>

      {paper.syllabusUrl && (
        <p className="mb-8 text-sm">
          <a
            href={paper.syllabusUrl}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="text-accent hover:underline"
          >
            Official DU syllabus for {paper.subjectName} →
          </a>
        </p>
      )}

      {otherYears.length > 0 && (
        <section className="border-t border-border pt-8">
          <h2 className="mb-4 text-xl font-bold text-foreground">
            Other years — {paper.subjectName}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherYears.map((p) => (
              <PaperCard key={p.slug} paper={p} />
            ))}
          </div>
          <p className="mt-4 text-sm">
            <Link
              href={`/papers/${paper.programmeSlug}/${paper.subjectSlug}`}
              className="text-accent hover:underline"
            >
              All {paper.subjectName} papers →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
