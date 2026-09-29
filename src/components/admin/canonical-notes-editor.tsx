"use client";

import { useRef, useState } from "react";
import { ChartBar, Eye, FlowArrow, Table, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { updateCanonicalSubjectNoteAction } from "@/lib/actions";
import { NotesRenderer, resolveNotesTheme } from "@/components/subjects/notes-renderer";

const THEMES = [
  { value: "sky", label: "Sky", dot: "bg-sky-dark" },
  { value: "violet", label: "Violet", dot: "bg-notes-violet-dark" },
  { value: "emerald", label: "Emerald", dot: "bg-notes-emerald-dark" },
  { value: "amber", label: "Amber", dot: "bg-notes-amber-dark" },
] as const;

const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const MERMAID_TEMPLATE = "```mermaid\nflowchart TD\n    A[Start topic] --> B{Key decision?}\n    B -->|Yes| C[Outcome 1]\n    B -->|No| D[Outcome 2]\n```";

export function CanonicalNotesEditor({
  programmeSlug,
  programme,
  subjectSlug,
  subject,
  initialContent,
  initialTheme,
  initialSemester,
}: {
  programmeSlug: string;
  programme: string;
  subjectSlug: string;
  subject: string;
  initialContent: string;
  initialTheme: string;
  initialSemester: number | null;
}) {
  const mdInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(initialContent);
  const [theme, setTheme] = useState(initialTheme);
  const [semester, setSemester] = useState<string>(initialSemester ? String(initialSemester) : "");
  const [dragOver, setDragOver] = useState(false);
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadMarkdownFile(file: File) {
    setContent(await file.text());
    setSaved(false);
  }

  function insertBlock(block: string) {
    setContent((current) => `${current.trimEnd()}${current.trim() ? "\n\n" : ""}${block}\n`);
    setEditorMode("write");
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      const formData = new FormData();
      formData.set("programmeSlug", programmeSlug);
      formData.set("programme", programme);
      formData.set("subjectSlug", subjectSlug);
      formData.set("subject", subject);
      formData.set("content", content);
      formData.set("theme", theme);
      formData.set("semester", semester);
      await updateCanonicalSubjectNoteAction(formData);
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-xs leading-5 text-muted">
          Drop a finished .md file (written elsewhere) or write notes directly. Nothing is live until you
          click Save.
        </p>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => mdInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-surface-muted"
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
        </div>
      </div>

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
            <button
              type="button"
              onClick={() => insertBlock(MERMAID_TEMPLATE)}
              className="flex items-center gap-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium hover:border-accent"
            >
              <FlowArrow size={14} weight="bold" /> Flowchart
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
            rows={22}
            placeholder="Write notes here, or drag and drop a .md file…"
            className={`block w-full resize-y border-0 px-4 py-3 font-mono text-sm leading-6 outline-none ${
              dragOver ? "bg-accent-soft/30" : "bg-background"
            }`}
          />
        ) : (
          <div className="max-h-[760px] min-h-72 overflow-y-auto bg-background p-4 sm:p-6">
            {content.trim() ? (
              <NotesRenderer content={content} theme={resolveNotesTheme(theme)} resolvedTheme={null} />
            ) : (
              <div className="flex min-h-64 items-center justify-center text-sm text-muted">
                Add some notes to see the published preview.
              </div>
            )}
          </div>
        )}
      </div>

      <p className="text-xs leading-5 text-muted">
        Charts use a fenced <code className="rounded bg-surface-muted px-1 py-0.5">chart</code> block;
        flowcharts use a fenced <code className="rounded bg-surface-muted px-1 py-0.5">mermaid</code> block
        (Mermaid flowchart/sequence/mindmap syntax) — both render as interactive diagrams on the published
        page, not just in this preview.
      </p>

      <div className="flex flex-wrap items-start gap-8">
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

        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted" htmlFor="canonical-note-semester">
            Semester
          </label>
          <select
            id="canonical-note-semester"
            value={semester}
            onChange={(e) => {
              setSemester(e.target.value);
              setSaved(false);
            }}
            className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
          >
            <option value="">Not set</option>
            {SEMESTERS.map((s) => (
              <option key={s} value={s}>
                Semester {s}
              </option>
            ))}
          </select>
          <p className="max-w-[220px] text-[11px] leading-4 text-muted">
            Groups this subject under &quot;Sem {semester || "…"}&quot; on the public notes page.
          </p>
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
