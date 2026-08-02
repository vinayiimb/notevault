"use client";

import { useState, useTransition } from "react";
import { ChartBar, NotePencil, Sparkle, Target } from "@phosphor-icons/react/dist/ssr";
import { generateSubjectAnalysisAction } from "@/lib/subject-analysis-actions";
import { NotesRenderer } from "@/components/subjects/notes-renderer";

type RepeatedQuestion = {
  questionText: string;
  topic: string;
  yearsAppeared: string[];
  repeatCount: number;
  marks: number | null;
};
type PredictedQuestion = { questionText: string; reasoning: string; marks: number | null };
type Analysis = {
  compiledNotes: string;
  mostRepeated: RepeatedQuestion[];
  predictedPaper: PredictedQuestion[];
};
type View = "patterns" | "notes" | "prediction";

const VIEWS = [
  { key: "patterns", label: "Exam patterns", Icon: ChartBar },
  { key: "notes", label: "Study notes", Icon: NotePencil },
  { key: "prediction", label: "Paper prediction", Icon: Target },
] as const;

export function PaperAnalysisPanel({
  subjectId,
  pyqCount,
  initialAnalysis,
  generatedAt,
}: {
  subjectId: string;
  pyqCount: number;
  initialAnalysis: Analysis | null;
  generatedAt: string | null;
}) {
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [view, setView] = useState<View>("patterns");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState(generatedAt);

  function run() {
    setError(null);
    startTransition(async () => {
      const result = await generateSubjectAnalysisAction(subjectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnalysis(result.data);
      setLastGenerated(new Date().toLocaleString());
      setView("patterns");
    });
  }

  if (pyqCount === 0) return null;

  return (
    <section className="mt-10 overflow-hidden rounded-2xl border border-border bg-surface">
      <div className="flex flex-col gap-4 border-b border-border bg-surface-muted/45 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="max-w-2xl">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Sparkle size={20} weight="fill" className="text-brand" />
            PYQ intelligence
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted">
            Analyze {pyqCount} uploaded paper{pyqCount === 1 ? "" : "s"} for recurring topics,
            exam-ready notes, and an evidence-based prediction.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={isPending}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:cursor-wait disabled:opacity-55"
        >
          <Sparkle size={16} weight="bold" />
          {isPending ? "Analyzing papers…" : analysis ? "Refresh analysis" : "Analyze papers"}
        </button>
      </div>

      {error && (
        <p role="alert" className="m-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300 sm:m-6">
          {error}
        </p>
      )}

      {!analysis && !error && (
        <div className="grid gap-px bg-border sm:grid-cols-3">
          {VIEWS.map(({ key, label, Icon }) => (
            <div key={key} className="bg-surface p-5">
              <Icon size={20} weight="bold" className="text-accent" />
              <p className="mt-3 font-semibold">{label}</p>
              <p className="mt-1 text-sm text-muted">
                {key === "patterns" && "See which questions and topics recur across years."}
                {key === "notes" && "Turn tested material into structured revision notes."}
                {key === "prediction" && "Prioritize likely questions with clear reasoning."}
              </p>
            </div>
          ))}
        </div>
      )}

      {analysis && (
        <>
          <div className="flex overflow-x-auto border-b border-border px-3 sm:px-5" role="tablist" aria-label="Analysis views">
            {VIEWS.map(({ key, label, Icon }) => (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={view === key}
                onClick={() => setView(key)}
                className={`inline-flex min-w-max items-center gap-2 border-b-2 px-3 py-3 text-sm font-semibold ${
                  view === key
                    ? "border-accent text-accent"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                <Icon size={16} weight="bold" />
                {label}
              </button>
            ))}
          </div>

          <div className="p-5 sm:p-6">
            {view === "patterns" && <PatternAnalysis questions={analysis.mostRepeated} />}
            {view === "notes" && (
              <NotesRenderer content={analysis.compiledNotes} theme="violet" />
            )}
            {view === "prediction" && (
              <div>
                <p className="max-w-2xl text-sm text-muted">
                  Prioritization based on repetition across the uploaded papers. Treat it as a study
                  guide, not a guaranteed paper.
                </p>
                <ol className="mt-5 divide-y divide-border rounded-xl border border-border">
                  {analysis.predictedPaper.map((question, index) => (
                    <li key={`${question.questionText}-${index}`} className="grid gap-3 p-4 sm:grid-cols-[2rem_1fr_auto] sm:p-5">
                      <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft font-mono text-xs font-bold text-accent">
                        {index + 1}
                      </span>
                      <div>
                        <p className="font-semibold leading-6">{question.questionText}</p>
                        <p className="mt-1 text-sm leading-6 text-muted">{question.reasoning}</p>
                      </div>
                      {question.marks && <span className="text-xs font-semibold text-muted">{question.marks} marks</span>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </>
      )}

      {lastGenerated && !isPending && (
        <p className="border-t border-border px-5 py-3 text-xs text-muted sm:px-6">
          Last analyzed {lastGenerated}
        </p>
      )}
    </section>
  );
}

function PatternAnalysis({ questions }: { questions: RepeatedQuestion[] }) {
  if (questions.length === 0) {
    return <p className="text-sm text-muted">No clear repeated-question pattern was found in these papers.</p>;
  }
  const max = Math.max(...questions.map((question) => question.repeatCount), 1);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="font-semibold">Repetition frequency</h3>
          <p className="mt-1 text-sm text-muted">The strongest recurring questions, ranked by appearances.</p>
        </div>
        <span className="text-xs font-medium text-muted">{questions.length} recurring pattern{questions.length === 1 ? "" : "s"}</span>
      </div>
      <div className="mt-5 space-y-5">
        {questions.map((question, index) => (
          <div key={`${question.questionText}-${index}`}>
            <div className="flex items-start justify-between gap-4 text-sm">
              <div>
                <p className="font-semibold leading-5">{question.topic}</p>
                <p className="mt-1 line-clamp-2 text-muted">{question.questionText}</p>
              </div>
              <span className="shrink-0 font-mono text-xs font-bold text-accent">{question.repeatCount}×</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.max(8, (question.repeatCount / max) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-muted">
              {question.yearsAppeared.join(" · ")}
              {question.marks ? ` · ${question.marks} marks` : ""}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
