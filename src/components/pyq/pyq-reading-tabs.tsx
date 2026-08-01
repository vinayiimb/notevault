"use client";

import { useState } from "react";
import { BookOpenText, ChartBar, FileText, MagnifyingGlass, PenNib } from "@phosphor-icons/react";
import {
  FormattedOcrPaperRenderer,
  isAiReformattedOcr,
  OcrContents,
  OcrPaperRenderer,
} from "@/components/subjects/ocr-paper-renderer";
import { PaperAnalysisPanel, type Analysis } from "@/components/subjects/paper-analysis-panel";
import { PDFViewer } from "@/components/pyq/pdf-viewer";
import { PYQMetadata } from "@/components/pyq/pyq-metadata";
import { AnswerReveal } from "@/components/content/answer-reveal";
import { StudyContentRenderer } from "@/components/content/study-content-renderer";
import { CopyButton } from "@/components/pyq/copy-button";
import { StudyContentBlockListSchema, type QuizBlockSchema } from "@/lib/content/content-block-schema";
import type { z } from "zod";
import { PracticeQuiz } from "@/components/content/practice-quiz";
import Link from "next/link";

type Question = {
  id: string;
  questionText: string;
  answerText: string;
  marks: number | null;
  questionNumber: string | null;
  section: string | null;
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  topics: string[];
  contentBlocks: unknown;
};

const TABS = [
  { key: "paper", label: "Paper", Icon: FileText },
  { key: "text", label: "Searchable Text", Icon: MagnifyingGlass },
  { key: "solutions", label: "Solutions", Icon: BookOpenText },
  { key: "analysis", label: "Analysis", Icon: ChartBar },
  { key: "practice", label: "Practice", Icon: PenNib },
] as const;
type TabKey = (typeof TABS)[number]["key"];

export function PyqReadingTabs({
  paper,
  metadata,
  ocrText,
  questions,
  subjectId,
  pyqCount,
  initialAnalysis,
  generatedAt,
}: {
  paper: { id: string; fileUrl: string; downloadable?: boolean };
  metadata: Parameters<typeof PYQMetadata>[0];
  ocrText: string;
  questions: Question[];
  subjectId: string;
  pyqCount: number;
  initialAnalysis: Analysis | null;
  generatedAt: string | null;
}) {
  const [tab, setTab] = useState<TabKey>("paper");

  return (
    <div>
      <div className="flex overflow-x-auto border-b border-border" role="tablist" aria-label="Paper sections">
        {TABS.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`inline-flex min-w-max items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold ${
              tab === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            <Icon size={16} weight="bold" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-1 pt-6 sm:p-2 sm:pt-6">
        {tab === "paper" && (
          <div className="flex flex-col gap-4">
            <PYQMetadata {...metadata} />
            <PDFViewer url={paper.fileUrl} downloadable={paper.downloadable} />
          </div>
        )}

        {tab === "text" && (
          <article className="rounded-3xl border border-sky/25 bg-sky-soft/45 px-5 py-7 shadow-[0_20px_60px_rgba(66,195,243,.10)] dark:border-border dark:bg-surface sm:px-10 sm:py-10">
            <div className="mb-8 flex items-center justify-between border-b border-sky/25 pb-5 text-xs font-semibold tracking-[0.16em] text-muted uppercase">
              Original extracted question paper
              <span className="hidden text-sky-dark sm:inline">Full text · preserved</span>
            </div>
            <OcrContents text={ocrText} />
            {isAiReformattedOcr(ocrText) ? <FormattedOcrPaperRenderer text={ocrText} /> : <OcrPaperRenderer text={ocrText} />}
          </article>
        )}

        {tab === "solutions" && <SolutionsTab questions={questions} />}

        {tab === "analysis" && (
          <PaperAnalysisPanel subjectId={subjectId} pyqCount={pyqCount} initialAnalysis={initialAnalysis} generatedAt={generatedAt} />
        )}

        {tab === "practice" && <PracticeTab questions={questions} />}
      </div>
    </div>
  );
}

function SolutionsTab({ questions }: { questions: Question[] }) {
  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
        No questions have been linked to this specific paper yet — an admin can link questions to it from
        the Question bank editor.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-semibold tracking-wide text-muted uppercase">{questions.length} question{questions.length === 1 ? "" : "s"}</p>
      {questions.map((q, index) => {
        const parsedBlocks = StudyContentBlockListSchema.safeParse(q.contentBlocks);
        return (
          <div key={q.id} id={`question-${q.id}`} className="scroll-mt-24 rounded-2xl border border-border bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                  {q.section ? `${q.section} · ` : ""}Question {q.questionNumber ?? index + 1}
                  {q.marks ? ` · ${q.marks} marks` : ""}
                </p>
                <p className="mt-1 font-medium text-foreground">{q.questionText}</p>
              </div>
              <CopyButton text={q.questionText} label="Copy question" />
            </div>
            {q.topics.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {q.topics.map((topic) => (
                  <span key={topic} className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted">{topic}</span>
                ))}
              </div>
            )}
            <div className="mt-3">
              <AnswerReveal>
                <p className="whitespace-pre-wrap">{q.answerText}</p>
                {parsedBlocks.success && parsedBlocks.data.length > 0 && (
                  <div className="mt-4">
                    <StudyContentRenderer blocks={parsedBlocks.data} />
                  </div>
                )}
              </AnswerReveal>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type QuizBlock = z.infer<typeof QuizBlockSchema>;

function PracticeTab({ questions }: { questions: Question[] }) {
  const quizBlocks: QuizBlock[] = [];
  for (const q of questions) {
    const parsed = StudyContentBlockListSchema.safeParse(q.contentBlocks);
    if (!parsed.success) continue;
    for (const block of parsed.data) {
      if (block.type === "quiz") quizBlocks.push(block);
    }
  }

  if (quizBlocks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border p-8 text-center">
        <p className="text-sm text-muted">No practice questions have been authored for this paper yet.</p>
        <Link
          href="/tools/exam-kit"
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover"
        >
          Generate practice questions with Exam Kit
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {quizBlocks.map((block) => (
        <PracticeQuiz key={block.id} question={block.question} options={block.options} correctAnswer={block.correctAnswer} explanation={block.explanation} />
      ))}
    </div>
  );
}
