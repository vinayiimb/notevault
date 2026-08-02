"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartBar, Eye, Sparkle, Table, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { updateSubjectNotesAction, uploadResourceAction } from "@/lib/actions";
import { generateSubjectAnalysisAction } from "@/lib/subject-analysis-actions";
import { GamifiedLoader } from "@/components/ui/gamified-loader";
import { NotesRenderer, resolveNotesTheme } from "@/components/subjects/notes-renderer";

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
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mdInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(initialContent);
  const [dragOver, setDragOver] = useState(false);
  const [theme, setTheme] = useState(initialTheme);
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [hasPyqs, setHasPyqs] = useState(pyqCount > 0);
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");

  async function runGenerate() {
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
  }

  async function generate() {
    setGenerating(true);
    setGenError(null);
    try {
      await runGenerate();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Could not generate notes.");
    } finally {
      setGenerating(false);
    }
  }

  // Upload a PDF and immediately generate notes from it — one step instead
  // of filling in the separate "Upload a paper" form below, then coming
  // back up here to hit Generate.
  async function uploadAndGenerate(file: File) {
    setUploading(true);
    setGenError(null);
    try {
      const formData = new FormData();
      formData.set("subjectId", subjectId);
      formData.set("type", "PYQ");
      formData.set("title", file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim() || file.name);
      formData.set("file", file);
      const result = await uploadResourceAction(formData);
      if (!result || (result.status !== "created" && result.status !== "duplicate")) {
        setGenError("Upload failed. Try again.");
        return;
      }
      setHasPyqs(true);
      setUploading(false);
      setGenerating(true);
      await runGenerate();
      // Syncs the "Uploaded files" list and PYQ count below (a separate
      // server-rendered section) — safe to do after generating since this
      // component's own `content` state isn't reset by a prop refresh.
      router.refresh();
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Could not upload that file.");
    } finally {
      setUploading(false);
      setGenerating(false);
    }
  }

  // Loads an already-finished .md file (e.g. written elsewhere with an AI
  // chat) straight into the editor — no AI call, just reads the file's text
  // so it doesn't have to be opened and copy-pasted by hand. Still lands in
  // the textarea, not auto-saved, so it goes through the normal review-then-
  // Save-notes step below like any other edit.
  async function loadMarkdownFile(file: File) {
    setContent(await file.text());
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

  const busy = generating || uploading;

  function insertBlock(block: string) {
    setContent((current) => `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${block}\n`);
    setEditorMode("write");
    setSaved(false);
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs leading-5 text-muted">
          Build rich notes with headings, tables, analysis, flow diagrams, and data charts. Upload
          markdown or generate a first draft from readable PYQs, then review it before publishing.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface-muted disabled:opacity-40"
          >
            <UploadSimple size={14} weight="bold" />
            {uploading ? "Uploading..." : "Upload PDF & generate"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadAndGenerate(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => mdInputRef.current?.click()}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface-muted disabled:opacity-40"
          >
            <UploadSimple size={14} weight="bold" />
            Drop a .md file
          </button>
          <input
            ref={mdInputRef}
            type="file"
            accept=".md,.markdown,.txt,text/markdown,text/plain"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadMarkdownFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={generate}
            disabled={busy || !hasPyqs}
            title={!hasPyqs ? "Upload at least one PYQ first" : undefined}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface-muted disabled:opacity-40"
          >
            <Sparkle size={14} weight="bold" className="text-brand" />
            {generating ? "Generating..." : "Generate from uploaded PYQs"}
          </button>
        </div>
      </div>

      {genError && <p className="text-xs text-red-500">{genError}</p>}
      {generating && <GamifiedLoader size="sm" />}

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-surface-muted/55 px-3 py-2">
          <div className="flex items-center gap-1" role="tablist" aria-label="Notes editor view">
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "write"}
              onClick={() => setEditorMode("write")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${editorMode === "write" ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorMode === "preview"}
              onClick={() => setEditorMode("preview")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${editorMode === "preview" ? "bg-surface text-foreground" : "text-muted hover:text-foreground"}`}
            >
              <Eye size={14} weight="bold" />
              Preview
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-1 text-[11px] text-muted">Insert</span>
            <button
              type="button"
              onClick={() => insertBlock("## Analysis\n\n**Key finding:** Explain the pattern and why it matters.\n\n- Evidence:\n- Interpretation:\n- Exam takeaway:")}
              className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-accent"
            >
              Analysis
            </button>
            <button
              type="button"
              onClick={() => insertBlock("| Topic | Evidence | Exam priority |\n| --- | --- | --- |\n| Topic A | Add evidence | High |\n| Topic B | Add evidence | Medium |")}
              className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-accent"
            >
              <Table size={14} weight="bold" /> Table
            </button>
            <button
              type="button"
              onClick={() => insertBlock("```chart\ntype: bar\ntitle: Questions by unit\nlabels: Unit 1, Unit 2, Unit 3, Unit 4\nvalues: 4, 7, 5, 3\n```")}
              className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-accent"
            >
              <ChartBar size={14} weight="bold" /> Chart
            </button>
          </div>
        </div>

        {editorMode === "write" ? (
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setSaved(false);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) loadMarkdownFile(file);
            }}
            rows={18}
            placeholder="Write notes here, or drag and drop a .md file…"
            className={`block w-full resize-y border-0 px-4 py-3 font-mono text-sm leading-6 outline-none ${
              dragOver ? "bg-accent-soft/30" : "bg-background"
            }`}
          />
        ) : (
          <div className="max-h-[760px] min-h-72 overflow-y-auto bg-background p-4 sm:p-6">
            {content.trim() ? (
              <NotesRenderer content={content} theme={resolveNotesTheme(theme)} />
            ) : (
              <div className="flex min-h-64 items-center justify-center text-sm text-muted">
                Add some notes to see the published preview.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs leading-5 text-muted">
        Charts use a fenced <code className="rounded bg-surface-muted px-1 py-0.5">chart</code> block with
        matching comma-separated labels and values. Use <code className="rounded bg-surface-muted px-1 py-0.5">type: line</code> for a trend graph.
      </p>

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
