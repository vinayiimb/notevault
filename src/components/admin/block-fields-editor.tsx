"use client";

import type { StudyContentBlock } from "@/lib/content/content-block-schema";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";
const labelClass = "text-xs font-medium text-muted";

// Renders the type-specific form fields for one StudyContentBlock —
// shared by the per-question content editor's block list
// (src/components/admin/question-editor.tsx) and the single-block Content
// Blocks library editor (src/components/admin/content-block-editor.tsx),
// so both stay in sync as new block types are added.
export function BlockFieldsEditor({
  block,
  onChange,
}: {
  block: StudyContentBlock;
  onChange: (next: StudyContentBlock) => void;
}) {
  switch (block.type) {
    case "markdown":
      return (
        <Field label="Markdown content">
          <textarea
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            rows={6}
            className={inputClass}
          />
        </Field>
      );

    case "latex":
      return (
        <div className="flex flex-col gap-3">
          <Field label="LaTeX expression">
            <input
              value={block.expression}
              onChange={(e) => onChange({ ...block, expression: e.target.value })}
              placeholder="E_d = \frac{\%\Delta Q_d}{\%\Delta P}"
              className={`${inputClass} font-mono`}
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.displayMode}
              onChange={(e) => onChange({ ...block, displayMode: e.target.checked })}
              className="accent-accent"
            />
            Display as a centered block equation (not inline)
          </label>
        </div>
      );

    case "mermaid":
      return (
        <Field label="Mermaid diagram source">
          <textarea
            value={block.chart}
            onChange={(e) => onChange({ ...block, chart: e.target.value })}
            rows={6}
            className={`${inputClass} font-mono`}
          />
        </Field>
      );

    case "table":
      return (
        <div className="flex flex-col gap-3">
          <Field label="Headers (comma-separated)">
            <input
              value={block.headers.join(", ")}
              onChange={(e) => onChange({ ...block, headers: e.target.value.split(",").map((h) => h.trim()) })}
              className={inputClass}
            />
          </Field>
          <Field label="Rows (one per line, comma-separated cells)">
            <textarea
              value={block.rows.map((row) => row.join(", ")).join("\n")}
              onChange={(e) =>
                onChange({
                  ...block,
                  rows: e.target.value.split("\n").map((line) => line.split(",").map((cell) => cell.trim())),
                })
              }
              rows={4}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Caption (optional)">
            <input
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
              className={inputClass}
            />
          </Field>
        </div>
      );

    case "chart":
      return (
        <div className="flex flex-col gap-3">
          <Field label="Title">
            <input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Chart type">
            <select
              value={block.chartType}
              onChange={(e) => onChange({ ...block, chartType: e.target.value as typeof block.chartType })}
              className={inputClass}
            >
              <option value="bar">Bar</option>
              <option value="line">Line</option>
              <option value="area">Area</option>
              <option value="pie">Pie</option>
              <option value="donut">Donut</option>
            </select>
          </Field>
          <Field label="Labels (comma-separated)">
            <input
              value={block.labels.join(", ")}
              onChange={(e) => onChange({ ...block, labels: e.target.value.split(",").map((l) => l.trim()) })}
              className={inputClass}
            />
          </Field>
          <Field label="Values (comma-separated numbers)">
            <input
              value={block.values.join(", ")}
              onChange={(e) =>
                onChange({ ...block, values: e.target.value.split(",").map((v) => Number(v.trim()) || 0) })
              }
              className={inputClass}
            />
          </Field>
        </div>
      );

    case "image":
      return (
        <div className="flex flex-col gap-3">
          <Field label="Image URL">
            <input value={block.src} onChange={(e) => onChange({ ...block, src: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Alt text (required)">
            <input value={block.alt} onChange={(e) => onChange({ ...block, alt: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Caption (optional)">
            <input
              value={block.caption ?? ""}
              onChange={(e) => onChange({ ...block, caption: e.target.value || undefined })}
              className={inputClass}
            />
          </Field>
          <Field label="Source attribution (optional)">
            <input
              value={block.source ?? ""}
              onChange={(e) => onChange({ ...block, source: e.target.value || undefined })}
              className={inputClass}
            />
          </Field>
        </div>
      );

    case "pdf":
      return (
        <div className="flex flex-col gap-3">
          <Field label="Title">
            <input value={block.title} onChange={(e) => onChange({ ...block, title: e.target.value })} className={inputClass} />
          </Field>
          <Field label="PDF URL">
            <input value={block.url} onChange={(e) => onChange({ ...block, url: e.target.value })} className={inputClass} />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={block.downloadable}
              onChange={(e) => onChange({ ...block, downloadable: e.target.checked })}
              className="accent-accent"
            />
            Show a download button
          </label>
        </div>
      );

    case "callout":
      return (
        <div className="flex flex-col gap-3">
          <Field label="Variant">
            <select
              value={block.variant}
              onChange={(e) => onChange({ ...block, variant: e.target.value as typeof block.variant })}
              className={inputClass}
            >
              <option value="info">Info</option>
              <option value="important">Important</option>
              <option value="warning">Warning</option>
              <option value="tip">Tip</option>
              <option value="definition">Definition</option>
            </select>
          </Field>
          <Field label="Title (optional)">
            <input
              value={block.title ?? ""}
              onChange={(e) => onChange({ ...block, title: e.target.value || undefined })}
              className={inputClass}
            />
          </Field>
          <Field label="Content">
            <textarea
              value={block.content}
              onChange={(e) => onChange({ ...block, content: e.target.value })}
              rows={3}
              className={inputClass}
            />
          </Field>
        </div>
      );

    case "quiz":
      return (
        <div className="flex flex-col gap-3">
          <Field label="Question">
            <input value={block.question} onChange={(e) => onChange({ ...block, question: e.target.value })} className={inputClass} />
          </Field>
          <Field label="Options (one per line)">
            <textarea
              value={block.options.join("\n")}
              onChange={(e) => onChange({ ...block, options: e.target.value.split("\n") })}
              rows={4}
              className={inputClass}
            />
          </Field>
          <Field label="Correct option (0-indexed)">
            <input
              type="number"
              min={0}
              value={block.correctAnswer}
              onChange={(e) => onChange({ ...block, correctAnswer: Number(e.target.value) || 0 })}
              className={`${inputClass} w-24`}
            />
          </Field>
          <Field label="Explanation (optional)">
            <textarea
              value={block.explanation ?? ""}
              onChange={(e) => onChange({ ...block, explanation: e.target.value || undefined })}
              rows={2}
              className={inputClass}
            />
          </Field>
        </div>
      );
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  );
}
