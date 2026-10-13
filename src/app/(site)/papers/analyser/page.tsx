import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { parseYears, type AnalyserQuestion } from "@/lib/pyq-analyser";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
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
  return rows.map((q) => ({
    id: q.id,
    number: q.questionNumber,
    text: q.questionText,
    answer: q.answerText,
    marks: q.marks,
    years: parseYears(q.years),
    section: q.section,
    topics: q.topics,
    difficulty: q.difficulty,
    repeatCount: q.repeatCount,
  }));
}

export default async function PyqAnalyserPage({ searchParams }: { searchParams: Promise<{ subject?: string }> }) {
  const { subject } = await searchParams;
  const subjects = await loadSubjects().catch(() => []);
  const selected = subjects.find((s) => s.id === subject) ?? null;
  const questions = selected ? await loadQuestions(selected.id).catch(() => []) : [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">PYQ Analyser</h1>
        <p className="mt-3 text-base text-muted">
          Filter DU previous year questions topic-wise. See which topics come most often, which questions repeat across years, and
          practise exactly what gets asked.
        </p>
      </div>

      <div className="mt-6">
        <PyqAnalyserClient subjects={subjects} selected={selected} questions={questions} />
      </div>
    </div>
  );
}
