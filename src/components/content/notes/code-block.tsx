"use client";

import { useState } from "react";
import { Check, Copy } from "@phosphor-icons/react";
import { PrismAsyncLight as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light";
import { useContentTheme } from "./theme-provider";

export function ContentCodeBlock({ language, code }: { language: string; code: string }) {
  const { resolvedMode } = useContentTheme();
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="nt-codeblock">
      <div className="nt-codeblock-header">
        <span>{language || "text"}</span>
        <button type="button" className="nt-copy-btn" onClick={copy} aria-label="Copy code">
          {copied ? <Check size={13} weight="bold" /> : <Copy size={13} weight="bold" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language || "text"}
        style={resolvedMode === "dark" ? oneDark : oneLight}
        customStyle={{ margin: 0, borderRadius: 0, fontSize: "0.85rem", padding: "1rem" }}
        wrapLongLines
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
}
