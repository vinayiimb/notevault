"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="flex items-center gap-1 text-xs font-medium text-muted transition hover:text-accent"
      aria-label={label}
    >
      {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
      {copied ? "Copied" : label}
    </button>
  );
}
