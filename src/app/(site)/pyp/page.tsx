import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogArchiveBrowser } from "@/components/archive/catalog-archive-browser";
import { getRawUnifiedPyqArchive } from "@/lib/pyq-catalog";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "DU Previous Year Papers (PYP) Archive | DU PYQ Online",
  description:
    "Browse and download previous year question papers for the University of Delhi (DU) — fully organised by course, semester, and subject.",
  alternates: { canonical: "/pyp" },
};

export const revalidate = 3600;

export default async function OfficialPapersArchivePage() {
  const papers = await getRawUnifiedPyqArchive();
  const courseCount = new Set(papers.map((paper) => paper.course)).size;
  const subjectCount = new Set(papers.map((paper) => `${paper.course}::${paper.subject}`)).size;
  const sessionCount = new Set(papers.map((paper) => paper.note?.match(/\b(NOV-DEC|MAY-JUNE)-\d{4}\b/i)?.[0])).size;

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "PYP", url: "/pyp" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Previous Year Papers Archive
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Browse and download previous year question papers for the University of Delhi (DU) — 
          fully organised by course, semester, and subject.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
          {papers.length} papers
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {courseCount} programmes
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          {subjectCount} subjects
        </span>
        {sessionCount > 0 && (
          <span className="rounded-full bg-surface-muted px-3 py-1.5">
            {sessionCount} exam sessions
          </span>
        )}
      </div>

      {papers.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-border bg-surface-muted p-8 text-center text-sm text-muted">
          No papers imported yet.
        </div>
      ) : (
        <Suspense fallback={<div className="mt-10 h-[500px] w-full animate-pulse rounded-2xl bg-surface-muted border border-border/60" />}>
          <CatalogArchiveBrowser papers={papers} />
        </Suspense>
      )}
    </div>
  );
}

