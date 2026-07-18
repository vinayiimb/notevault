"use client";

import { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react/dist/ssr";

export function CopyableTitleList({ titles }: { titles: string[] }) {
  const [copied, setCopied] = useState(false);
  const text = titles.join("\n");

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (titles.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium">
          Plain list — {titles.length} title{titles.length === 1 ? "" : "s"}
        </h2>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-surface-muted"
        >
          {copied ? <Check size={14} weight="bold" className="text-green" /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy list"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        For reporting back which course/semester/type (GSEC, VAC, DSC...) each one belongs to.
      </p>
      <textarea
        readOnly
        value={text}
        rows={Math.min(titles.length, 12)}
        className="mt-3 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs focus:border-accent focus:outline-none"
      />
    </div>
  );
}
