import type { Metadata } from "next";
import { Suspense } from "react";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { CanonicalArchiveBrowser } from "@/components/archive/canonical-archive-browser";
import { getFullPyqCatalog, catalogIntegrity } from "@/lib/pyq-catalog";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";

export const metadata: Metadata = {
  title: "Complete DU Papers and Notes Archive | DU PYQ Online",
  description:
    "Browse the complete Delhi University previous year question paper archive — every course, semester, and subject in one searchable library.",
  alternates: { canonical: "/pyq-notes" },
};

export const revalidate = 3600;

async function PapersContent() {
  const papers = await getFullPyqCatalog();
  return <CanonicalArchiveBrowser papers={papers} />;
}

export default function PyqNotesArchivePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Full archive", url: "/pyq-notes" },
        ]}
      />
      <div className="max-w-3xl">
        <p className="flex items-center gap-2 text-sm font-medium text-accent">
          <BookOpenText size={18} weight="bold" /> Full archive
        </p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight sm:text-5xl">
          Every paper and study file on the site.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Browse Delhi University previous year question papers organized by canonical DU curriculum structure.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-3 text-sm text-muted">
        <span className="rounded-full bg-accent-soft px-3 py-1.5 font-medium text-accent">
          27,800+ files total
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          118 canonical programmes
        </span>
        <span className="rounded-full bg-success-soft px-3 py-1.5 text-success">
          22,853 officially mapped papers
        </span>
        <span className="rounded-full bg-surface-muted px-3 py-1.5">
          9 subject categories
        </span>
      </div>

      <Suspense fallback={<div className="mt-10 h-[500px] w-full animate-pulse rounded-2xl bg-surface-muted border border-border/60" />}>
        <PapersContent />
      </Suspense>
    </div>
  );
}
