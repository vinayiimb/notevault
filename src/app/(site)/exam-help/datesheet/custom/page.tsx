import type { Metadata } from "next";
import { getDatesheetManifest, getProgrammeEntries, type DatesheetEntry } from "@/lib/datesheet-data";
import { CustomDatesheetBuilder } from "@/components/datesheet/custom-datesheet-builder";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Build Your Custom DU Datesheet",
  description:
    "Select your Core, Elective, GE, SEC, VAC and AEC papers to generate a personal chronological DU exam datesheet for December 2026.",
  alternates: { canonical: "/exam-help/datesheet/custom" },
};

export default function CustomDatesheetPage() {
  const manifest = getDatesheetManifest();
  const entriesByProgramme: Record<string, DatesheetEntry[]> = {};
  for (const p of manifest.programmes) {
    entriesByProgramme[p.slug] = getProgrammeEntries(p.slug);
  }

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Exam Help", url: "/exam-help" },
    { name: "Datesheet", url: "/exam-help/datesheet" },
    { name: "Custom Datesheet", url: "/exam-help/datesheet/custom" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Build Your Custom Datesheet
        </h1>
        <p className="mt-3 text-base text-muted">
          Every student takes a different mix of Core, Elective, GE, SEC, VAC and AEC papers. Pick
          exactly the papers you&apos;re appearing for and get a single chronological schedule — no
          scrolling through papers that aren&apos;t yours.
        </p>
      </div>

      <div className="mt-8">
        <CustomDatesheetBuilder
          programmes={manifest.programmes}
          entriesByProgramme={entriesByProgramme}
          examSession={manifest.examSession}
        />
      </div>
    </div>
  );
}
