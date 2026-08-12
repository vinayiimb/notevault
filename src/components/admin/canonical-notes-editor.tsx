"use client";

import { useRef, useState } from "react";
import { Eye, UploadSimple } from "@phosphor-icons/react/dist/ssr";
import { updateCanonicalSubjectNoteAction } from "@/lib/actions";
import { NotesRenderer, resolveNotesTheme } from "@/components/subjects/notes-renderer";

const THEMES = [
  { value: "sky", label: "Sky", dot: "bg-sky-dark" },
  { value: "violet", label: "Violet", dot: "bg-notes-violet-dark" },
  { value: "emerald", label: "Emerald", dot: "bg-notes-emerald-dark" },
  { value: "amber", label: "Amber", dot: "bg-notes-amber-dark" },
] as const;

export function CanonicalNotesEditor({
  programmeSlug,
  programme,
  subjectSlug,
  subject,
  initialContent,
  initialTheme,
}: {
  programmeSlug: string;
  programme: string;
  subjectSlug: string;
  subject: string;
  initialContent: string;
  initialTheme: string;
}) {
  const mdInputRef = useRef<HTMLInputElement>(null);
  const [content, setContent] = useState(initialContent);
  const [theme, setTheme] = useState(initialTheme);
  const [dragOver, setDragOver] = useState(false);
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadMarkdownFile(file: File) {
    setContent(await file.text());
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
