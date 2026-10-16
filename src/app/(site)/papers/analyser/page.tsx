import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { isBundle, parseYears, sectionAnswer, type AnalyserQuestion } from "@/lib/pyq-analyser";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { PyqAnalyserClient, type AnalyserSubject } from "@/components/pyq-analyser/pyq-analyser-client";

export const metadata: Metadata = {
  title: "DU PYQ Analyser — Topic-wise Previous Year Questions",
  description:
    "Filter Delhi University previous year questions by topic, year, section, marks and difficulty. See which topics come most often and which questions repeat.",
  alternates: { canonical: "/papers/analyser" },
};

// Reads the DB per request (Railway's Docker build has no DATABASE_URL).
export const dynamic = "force-dynamic";

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Papers", url: "/papers" },
  { name: "PYQ Analyser", url: "/papers/analyser" },
];

async function loadSubjects(): Promise<AnalyserSubject[]> {
  const counts = await prisma.question.groupBy({ by: ["subjectId"], _count: { _all: true } });
  const subjects = await prisma.subject.findMany({
    where: { id: { in: counts.map((c) => c.subjectId) } },
    select: { id: true, name: true, term: { select: { name: true, order: true, program: { select: { name: true } } } } },
  });
  const countOf = new Map(counts.map((c) => [c.subjectId, c._count._all]));
  return subjects
    .map((s) => ({
      id: s.id,
      name: s.name,
      term: s.term.name,
      termOrder: s.term.order,
      program: s.term.program.name,
      count: countOf.get(s.id) ?? 0,
    }))
    .sort((a, b) => a.program.localeCompare(b.program) || a.termOrder - b.termOrder || a.name.localeCompare(b.name));
}

async function loadQuestions(subjectId: string): Promise<AnalyserQuestion[]> {
  const rows = await prisma.question.findMany({
    where: { subjectId },
    select: {
      id: true,
      questionNumber: true,
      questionText: true,
      answerText: true,
      marks: true,
      years: true,
      section: true,
      topics: true,
      difficulty: true,
      repeatCount: true,
    },
    orderBy: [{ repeatCount: "desc" }, { createdAt: "asc" }],
  });
  return rows.map((q) => {
    // section.q bundles (even ones saved before they were stored as plain
    // answers) render natively; other bundles are fetched on demand
    // (/api/pyq-answer), not shipped with the page.
    const answer = sectionAnswer(q.answerText) ?? q.answerText;
    const bundle = isBundle(answer);
    return {
      id: q.id,
      number: q.questionNumber,
      text: q.questionText,
      answer: bundle ? "" : answer,
      bundle,
      marks: q.marks,
      years: parseYears(q.years),
      section: q.section,
      topics: q.topics,
      difficulty: q.difficulty,
      repeatCount: q.repeatCount,
    };
  });
}

export default async function PyqAnalyserPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const subjects = await loadSubjects().catch(() => []);
  const selected = subjects.find((s) => s.id === subject) ?? null;
  const questions = selected ? await loadQuestions(selected.id).catch(() => []) : [];

  // Full-width workspace: filters flush left, the question gets the rest.
  // The title stays for SEO and screen readers, not on screen.
  return (
    <div className="px-3 pb-8 pt-5 sm:px-5 lg:px-6 lg:pt-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <h1 className="sr-only">PYQ Analyser — DU previous year questions topic-wise, with solutions</h1>
      <PyqAnalyserClient subjects={subjects} selected={selected} questions={questions} />
    </div>
  );
}
