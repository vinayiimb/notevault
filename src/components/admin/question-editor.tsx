"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilSimple } from "@phosphor-icons/react";
import { updateQuestionAction } from "@/lib/actions";
import { StudyContentBlockListSchema, type StudyContentBlock } from "@/lib/content/content-block-schema";
import { StudyContentRenderer } from "@/components/content/study-content-renderer";
import { BlockListEditor } from "./block-list-editor";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";
const labelClass = "text-xs font-medium text-muted";

export type EditableQuestion = {
  id: string;
  subjectId: string;
  questionText: string;
  answerText: string;
  marks: number | null;
  years: string | null;
  isRepeated: boolean;
  repeatCount: number;
  resourceId: string | null;
  questionNumber: string | null;
  section: string | null;
  rawOcrText: string | null;
  topics: string[];
  difficulty: "EASY" | "MEDIUM" | "HARD" | null;
  contentBlocks: unknown;
};

// Full per-question editor: OCR review + metadata fields + a rich
// contentBlocks list (Phase G's StudyContentBlock system), with a live
// preview rendered through the exact same StudyContentRenderer students see
// on the PYQ reading page's Solutions/Practice tabs.
export function QuestionEditor({
  question,
  resourceOptions,
}: {
  question: EditableQuestion;
  resourceOptions: { id: string; title: string; year: number | null }[];
}) {
  const router = useRouter();
  const parsedBlocks = StudyContentBlockListSchema.safeParse(question.contentBlocks);

  const [questionText, setQuestionText] = useState(question.questionText);
  const [answerText, setAnswerText] = useState(question.answerText);
  const [marks, setMarks] = useState(question.marks?.toString() ?? "");
  const [years, setYears] = useState(question.years ?? "");
  const [isRepeated, setIsRepeated] = useState(question.isRepeated);
  const [repeatCount, setRepeatCount] = useState(question.repeatCount);
  const [resourceId, setResourceId] = useState(question.resourceId ?? "");
  const [questionNumber, setQuestionNumber] = useState(question.questionNumber ?? "");
  const [section, setSection] = useState(question.section ?? "");
  const [rawOcrText, setRawOcrText] = useState(question.rawOcrText ?? "");
  const [topics, setTopics] = useState(question.topics.join(", "));
  const [difficulty, setDifficulty] = useState(question.difficulty ?? "");
  const [blocks, setBlocks] = useState<StudyContentBlock[]>(parsedBlocks.success ? parsedBlocks.data : []);

  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("id", question.id);
      formData.set("subjectId", question.subjectId);
      formData.set("questionText", questionText);
      formData.set("answerText", answerText);
      formData.set("marks", marks);
      formData.set("years", years);
      if (isRepeated) formData.set("isRepeated", "on");
      formData.set("repeatCount", String(repeatCount));
      formData.set("resourceId", resourceId);
      formData.set("questionNumber", questionNumber);
      formData.set("section", section);
      formData.set("rawOcrText", rawOcrText);
      formData.set("topics", topics);
      formData.set("difficulty", difficulty);
      formData.set("contentBlocksJson", JSON.stringify(blocks));
      await updateQuestionAction(formData);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this question.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === "edit" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <PencilSimple size={14} weight="bold" /> Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              mode === "preview" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            <Eye size={14} weight="bold" /> Preview
          </button>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-600">{error}</span>}
          {saved && !error && <span className="text-xs text-notes-emerald-dark">Saved</span>}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <p className="text-xs font-semibold tracking-wide text-muted uppercase">Question</p>
          <p className="mt-1 text-foreground">{questionText}</p>
          <p className="mt-4 text-xs font-semibold tracking-wide text-muted uppercase">Answer</p>
          <p className="mt-1 text-foreground">{answerText}</p>
          {blocks.length > 0 && (
            <div className="mt-5 border-t border-border pt-5">
              <StudyContentRenderer blocks={blocks} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h3 className="font-medium">Question &amp; answer</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Question text">
                <textarea value={questionText} onChange={(e) => setQuestionText(e.target.value)} rows={2} className={inputClass} />
              </Field>
              <Field label="Answer text">
                <textarea value={answerText} onChange={(e) => setAnswerText(e.target.value)} rows={4} className={inputClass} />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <Field label="Marks"><input value={marks} onChange={(e) => setMarks(e.target.value)} type="number" className={`${inputClass} w-20`} /></Field>
                <Field label="Years appeared"><input value={years} onChange={(e) => setYears(e.target.value)} placeholder="2021, 2023" className={`${inputClass} w-48`} /></Field>
                <Field label="# times repeated"><input value={repeatCount} onChange={(e) => setRepeatCount(Number(e.target.value) || 1)} type="number" className={`${inputClass} w-20`} /></Field>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" checked={isRepeated} onChange={(e) => setIsRepeated(e.target.checked)} className="accent-accent" />
                  Frequently repeated
                </label>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h3 className="font-medium">Paper metadata &amp; OCR</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Linked paper (powers the Solutions/Practice tabs on that paper's reading page)">
                <select value={resourceId} onChange={(e) => setResourceId(e.target.value)} className={inputClass}>
                  <option value="">Not linked to a specific paper</option>
                  {resourceOptions.map((r) => (
                    <option key={r.id} value={r.id}>{r.year ? `${r.year} — ` : ""}{r.title}</option>
                  ))}
                </select>
              </Field>
              <div className="flex flex-wrap gap-3">
                <Field label="Question number"><input value={questionNumber} onChange={(e) => setQuestionNumber(e.target.value)} placeholder="3(a)" className={`${inputClass} w-32`} /></Field>
                <Field label="Section"><input value={section} onChange={(e) => setSection(e.target.value)} placeholder="Section A" className={`${inputClass} w-40`} /></Field>
                <Field label="Difficulty">
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)} className={`${inputClass} w-32`}>
                    <option value="">—</option>
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </Field>
              </div>
              <Field label="Topics (comma-separated)">
                <input value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="Elasticity, Demand curve" className={inputClass} />
              </Field>
              <Field label="Raw OCR text (unedited, for reference/search)">
                <textarea value={rawOcrText} onChange={(e) => setRawOcrText(e.target.value)} rows={4} className={`${inputClass} font-mono text-xs`} />
              </Field>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <h3 className="font-medium">Answer content blocks</h3>
            <p className="mt-1 text-xs text-muted">
              Rich content shown on the Solutions/Practice tabs alongside the plain answer text above — LaTeX, tables, diagrams, charts, images, embedded PDFs, callouts, and practice questions.
            </p>
            <div className="mt-3">
              <BlockListEditor blocks={blocks} onChange={setBlocks} />
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
