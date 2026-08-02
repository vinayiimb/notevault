"use client";

import { useState } from "react";
import { Trash } from "@phosphor-icons/react";
import {
  BLOCK_TYPE_LABELS,
  createDefaultBlock,
  type StudyContentBlock,
  type StudyContentBlockType,
} from "@/lib/content/content-block-schema";
import { BlockFieldsEditor } from "./block-fields-editor";

const BLOCK_TYPES = Object.keys(BLOCK_TYPE_LABELS) as StudyContentBlockType[];

// Manages an ordered list of StudyContentBlocks — the content-blocks editor
// for a single question (question-editor.tsx). A library block
// (content-block-editor.tsx) edits exactly one block instead, via
// BlockFieldsEditor directly.
export function BlockListEditor({
  blocks,
  onChange,
}: {
  blocks: StudyContentBlock[];
  onChange: (blocks: StudyContentBlock[]) => void;
}) {
  const [addType, setAddType] = useState<StudyContentBlockType>("markdown");

  function addBlock() {
    onChange([...blocks, createDefaultBlock(addType)]);
  }

  function updateBlock(index: number, next: StudyContentBlock) {
    onChange(blocks.map((b, i) => (i === index ? next : b)));
  }

  function removeBlock(index: number) {
    onChange(blocks.filter((_, i) => i !== index));
  }

  return (
    <div className="flex flex-col gap-4">
      {blocks.map((block, index) => (
        <div key={block.id} className="rounded-xl border border-border bg-background p-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent">
              {BLOCK_TYPE_LABELS[block.type]}
            </span>
            <button
              type="button"
              onClick={() => removeBlock(index)}
              aria-label="Remove block"
              className="text-muted transition hover:text-red-600"
            >
              <Trash size={15} weight="bold" />
            </button>
          </div>
          <BlockFieldsEditor block={block} onChange={(next) => updateBlock(index, next)} />
        </div>
      ))}

      <div className="flex items-center gap-2 rounded-xl border border-dashed border-border p-3">
        <select
          value={addType}
          onChange={(e) => setAddType(e.target.value as StudyContentBlockType)}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
        >
          {BLOCK_TYPES.map((type) => (
            <option key={type} value={type}>
              {BLOCK_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addBlock}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Add block
        </button>
      </div>
    </div>
  );
}
