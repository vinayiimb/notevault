"use client";

import { useRef, useState, useTransition } from "react";
import { FileArrowUp } from "@phosphor-icons/react/dist/ssr";
import { extractPdfText } from "@/lib/pdf-client";
import { awardExamKitSessionAction } from "@/lib/student-actions";
import { FlashcardsMode } from "@/components/exam-kit/modes/flashcards-mode";
import { QuizMode } from "@/components/exam-kit/modes/quiz-mode";
import { BlanksMode } from "@/components/exam-kit/modes/blanks-mode";
import { ConceptMapMode } from "@/components/exam-kit/modes/concept-map-mode";
import { SkeletonMode } from "@/components/exam-kit/modes/skeleton-mode";
import { DevilsAdvocateMode } from "@/components/exam-kit/modes/devils-advocate-mode";

const MODES = [
  { key: "flashcards", label: "Flashcards" },
  { key: "quiz", label: "Quiz" },
  { key: "blanks", label: "Fill blanks" },
  { key: "concept", label: "Concept map" },
  { key: "skeleton", label: "Skeleton answer" },
  { key: "devil", label: "Devil's advocate" },
] as const;

type ModeKey = (typeof MODES)[number]["key"];

export function ExamKitClient() {
  const [notes, setNotes] = useState("");
  const [subject, setSubject] = useState("");
  const [stage, setStage] = useState<"input" | "study">("input");
  const [activeMode, setActiveMode] = useState<ModeKey>("flashcards");
  const [pdfStatus, setPdfStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  async function handlePdfChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPdfStatus("Extracting text...");
    try {
      const text = await extractPdfText(file);
      if (text.length < 40) {
        setPdfStatus(
          "That PDF looks like a scan with no selectable text. Use the Restore tool first, then paste the text here."
        );
        return;
      }
      setNotes(text.slice(0, 15000));
      setPdfStatus(`Loaded text from ${file.name}`);
    } catch {
      setPdfStatus("Could not read that PDF.");
    }
  }

  if (stage === "input") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Your notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={10}
            placeholder="Paste your notes, textbook excerpts, or class material here..."
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
          <p className="text-xs text-muted">{notes.length.toLocaleString()} characters</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs uppercase text-muted">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 text-sm text-muted transition hover:border-accent hover:text-foreground"
        >
          <FileArrowUp size={18} weight="bold" />
          Upload a PDF of your notes
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handlePdfChange}
        />
        {pdfStatus && <p className="text-xs text-muted">{pdfStatus}</p>}

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Subject (optional)</label>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="e.g. Financial Accounting, Marketing Management"
            className="rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>

        <button
          type="button"
          disabled={notes.trim().length < 80}
          onClick={() => {
            setStage("study");
            startTransition(() => {
              awardExamKitSessionAction();
            });
          }}
          className="mt-2 self-start rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-40"
        >
          Continue to Exam Kit
        </button>
        {notes.trim().length > 0 && notes.trim().length < 80 && (
          <p className="text-xs text-muted">
            Add at least a paragraph of notes to continue.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setStage("input")}
          className="text-sm text-muted hover:text-foreground"
        >
          &larr; New notes
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
        {MODES.map((mode) => (
          <button
            key={mode.key}
            type="button"
            onClick={() => setActiveMode(mode.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              activeMode === mode.key
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-muted hover:text-foreground"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeMode === "flashcards" && <FlashcardsMode notes={notes} subject={subject} />}
        {activeMode === "quiz" && <QuizMode notes={notes} subject={subject} />}
        {activeMode === "blanks" && <BlanksMode notes={notes} subject={subject} />}
        {activeMode === "concept" && <ConceptMapMode notes={notes} subject={subject} />}
        {activeMode === "skeleton" && <SkeletonMode notes={notes} subject={subject} />}
        {activeMode === "devil" && <DevilsAdvocateMode notes={notes} subject={subject} />}
      </div>
    </div>
  );
}
