import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadJamQuestions } from "@/lib/jam-economics-data";
import { buildMockTests } from "@/lib/jam-mock";
import { JamMockCbt } from "@/components/jam/mock-cbt";
import { JamTopicTest } from "@/components/jam/mock-topic";

// One static page per test (5 papers × full + 3 sections, plus every topic).
export const dynamicParams = false;

export function generateStaticParams() {
  return buildMockTests(loadJamQuestions()).map((t) => ({ test: t.id }));
}

function load(id: string) {
  const questions = loadJamQuestions();
  const test = buildMockTests(questions).find((t) => t.id === id);
  if (!test) notFound();
  const byId = new Map(questions.map((q) => [q.id, q]));
  return { test, questions: test.questionIds.map((qid) => byId.get(qid)!) };
}

export async function generateMetadata({ params }: { params: Promise<{ test: string }> }): Promise<Metadata> {
  const { test } = load((await params).test);
  return {
    title: `${test.kind === "topic" ? `JAM Economics topic test: ${test.title}` : test.title} — Mock Test`,
    alternates: { canonical: `/jameco/mock/${test.id}` },
    // The test screen is an app view; /jameco/mock is the page to index.
    robots: { index: false, follow: true },
  };
}

export default async function JamMockTestPage({ params }: { params: Promise<{ test: string }> }) {
  const { test, questions } = load((await params).test);
  // Topic tests are untimed practice; full and sectional mocks use the CBT console.
  return test.kind === "topic" ? <JamTopicTest test={test} questions={questions} /> : <JamMockCbt test={test} questions={questions} />;
}
