"use client";

import { useRef, useState } from "react";
import { Check, Copy, LockSimple } from "@phosphor-icons/react";
import { MARKSHEET_PROMPT, analyseMarksheet, parseMarksheet, type Analysis } from "@/lib/marksheet";
import { AnalysisReport } from "@/components/result-doctor/analysis-report";
import { MarksCalculatorPanel } from "@/components/result-doctor/marks-calculator-panel";
import { SAMPLE_MARKSHEET } from "@/components/result-doctor/sample-marksheet";

const TABS = [
  { id: "analyse", label: "Analyse marksheet" },
  { id: "calculator", label: "Marks calculator" },
] as const;

const STEPS = [
  { title: "Copy the prompt", body: "It tells the AI exactly how to read a DU marksheet." },
  { title: "Ask any AI", body: "Open ChatGPT, Gemini or Claude, attach your marksheet (PDF or a clear photo) and paste the prompt." },
  { title: "Paste the reply here", body: "Copy the whole answer the AI gives you and paste it into the box below." },
];

function CopyPromptButton() {
  const [copied, setCopied] = useState(false);
  const promptRef = useRef<HTMLPreElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(MARKSHEET_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked: open the prompt and select it for a manual copy.
      const details = promptRef.current?.closest("details");
      if (details) details.open = true;
      const range = document.createRange();
      if (promptRef.current) range.selectNodeContents(promptRef.current);
      window.getSelection()?.removeAllRanges();
      window.getSelection()?.addRange(range);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={copy}
        className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground shadow-sm transition hover:bg-brand-hover active:scale-95"
      >
        {copied ? <Check size={16} weight="bold" /> : <Copy size={16} weight="bold" />}
        {copied ? "Prompt copied" : "Copy prompt"}
      </button>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold text-muted hover:text-foreground">See the prompt</summary>
        <pre
          ref={promptRef}
          className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-xl border border-border bg-surface-muted p-4 font-mono text-xs leading-5 text-foreground"
        >
          {MARKSHEET_PROMPT}
        </pre>
      </details>
    </div>
  );
}

export function ResultDoctorClient() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("analyse");
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const topRef = useRef<HTMLDivElement>(null);

  function analyse(text: string) {
    const parsed = parseMarksheet(text);
    if (!parsed.ok) {
      setError(parsed.error);
      setAnalysis(null);
      return;
    }
    setError(null);
    setAnalysis(analyseMarksheet(parsed.data));
    requestAnimationFrame(() => topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  return (
    <div ref={topRef} className="scroll-mt-28">
      <div role="tablist" aria-label="Result Doctor tools" className="inline-flex rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-brand-soft text-brand" : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "calculator" ? (
          <MarksCalculatorPanel />
        ) : analysis ? (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Your result report</h2>
              <button
                type="button"
                onClick={() => {
                  setAnalysis(null);
                  setInput("");
                }}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold transition hover:bg-surface-muted"
              >
                Analyse another marksheet
              </button>
            </div>
            <AnalysisReport analysis={analysis} />
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            <ol className="grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className="rounded-2xl border border-border bg-surface p-5">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-brand-soft text-sm font-bold text-brand">{i + 1}</span>
                  <p className="mt-3 font-semibold">{step.title}</p>
                  <p className="mt-1 text-sm text-muted">{step.body}</p>
                </li>
              ))}
            </ol>

            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <CopyPromptButton />
            </section>

            <section className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
              <label htmlFor="marksheet-json" className="text-lg font-semibold">
                Paste the AI&apos;s reply
              </label>
              <textarea
                id="marksheet-json"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                rows={8}
                spellCheck={false}
                placeholder={'```json\n{\n  "programme": "Bachelor of Commerce",\n  "papers": [ … ]\n}\n```'}
                className="mt-3 w-full resize-y rounded-xl border border-border bg-background p-3 font-mono text-xs leading-5 text-foreground focus:border-brand focus:outline-none"
              />
              {error && (
                <p role="alert" className="mt-2 rounded-xl bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => analyse(input)}
                  disabled={!input.trim()}
                  className="rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground shadow-sm transition hover:bg-brand-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Analyse my result
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput(SAMPLE_MARKSHEET);
                    analyse(SAMPLE_MARKSHEET);
                  }}
                  className="text-sm font-semibold text-brand hover:underline"
                >
                  Try it with a sample marksheet
                </button>
              </div>
            </section>

            <p className="flex items-start gap-2 text-sm text-muted">
              <LockSimple size={18} weight="bold" className="mt-0.5 shrink-0 text-brand" />
              <span>
                Your marksheet stays with you. The prompt tells the AI to leave out your name, roll number and parents&apos;
                names, and the reply is analysed right here in your browser — nothing is sent to or saved by DU PYQ.
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
