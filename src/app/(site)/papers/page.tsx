import type { Metadata } from "next";
import { PaperBrowser } from "@/components/archive/paper-browser";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";

export const metadata: Metadata = {
  title: "Browse Question Papers | DU PYQ Online",
  description:
    "Filter Delhi University previous year question papers by course, semester and subject, then preview any year instantly — no page reloads.",
  alternates: { canonical: "/papers" },
};

export default function PapersPage() {
  return (
    <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-5">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Browse Papers", url: "/papers" },
        ]}
      />
      <div className="mb-4 sm:mb-5">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Browse Question Papers</h1>
        <p className="mt-1 text-xs sm:text-sm text-muted">
          Pick a course, semester and subject on the left to preview Delhi University previous year question papers instantly.
        </p>
      </div>
      <PaperBrowser />
    </div>
  );
}
