import type { Metadata } from "next";
import { ResultDoctorClient } from "@/components/result-doctor/result-doctor-client";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Result Doctor — DU Marksheet Analyser & Marks Calculator",
  description:
    "Analyse your Delhi University marksheet: true cumulative CGPA, percentage, grade errors worth a re-evaluation, where you lost marks, and the SGPA you need for your target CGPA.",
  alternates: { canonical: "/tools/result-doctor" },
};

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Tools", url: "/tools" },
  { name: "Result Doctor", url: "/tools/result-doctor" },
];

export default function ResultDoctorPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Result Doctor</h1>
        <p className="mt-3 text-base text-muted">
          Turn your DU marksheet into a clear report: your real cumulative CGPA and percentage, grades that don&apos;t add up
          and are worth a re-evaluation, where you lost marks, and exactly what you need for your target CGPA.
        </p>
      </div>

      <div className="mt-8">
        <ResultDoctorClient />
      </div>
    </div>
  );
}
