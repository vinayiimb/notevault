"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";

export function CopyButton({
  text,
  label = "Copy",
  copiedLabel = "Copied",
  className = "flex items-center gap-1 text-xs font-medium text-muted transition hover:text-accent",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button type="button" onClick={copy} className={className} aria-label={label}>
      {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
      {copied ? copiedLabel : label}
    </button>
  );
}
