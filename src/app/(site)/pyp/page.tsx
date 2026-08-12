import type { Metadata } from "next";
import { getAllDuPypProgrammes, getGroupedDuPypProgrammes, getTotalDuPypCount } from "@/lib/du-pyp-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { DuPypBrowser } from "@/components/pyp/du-pyp-browser";

export const metadata: Metadata = {
  title: "DU Previous Year Papers (PYP) — All Programmes | DU PYQ Online",
  description:
    "Browse all 118 official DU programmes with semester-wise (I–VIII) previous year question papers, organised by paper type: DSC, DSE, GE, AEC, SEC, VAC.",
  alternates: { canonical: "/pyp" },
};

export const revalidate = 3600;

export default function DuPypPage() {
  const programmes = getAllDuPypProgrammes();
  const groupedProgrammes = getGroupedDuPypProgrammes();
  const totalCount = getTotalDuPypCount();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "PYP", url: "/pyp" },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl mb-8">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          DU Previous Year Papers
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-7 text-muted">
          Browse all <strong className="text-foreground">118 official DU programmes</strong>.
          Select a programme to see its semester-wise papers organised by paper type — DSC, DSE, GE, AEC, SEC, and VAC.
        </p>
      </div>

      <DuPypBrowser
        programmes={programmes}
        groupedProgrammes={groupedProgrammes}
        totalCount={totalCount}
      />
    </div>
  );
}
