"use client";

import { useState } from "react";
import { Sparkle } from "@phosphor-icons/react/dist/ssr";
import { updateSubjectNotesAction } from "@/lib/actions";
import { generateSubjectAnalysisAction } from "@/lib/subject-analysis-actions";

const THEMES = [
  { value: "sky", label: "Sky", dot: "bg-sky-dark" },
  { value: "violet", label: "Violet", dot: "bg-notes-violet-dark" },
  { value: "emerald", label: "Emerald", dot: "bg-notes-emerald-dark" },
  { value: "amber", label: "Amber", dot: "bg-notes-amber-dark" },
] as const;

export function NotesEditor({
  subjectId,
  initialContent,
  initialTheme,
  pyqCount,
}: {
  subjectId: string;
  initialContent: string;
  initialTheme: string;
  pyqCount: number;
}) {
  const [content, setContent] = useState(initialContent);
  const [theme, setTheme] = useState(initialTheme);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      const result = await generateSubjectAnalysisAction(subjectId);
      if (!result.ok) {
        setGenError(result.error);
        return;
      }
      if (!result.data.compiledNotes.trim()) {
        setGenError("The AI didn't return any notes — try again, or check the uploaded PDFs have readable text.");
        return;
      }
      setContent(result.data.compiledNotes);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Could not generate notes.");
    } finally {
      setGenerating(false);
    }
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("subjectId", subjectId);
      formData.set("content", content);
      formData.set("theme", theme);
      await updateSubjectNotesAction(formData);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          Paste text (plain or markdown — bold section headings like{" "}
          <strong>**I. Section Title**</strong> become real headings automatically), or generate
          a first draft from this subject&apos;s uploaded PYQs below.
        </p>
        <button
          type="button"
          onClick={generate}
          disabled={generating || pyqCount === 0}
          title={pyqCount === 0 ? "Upload at least one PYQ first" : undefined}
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface-muted disabled:opacity-40"
        >
          <Sparkle size={14} weight="bold" className="text-brand" />
          {generating ? "Generating..." : "Generate from uploaded PYQs"}
        </button>
      </div>

      {genError && <p className="text-xs text-red-500">{genError}</p>}

      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        rows={12}
        placeholder="Paste your notes here..."
        className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm focus:border-accent focus:outline-none"
      />

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted">Color theme</label>
        <div className="flex gap-3">
          {THEMES.map((opt) => (
            <label key={opt.value} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name="theme"
                value={opt.value}
                checked={theme === opt.value}
                onChange={() => setTheme(opt.value)}
                className="accent-accent"
              />
              <span className={`size-3 rounded-full ${opt.dot}`} />
              {opt.label}
            </label>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="self-start rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved ✓" : "Save notes"}
      </button>
    </div>
  );
}
