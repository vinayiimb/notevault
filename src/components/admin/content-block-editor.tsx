"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilSimple, Trash } from "@phosphor-icons/react";
import { updateContentBlockAction, deleteContentBlockAction } from "@/lib/actions";
import {
  BLOCK_TYPE_LABELS,
  createDefaultBlock,
  type StudyContentBlock,
  type StudyContentBlockType,
} from "@/lib/content/content-block-schema";
import { StudyContentRenderer } from "@/components/content/study-content-renderer";
import { BlockFieldsEditor } from "./block-fields-editor";

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as StudyContentBlockType[];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";
const labelClass = "text-xs font-medium text-muted";

export function ContentBlockEditor({
  id,
  initialLabel,
  initialDescription,
  initialCategory,
  initialTags,
  initialBlock,
}: {
  id: string;
  initialLabel: string;
  initialDescription: string;
  initialCategory: string;
  initialTags: string;
  initialBlock: StudyContentBlock;
}) {
  const router = useRouter();
  const [label, setLabel] = useState(initialLabel);
  const [description, setDescription] = useState(initialDescription);
  const [category, setCategory] = useState(initialCategory);
  const [tags, setTags] = useState(initialTags);
  const [block, setBlock] = useState<StudyContentBlock>(initialBlock);
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("id", id);
      formData.set("label", label);
      formData.set("description", description);
      formData.set("category", category);
      formData.set("tags", tags);
      formData.set("blockJson", JSON.stringify(block));
      await updateContentBlockAction(formData);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this block.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5" role="tablist">
          <button type="button" role="tab" aria-selected={mode === "edit"} onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === "edit" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}>
            <PencilSimple size={14} weight="bold" /> Edit
          </button>
          <button type="button" role="tab" aria-selected={mode === "preview"} onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${mode === "preview" ? "bg-accent text-accent-foreground" : "text-muted hover:text-foreground"}`}>
            <Eye size={14} weight="bold" /> Preview
          </button>
        </div>
        <div className="flex items-center gap-3">
          {error && <span className="text-xs text-red-600">{error}</span>}
          {saved && !error && <span className="text-xs text-notes-emerald-dark">Saved</span>}
          <form action={deleteContentBlockAction}>
            <input type="hidden" name="id" value={id} />
            <button type="submit" className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:hover:bg-red-950/30">
              <Trash size={14} weight="bold" /> Delete
            </button>
          </form>
          <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-50">
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {mode === "preview" ? (
        <div className="rounded-2xl border border-border bg-surface p-5">
          <StudyContentRenderer blocks={[block]} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <section className="rounded-xl border border-border bg-surface p-4">
            <h3 className="font-medium">Library metadata</h3>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Label"><input value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} /></Field>
              <Field label="Description (optional)"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} className={inputClass} /></Field>
              <div className="flex flex-wrap gap-3">
                <Field label="Category"><input value={category} onChange={(e) => setCategory(e.target.value)} className={`${inputClass} w-48`} /></Field>
                <Field label="Tags (comma-separated)"><input value={tags} onChange={(e) => setTags(e.target.value)} className={`${inputClass} w-64`} /></Field>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-medium">Block content</h3>
              <label className="flex items-center gap-2 text-xs text-muted">
                Type
                <select
                  value={block.type}
                  onChange={(e) => setBlock(createDefaultBlock(e.target.value as StudyContentBlockType, block.id))}
                  className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
                >
                  {BLOCK_TYPES.map((type) => (
                    <option key={type} value={type}>{BLOCK_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-3">
              <BlockFieldsEditor block={block} onChange={setBlock} />
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
