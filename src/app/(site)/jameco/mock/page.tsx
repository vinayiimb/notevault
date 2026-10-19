import type { Metadata } from "next";
import { loadJamQuestions } from "@/lib/jam-economics-data";
import { buildMockTests } from "@/lib/jam-mock";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { JamNav } from "@/components/jam/jam-nav";
import { JamMockDashboard } from "@/components/jam/mock-dashboard";

export const metadata: Metadata = {
  title: "IIT JAM Economics Mock Test — Free Full Length, Sectional & Topic Tests",
  description:
    "Free IIT JAM Economics (EN) mock tests from the 2021–2025 papers: full-length 3-hour CBT mocks, Section A/B/C sectionals and topic-wise tests with JAM marking, a question palette, timer, calculator and full solutions.",
  alternates: { canonical: "/jameco/mock" },
};

export const dynamic = "force-static";

export default function JamMockPage() {
  const tests = buildMockTests(loadJamQuestions());
  return (
    <div className="mx-auto max-w-6xl px-3 pb-12 pt-5 sm:px-5 lg:px-6 lg:pt-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "IIT JAM Economics", url: "/jameco" },
          { name: "Mock Tests", url: "/jameco/mock" },
        ]}
      />
      <JamNav active="/jameco/mock" />
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">IIT JAM Economics Mock Tests</h1>
      <p className="mb-6 mt-1 max-w-3xl text-sm text-muted">
        Attempt past JAM papers the way the real exam runs them: timer, question palette, mark for review, virtual calculator and JAM&apos;s
        negative marking. Then review every answer with its full solution.
      </p>
      <JamMockDashboard tests={tests} />
    </div>
  );
}
