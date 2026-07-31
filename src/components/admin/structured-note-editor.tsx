"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, PencilSimple, Plus, Trash } from "@phosphor-icons/react/dist/ssr";
import { updateStructuredNoteAction } from "@/lib/actions";
import type { StructuredNote, CalloutType, NoteSection } from "@/lib/note-schema";
import type { ThemeValues } from "@/lib/note-theme";
import { StructuredNoteRenderer } from "@/components/subjects/structured-note-renderer";

type Formula = StructuredNote["formulas"][number];
type Example = StructuredNote["examples"][number];
type Definition = StructuredNote["definitions"][number];

const CALLOUT_OPTIONS: { value: CalloutType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "definition", label: "Definition" },
  { value: "important", label: "Important" },
  { value: "warning", label: "Warning" },
  { value: "exam-tip", label: "Exam tip" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15";

// Hand-editing for the AI-generated structured note (src/lib/note-schema.ts)
// — regenerating from a fresh source replaces the whole note, this instead
// lets an admin fix a typo/fact/section without losing everything else.
// `visual` (the diagram) has no form here and is carried through unchanged
// on save; regenerate the note to change the diagram itself.
export function StructuredNoteEditor({
  subjectId,
  note,
  theme,
}: {
  subjectId: string;
  note: StructuredNote;
  theme: ThemeValues;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<StructuredNote>(note);
  const [tagsInput, setTagsInput] = useState(note.metadata.tags.join(", "));
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function patch(next: Partial<StructuredNote>) {
    setDraft((d) => ({ ...d, ...next }));
    setSaved(false);
  }
  function patchMeta(next: Partial<StructuredNote["metadata"]>) {
    setDraft((d) => ({ ...d, metadata: { ...d.metadata, ...next } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload: StructuredNote = {
        ...draft,
        metadata: {
          ...draft.metadata,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
            .slice(0, 8),
        },
      };
      const formData = new FormData();
      formData.set("subjectId", subjectId);
      formData.set("noteJson", JSON.stringify(payload));
      await updateStructuredNoteAction(formData);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this note.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "edit"}
            onClick={() => setMode("edit")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "edit" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"}`}
          >
            <PencilSimple size={14} weight="bold" /> Edit
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "preview"}
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${mode === "preview" ? "bg-accent-soft text-accent" : "text-muted hover:text-foreground"}`}
          >
            <Eye size={14} weight="bold" /> Preview
          </button>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved ✓" : "Save changes"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {mode === "preview" ? (
        <div
          className="max-h-[900px] overflow-y-auto overflow-x-hidden rounded-2xl border"
          style={{ borderColor: theme.colors.border, backgroundColor: theme.colors.background }}
        >
          <StructuredNoteRenderer note={draft} theme={theme} />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Title">
              <input className={inputClass} value={draft.metadata.title} onChange={(e) => patchMeta({ title: e.target.value })} />
            </Field>
            <Field label="Chapter">
              <input className={inputClass} value={draft.metadata.chapter} onChange={(e) => patchMeta({ chapter: e.target.value })} />
            </Field>
            <Field label="Estimated reading minutes">
              <input
                type="number"
                min={1}
                max={60}
                className={inputClass}
                value={draft.metadata.estimatedReadingMinutes}
                onChange={(e) => patchMeta({ estimatedReadingMinutes: Number(e.target.value) || 1 })}
              />
            </Field>
            <Field label="Tags (comma-separated)">
              <input className={inputClass} value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} />
            </Field>
          </div>

          <Field label="Summary">
            <textarea className={inputClass} rows={3} value={draft.summary} onChange={(e) => patch({ summary: e.target.value })} />
          </Field>

          <StringListEditor label="Key facts (3–7)" items={draft.keyFacts} onChange={(keyFacts) => patch({ keyFacts })} />

          <SectionsEditor sections={draft.sections} onChange={(sections) => patch({ sections })} />

          <DefinitionsEditor definitions={draft.definitions} onChange={(definitions) => patch({ definitions })} />

          <FormulasEditor formulas={draft.formulas} onChange={(formulas) => patch({ formulas })} />

          <ExamplesEditor examples={draft.examples} onChange={(examples) => patch({ examples })} />

          <StringListEditor
            label="Common mistakes"
            items={draft.commonMistakes}
            onChange={(commonMistakes) => patch({ commonMistakes })}
          />

          <Field label="Takeaway">
            <textarea className={inputClass} rows={2} value={draft.takeaway} onChange={(e) => patch({ takeaway: e.target.value })} />
          </Field>

          <StringListEditor label="Sources" items={draft.sources} onChange={(sources) => patch({ sources })} />
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</span>
      {children}
    </label>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="shrink-0 text-muted transition hover:text-red-500" aria-label="Remove">
      <Trash size={16} weight="bold" />
    </button>
  );
}

function AddButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} className="flex items-center gap-1 self-start text-xs font-semibold text-accent hover:underline">
      <Plus size={14} weight="bold" /> {label}
    </button>
  );
}

function StringListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: string[];
  onChange: (items: string[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          <textarea
            value={item}
            rows={1}
            onChange={(e) => {
              const next = [...items];
              next[i] = e.target.value;
              onChange(next);
            }}
            className={`${inputClass} flex-1`}
          />
          <RemoveButton onClick={() => onChange(items.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton label="Add" onClick={() => onChange([...items, ""])} />
    </div>
  );
}

function SectionsEditor({ sections, onChange }: { sections: NoteSection[]; onChange: (s: NoteSection[]) => void }) {
  function updateAt(i: number, next: Partial<NoteSection>) {
    const copy = [...sections];
    copy[i] = { ...copy[i], ...next };
    onChange(copy);
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Sections (1–8)</p>
      {sections.map((s, i) => (
        <div key={s.id || i} className="flex flex-col gap-2 rounded-xl border border-border p-4">
          <div className="flex items-center gap-2">
            <input
              value={s.heading}
              placeholder="Heading"
              onChange={(e) => updateAt(i, { heading: e.target.value })}
              className={`${inputClass} flex-1 font-semibold`}
            />
            <RemoveButton onClick={() => onChange(sections.filter((_, j) => j !== i))} />
          </div>
          <textarea
            value={s.content}
            placeholder="Section content"
            rows={3}
            onChange={(e) => updateAt(i, { content: e.target.value })}
            className={inputClass}
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={s.callout?.type ?? "none"}
              onChange={(e) => {
                const type = e.target.value as CalloutType;
                updateAt(i, { callout: type === "none" ? null : { type, text: s.callout?.text ?? "" } });
              }}
              className="rounded-lg border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-accent"
            >
              {CALLOUT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            {s.callout && s.callout.type !== "none" && (
              <input
                value={s.callout.text}
                placeholder="Callout text"
                onChange={(e) => updateAt(i, { callout: { type: s.callout!.type, text: e.target.value } })}
                className={`${inputClass} flex-1`}
              />
            )}
          </div>
        </div>
      ))}
      <AddButton
        label="Add section"
        onClick={() =>
          onChange([...sections, { id: `section-${sections.length + 1}-${Date.now()}`, heading: "", content: "", callout: null }])
        }
      />
    </div>
  );
}

function DefinitionsEditor({ definitions, onChange }: { definitions: Definition[]; onChange: (d: Definition[]) => void }) {
  function updateAt(i: number, next: Partial<Definition>) {
    const copy = [...definitions];
    copy[i] = { ...copy[i], ...next };
    onChange(copy);
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Definitions (up to 12)</p>
      {definitions.map((d, i) => (
        <div key={i} className="flex items-start gap-2">
          <input
            value={d.term}
            placeholder="Term"
            onChange={(e) => updateAt(i, { term: e.target.value })}
            className={`${inputClass} w-40 shrink-0 font-semibold`}
          />
          <textarea
            value={d.definition}
            placeholder="Definition"
            rows={1}
            onChange={(e) => updateAt(i, { definition: e.target.value })}
            className={`${inputClass} flex-1`}
          />
          <RemoveButton onClick={() => onChange(definitions.filter((_, j) => j !== i))} />
        </div>
      ))}
      <AddButton label="Add definition" onClick={() => onChange([...definitions, { term: "", definition: "" }])} />
    </div>
  );
}

function FormulasEditor({ formulas, onChange }: { formulas: Formula[]; onChange: (f: Formula[]) => void }) {
  function updateAt(i: number, next: Partial<Formula>) {
    const copy = [...formulas];
    copy[i] = { ...copy[i], ...next };
    onChange(copy);
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Formulas (up to 8)</p>
      {formulas.map((f, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <input
              value={f.name}
              placeholder="Name"
              onChange={(e) => updateAt(i, { name: e.target.value })}
              className={`${inputClass} flex-1 font-semibold`}
            />
            <RemoveButton onClick={() => onChange(formulas.filter((_, j) => j !== i))} />
          </div>
          <input
            value={f.expression}
            placeholder="Expression"
            onChange={(e) => updateAt(i, { expression: e.target.value })}
            className={`${inputClass} font-mono`}
          />
          <input
            value={f.description ?? ""}
            placeholder="Description (optional)"
            onChange={(e) => updateAt(i, { description: e.target.value || null })}
            className={inputClass}
          />
        </div>
      ))}
      <AddButton label="Add formula" onClick={() => onChange([...formulas, { name: "", expression: "", description: null }])} />
    </div>
  );
}

function ExamplesEditor({ examples, onChange }: { examples: Example[]; onChange: (e: Example[]) => void }) {
  function updateAt(i: number, next: Partial<Example>) {
    const copy = [...examples];
    copy[i] = { ...copy[i], ...next };
    onChange(copy);
  }
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-muted uppercase tracking-wide">Examples (up to 6)</p>
      {examples.map((ex, i) => (
        <div key={i} className="flex flex-col gap-2 rounded-xl border border-border p-3">
          <div className="flex items-center gap-2">
            <input
              value={ex.title ?? ""}
              placeholder="Title (optional)"
              onChange={(e) => updateAt(i, { title: e.target.value || null })}
              className={`${inputClass} flex-1 font-semibold`}
            />
            <RemoveButton onClick={() => onChange(examples.filter((_, j) => j !== i))} />
          </div>
          <textarea
            value={ex.prompt}
            placeholder="Prompt"
            rows={2}
            onChange={(e) => updateAt(i, { prompt: e.target.value })}
            className={inputClass}
          />
          <textarea
            value={ex.solution}
            placeholder="Solution"
            rows={2}
            onChange={(e) => updateAt(i, { solution: e.target.value })}
            className={inputClass}
          />
        </div>
      ))}
      <AddButton label="Add example" onClick={() => onChange([...examples, { title: null, prompt: "", solution: "" }])} />
    </div>
  );
}
