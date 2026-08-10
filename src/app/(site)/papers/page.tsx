import type { Metadata } from "next";
import { getUnifiedPyqArchive } from "@/lib/pyq-catalog";
import { PaperBrowser } from "@/components/archive/paper-browser";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Browse Question Papers | DU PYQ Online",
  description:
    "Filter Delhi University previous year question papers by course, semester and subject, then preview any year instantly — no page reloads.",
  alternates: { canonical: "/papers" },
};

export default async function PapersPage() {
  const papers = await getUnifiedPyqArchive();

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "Browse Papers", url: "/papers" },
        ]}
      />
      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Browse question papers</h1>
        <p className="mt-2 text-base text-muted">
          Pick a course, semester and subject on the left, then jump between years without leaving this page.
        </p>
      </div>
      <div className="mt-8">
        <PaperBrowser papers={papers} />
      </div>
    </div>
  );
}
