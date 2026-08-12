import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllDuPypProgrammes, getGroupedDuPypProgrammes, getTotalDuPypCount } from "@/lib/du-pyp-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { DuPypBrowser } from "@/components/pyp/du-pyp-browser";
import { PapersViewTabs } from "@/components/archive/papers-view-tabs";

export const metadata: Metadata = {
  title: "DU Question Papers (118 Programmes) | DU PYQ Online",
  description:
    "Browse 29,000+ Delhi University previous year question papers across all 118 official DU programmes, categorized by semester (I–VIII) and paper type (DSC, DSE, GE, AEC, SEC, VAC) with college badges.",
  alternates: { canonical: "/papers" },
};

export const revalidate = 3600;

export default function PapersPage() {
  const programmes = getAllDuPypProgrammes();
  const groupedProgrammes = getGroupedDuPypProgrammes();
  const totalCount = getTotalDuPypCount();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Papers", url: "/papers" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-4xl mb-6">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
          DU Question Papers &amp; Syllabus Archive
        </h1>
        <p className="mt-2 text-sm sm:text-base text-muted">
          Browse <strong className="text-foreground">118 official DU programmes</strong> with semester-wise papers (Semesters I–VIII) organized by subject category (<span className="text-violet-400 font-semibold">DSC</span>, <span className="text-blue-400 font-semibold">DSE</span>, <span className="text-emerald-400 font-semibold">GE</span>, <span className="text-amber-400 font-semibold">AEC</span>, <span className="text-pink-400 font-semibold">SEC</span>, <span className="text-cyan-400 font-semibold">VAC</span>) with college badges (<span className="text-emerald-400 font-bold">[S]</span> Shivaji, <span className="text-rose-400 font-bold">[K]</span> Kalindi, <span className="text-blue-400 font-bold">[A]</span> ANDC, <span className="text-amber-400 font-bold">[R]</span> Ramanujan).
        </p>
      </div>

      <Suspense fallback={<div className="h-96 rounded-2xl bg-surface/50 animate-pulse" />}>
        <PapersViewTabs
          programmes={programmes}
          groupedProgrammes={groupedProgrammes}
          totalCount={totalCount}
        />
      </Suspense>
    </div>
  );
}
