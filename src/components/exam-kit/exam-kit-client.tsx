"use client";

import { useRef, useState, useTransition } from "react";
import { ArrowLeft, FileArrowUp, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { extractPdfText } from "@/lib/pdf-client";
import { awardExamKitSessionAction } from "@/lib/student-actions";
import { FlashcardsMode } from "@/components/exam-kit/modes/flashcards-mode";
import { QuizMode } from "@/components/exam-kit/modes/quiz-mode";
import { BlanksMode } from "@/components/exam-kit/modes/blanks-mode";
import { ConceptMapMode } from "@/components/exam-kit/modes/concept-map-mode";
import { SkeletonMode } from "@/components/exam-kit/modes/skeleton-mode";
import { DevilsAdvocateMode } from "@/components/exam-kit/modes/devils-advocate-mode";

const MODES = [
  { key: "flashcards", label: "Flashcards", description: "Fast recall" },
  { key: "quiz", label: "Quiz", description: "Check understanding" },
  { key: "blanks", label: "Fill blanks", description: "Terms and facts" },
  { key: "concept", label: "Concept map", description: "Connect ideas" },
  { key: "skeleton", label: "Answer builder", description: "Plan long answers" },
  { key: "devil", label: "Debate mode", description: "Stress-test arguments" },
] as const;

const SAMPLE_NOTES = `Inflation is a sustained increase in the general price level. Demand-pull inflation occurs when aggregate demand grows faster than productive capacity. Cost-push inflation follows an increase in production costs such as wages, energy, or imported inputs. Central banks commonly respond through monetary policy by raising interest rates, which can reduce borrowing and demand. However, tighter policy may also slow output and employment. The Consumer Price Index measures changes in the cost of a representative basket, while core inflation excludes volatile food and energy prices.`;

type ModeKey = (typeof MODES)[number]["key"];

export function ExamKitClient() {
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [stage, setStage] = useState<"input" | "study">("input");
  const [activeMode, setActiveMode] = useState<ModeKey>("flashcards");
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  async function loadPdf(file: File) {
    setPdfStatus("Reading your PDF…");
    try {
      const text = await extractPdfText(file);
      if (text.length < 40) {
        setPdfStatus("This PDF appears to be a scan without selectable text. OCR it first, or paste the notes below.");
        return;
      }
      setNotes(text.slice(0, 15000));
      setPdfStatus(`Ready: ${file.name}`);
    } catch {
      setPdfStatus("We could not read that PDF. Try another file or paste the text.");
    }
  }

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) await loadPdf(file);
    e.target.value = "";
  }

  if (stage === "input") {
    const canContinue = notes.trim().length >= 80;
    return (
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <section className="overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-5 py-4 sm:px-6">
            <h2 className="font-semibold">Add your source material</h2>
            <p className="mt-1 text-sm text-muted">Everything generated stays grounded in the notes you provide.</p>
          </div>
          <div className="p-5 sm:p-6">
            <label htmlFor="exam-kit-subject" className="text-sm font-semibold">Subject <span className="font-normal text-muted">(optional)</span></label>
            <input
              id="exam-kit-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Financial Accounting"
              className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
            />

            <div className="mt-5 flex items-center justify-between gap-3">
              <label htmlFor="exam-kit-notes" className="text-sm font-semibold">Your notes</label>
              <button
                type="button"
                onClick={() => {
                  setSubject("Economics");
                  setNotes(SAMPLE_NOTES);
                  setPdfStatus(null);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:underline"
              >
                <Sparkle size={14} weight="bold" /> Try sample notes
              </button>
            </div>
            <textarea
              id="exam-kit-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 15000))}
              rows={13}
              placeholder="Paste class notes, a chapter summary, or textbook excerpts here…"
              className="mt-2 w-full resize-y rounded-lg border border-border bg-background px-4 py-3 text-sm leading-6 outline-none focus:border-accent"
            />
            <div className="mt-2 flex items-center justify-between text-xs text-muted">
              <span>{notes.trim().length < 80 ? "At least 80 characters needed" : "Enough material to build your kit"}</span>
              <span className="font-mono">{notes.length.toLocaleString()} / 15,000</span>
            </div>

            <div className="my-5 flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted">or upload</span>
              <span className="h-px flex-1 bg-border" />
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOver(false);
                const file = event.dataTransfer.files?.[0];
                if (file?.type === "application/pdf") loadPdf(file);
                else setPdfStatus("Choose a PDF file with selectable text.");
              }}
              className={`flex w-full items-center justify-center gap-3 rounded-xl border border-dashed px-4 py-5 text-sm font-medium ${
                dragOver ? "border-accent bg-accent-soft text-accent" : "border-border text-muted hover:border-accent hover:text-foreground"
              }`}
            >
              <FileArrowUp size={20} weight="bold" />
              Drop a PDF here, or choose a file
            </button>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfChange} />
            {pdfStatus && <p role="status" className="mt-2 text-xs text-muted">{pdfStatus}</p>}

            <button
              type="button"
              disabled={!canContinue}
              onClick={() => {
                setStage("study");
                startTransition(() => { awardExamKitSessionAction(); });
              }}
              className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-accent-foreground hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
            >
              Build my exam kit
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </section>

        <aside className="rounded-2xl bg-surface-muted p-5 lg:sticky lg:top-24 lg:self-start">
          <h2 className="font-semibold">One source, six ways to study</h2>
          <ol className="mt-4 space-y-4">
            <li>
              <p className="text-sm font-semibold">Recall the material</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">Flashcards, quizzes, and fill-in-the-blank drills.</p>
            </li>
            <li>
              <p className="text-sm font-semibold">Understand relationships</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">Connect key ideas and explain how they influence one another.</p>
            </li>
            <li>
              <p className="text-sm font-semibold">Prepare written answers</p>
              <p className="mt-0.5 text-xs leading-5 text-muted">Build essay structures and test arguments before the exam.</p>
            </li>
          </ol>
          <p className="mt-5 border-t border-border pt-4 text-xs leading-5 text-muted">PDF text is processed for this study session. Scanned image-only PDFs need OCR first.</p>
        </aside>
      </div>
    );
  }

  const active = MODES.find((mode) => mode.key === activeMode)!;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface lg:grid lg:grid-cols-[14rem_minmax(0,1fr)]">
      <aside className="border-b border-border bg-surface-muted/45 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 lg:block lg:px-5 lg:py-5">
          <div>
            <p className="truncate text-sm font-semibold">{subject.trim() || "My exam kit"}</p>
            <p className="mt-0.5 text-xs text-muted">{notes.length.toLocaleString()} characters</p>
          </div>
          <button type="button" onClick={() => setStage("input")} className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground lg:mt-4">
            <ArrowLeft size={14} weight="bold" /> Change notes
          </button>
        </div>
        <nav className="flex overflow-x-auto p-2 lg:flex-col" aria-label="Exam Kit modes">
          {MODES.map((mode) => (
            <button
              key={mode.key}
              type="button"
              aria-current={activeMode === mode.key ? "page" : undefined}
              onClick={() => setActiveMode(mode.key)}
              className={`min-w-max rounded-lg px-3 py-2.5 text-left lg:w-full ${
                activeMode === mode.key ? "bg-surface text-accent" : "text-muted hover:bg-surface hover:text-foreground"
              }`}
            >
              <span className="block text-sm font-semibold">{mode.label}</span>
              <span className="mt-0.5 hidden text-xs lg:block">{mode.description}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="min-w-0 p-4 sm:p-6 lg:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold">{active.label}</h2>
          <p className="mt-1 text-sm text-muted">{active.description}, generated only from your source material.</p>
        </div>
        {activeMode === "flashcards" && <FlashcardsMode notes={notes} subject={subject} />}
        {activeMode === "quiz" && <QuizMode notes={notes} subject={subject} />}
        {activeMode === "blanks" && <BlanksMode notes={notes} subject={subject} />}
        {activeMode === "concept" && <ConceptMapMode notes={notes} subject={subject} />}
        {activeMode === "skeleton" && <SkeletonMode notes={notes} subject={subject} />}
        {activeMode === "devil" && <DevilsAdvocateMode notes={notes} subject={subject} />}
      </section>
    </div>
  );
}
