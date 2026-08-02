"use client";

import { useState } from "react";
import { Check, ShareNetwork } from "@phosphor-icons/react";

export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled the native share sheet — not an error.
      }
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={share}
      className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
    >
      {copied ? <Check size={14} weight="bold" /> : <ShareNetwork size={14} weight="bold" />}
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
