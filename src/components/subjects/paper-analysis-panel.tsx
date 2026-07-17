"use client";

import { useState, useTransition } from "react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { generateSubjectAnalysisAction } from "@/lib/subject-analysis-actions";

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
  const [showPrediction, setShowPrediction] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState(generatedAt);

  function run(withPrediction: boolean) {
    setError(null);
    setShowPrediction(withPrediction);
    startTransition(async () => {
      const result = await generateSubjectAnalysisAction(subjectId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnalysis(result.data);
      setLastGenerated(new Date().toLocaleString());
    });
  }

  if (pyqCount === 0) return null;

  return (
    <section className="mt-10 rounded-2xl border border-border bg-surface p-6">
      <h2 className="flex items-center gap-2 text-lg font-medium">
        <Sparkle size={20} weight="bold" className="text-brand" />
        AI paper analysis
      </h2>
      <p className="mt-1 text-sm text-muted">
        Reads every uploaded PYQ for this subject, compiles study notes, and flags the most
        repeated questions.
      </p>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => run(false)}
          disabled={isPending}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition hover:opacity-90 disabled:opacity-50"
        >
          {isPending && !showPrediction
            ? "Analyzing..."
            : analysis
              ? "Regenerate compiled notes"
              : "Generate compiled notes"}
        </button>
        <button
          type="button"
          onClick={() => run(true)}
          disabled={isPending}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted disabled:opacity-50"
        >
          {isPending && showPrediction ? "Analyzing..." : "Notes + Paper Prediction"}
        </button>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
      {lastGenerated && !isPending && (
        <p className="mt-2 text-xs text-muted">Last generated {lastGenerated}</p>
      )}

      {analysis && (
        <div className="mt-6 flex flex-col gap-6">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Compiled notes
            </h3>
            <div className="mt-2 whitespace-pre-wrap rounded-xl bg-background p-4 text-sm">
              {analysis.compiledNotes}
            </div>
          </div>

          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
              Most repeated questions
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {analysis.mostRepeated.map((q, i) => (
                <div key={i} className="rounded-xl bg-background p-3 text-sm">
                  <p className="font-medium">{q.questionText}</p>
                  <p className="mt-1 text-xs text-muted">
                    {q.topic} · seen {q.repeatCount}x ({q.yearsAppeared.join(", ")})
                    {q.marks ? ` · ${q.marks} marks` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {showPrediction && (
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">
                Predicted paper
              </h3>
              <p className="mt-1 text-xs text-muted">
                A best-effort prediction based on the repetition pattern above — not a guarantee.
              </p>
              <div className="mt-2 flex flex-col gap-2">
                {analysis.predictedPaper.map((q, i) => (
                  <div key={i} className="rounded-xl bg-background p-3 text-sm">
                    <p className="font-medium">
                      {q.questionText}
                      {q.marks ? ` (${q.marks} marks)` : ""}
                    </p>
                    <p className="mt-1 text-xs text-muted">{q.reasoning}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
