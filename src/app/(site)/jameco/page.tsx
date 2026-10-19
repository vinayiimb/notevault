import fs from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { parseJamPaper } from "@/lib/jam-economics";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { JamAnalyserClient } from "@/components/jam/jam-analyser-client";

export const metadata: Metadata = {
  title: "IIT JAM Economics PYQ 2021–2025 — Topic-wise MCQ, MSQ, NAT with Solutions",
  description:
    "All 300 IIT JAM Economics (EN) questions from 2021 to 2025, tagged by year, question type and JAM syllabus topic. Practise MCQ, MSQ and NAT questions and check step-by-step solutions.",
  alternates: { canonical: "/jameco" },
};

// The papers are files in the repo, so the page is built once, no DB.
export const dynamic = "force-static";

function loadQuestions() {
  const dir = path.join(process.cwd(), "src", "data", "jam-economics");
  return fs
    .readdirSync(dir)
    .filter((f) => /^\d{4}\.md$/.test(f))
    .flatMap((f) => parseJamPaper(f.slice(0, 4), fs.readFileSync(path.join(dir, f), "utf8")));
}

export default function JamEconomicsPage() {
  const questions = loadQuestions();
  const years = [...new Set(questions.map((q) => q.year))].sort();
  return (
    <div className="px-3 pb-8 pt-5 sm:px-5 lg:px-6 lg:pt-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: "IIT JAM Economics PYQ", url: "/jameco" },
        ]}
      />
      <h1 className="text-xl font-semibold text-foreground sm:text-2xl">IIT JAM Economics previous year questions</h1>
      <p className="mb-5 mt-1 max-w-3xl text-sm text-muted">
        {questions.length} questions from JAM {years[0]}–{years.at(-1)}, each tagged with its year, question type (MCQ, MSQ, NAT) and JAM syllabus topic. Answer a
        question to check it, then read the step-by-step solution.
      </p>
      <JamAnalyserClient questions={questions} />
    </div>
  );
}
