import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { PaperBrowser } from "@/components/archive/paper-browser";

export const metadata: Metadata = {
  title: "More DU Question Papers (Older CBCS & Other Papers) | DU PYQ Online",
  description:
    "Delhi University previous year question papers that are not in the current syllabus — older CBCS papers and other papers, by course, semester and subject.",
  alternates: { canonical: "/papers/noncore" },
};

// Same browser as /papers, fed from public/data/papers/noncore/ (papers
// outside the current syllabus — see scripts/drive-catalog.py).
export default function NoncorePapersPage() {
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Papers", url: "/papers" },
    { name: "More papers", url: "/papers/noncore" },
  ];

  return (
    <div className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-muted sm:text-sm">
        These papers aren&apos;t in the current DU syllabus — older CBCS papers and others.{" "}
        <Link href="/papers" className="font-semibold text-accent hover:underline">
          Current syllabus papers →
        </Link>
      </p>

      <Suspense fallback={<div className="h-96 rounded-2xl bg-surface/50 animate-pulse" />}>
        <PaperBrowser dataBase="/data/papers/noncore" />
      </Suspense>
    </div>
  );
}
