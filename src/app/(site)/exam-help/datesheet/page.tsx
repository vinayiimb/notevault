import type { Metadata } from "next";
import Link from "next/link";
import { getDatesheetManifest } from "@/lib/datesheet-data";
import { DatesheetBrowser } from "@/components/datesheet/datesheet-browser";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "DU Datesheet December 2026",
  description:
    "Official Delhi University semester exam datesheet for B.A., B.Com, B.Sc. and all NEP-UGCF programmes. Search by course and semester, with source PDFs linked.",
  alternates: { canonical: "/exam-help/datesheet" },
};

export default function DatesheetPage() {
  // Only the manifest (programme list, a few KB) is loaded server-side.
  // Each programme's actual rows (up to ~780KB for the largest file) are
  // fetched client-side on demand by DatesheetBrowser — shipping all 19
  // files' 7,000+ rows (6.7MB) on every page load was slow enough on
  // mobile data to look like the page had crashed.
  const manifest = getDatesheetManifest();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Exam Help", url: "/exam-help" },
    { name: "Datesheet", url: "/exam-help/datesheet" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          DU Datesheet — {manifest.examSession}
        </h1>
        <p className="mt-3 text-base text-muted">
          Official University of Delhi semester exam datesheet, extracted from the Controller of
          Examinations&apos; notifications. Pick your programme and semester to see your full exam schedule.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-[#0284c7]/20 bg-sky-soft/40 p-5 sm:p-6">
        <p className="text-sm text-foreground">
          Only picking a few specific papers?{" "}
          <Link href="/exam-help/datesheet/custom" className="font-bold text-sky-dark hover:underline">
            Build your custom datesheet →
          </Link>{" "}
          — select just your Core, Elective, GE, SEC, VAC or AEC papers and get a personal
          chronological schedule.
        </p>
      </div>

      <div className="mt-8">
        <DatesheetBrowser programmes={manifest.programmes} examSession={manifest.examSession} />
      </div>
    </div>
  );
}
