import { Suspense } from "react";
import type { Metadata } from "next";
import { getAllDuPypProgrammes, getGroupedDuPypProgrammes, getTotalDuPypCount } from "@/lib/du-pyp-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { PapersViewTabs } from "@/components/archive/papers-view-tabs";

export const metadata: Metadata = {
  title: "DU Question Papers (118 Programmes) | DU PYQ Online",
  description:
    "Browse 29,000+ Delhi University previous year question papers across all 118 official DU programmes, categorized by semester (I–VIII) and paper type (DSC, DSE, GE, AEC, SEC, VAC) with college badges.",
  alternates: { canonical: "/papers" },
};

export const revalidate = 3600;

// Reverted from loading the 13MB papers catalog server-side (2025-09-29):
// parsing + merging that file in the Next server process OOM-crashed
// production (Railway's container heap couldn't hold it), taking the whole
// site down. Back to the client fetching /data/papers-catalog.json itself,
// which keeps that memory cost in the browser instead of the server.
export default async function PapersPage() {
  const [programmes, groupedProgrammes, totalCount] = await Promise.all([
    getAllDuPypProgrammes(),
    getGroupedDuPypProgrammes(),
    getTotalDuPypCount(),
  ]);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Papers", url: "/papers" },
  ];

  return (
    <div className="mx-auto w-full px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

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
