"use client";

import { useEffect, useState, useTransition } from "react";
import { reformatNextOcrPaperAction } from "@/lib/actions";

const BATCH_KEY = "notevault:ocr-reformat:batch";
const COUNT_KEY = "notevault:ocr-reformat:count";
const STATUS_KEY = "notevault:ocr-reformat:status";

export function OcrReformatRunner() {
  const [running, startTransition] = useTransition();
  const [status, setStatus] = useState(() =>
    typeof window === "undefined"
      ? "Ready to process the next untouched OCR paper."
      : window.localStorage.getItem(STATUS_KEY) ?? "Ready to process the next untouched OCR paper."
  );
  const [processed, setProcessed] = useState(() =>
    typeof window === "undefined" ? 0 : Number(window.localStorage.getItem(COUNT_KEY) ?? "0")
  );

  useEffect(() => {
    if (window.localStorage.getItem(BATCH_KEY) === "1") {
      const timer = window.setTimeout(() => {
        (document.querySelector("button[data-ocr-run-all]") as HTMLButtonElement | null)?.click();
      }, 350);
      return () => window.clearTimeout(timer);
    }
  }, []);

  function applyResult(result: Awaited<ReturnType<typeof reformatNextOcrPaperAction>>) {
    setStatus(result.message);
    window.localStorage.setItem(STATUS_KEY, result.message);
    if (result.ok && !result.done) {
      setProcessed((count) => {
        const next = count + 1;
        window.localStorage.setItem(COUNT_KEY, String(next));
        return next;
      });
    }
    return result;
  }

  function runOne() {
    startTransition(async () => {
      const result = applyResult(await reformatNextOcrPaperAction());
      if (!result.ok || result.done) window.localStorage.removeItem(BATCH_KEY);
    });
  }

  function runAll() {
    window.localStorage.setItem(BATCH_KEY, "1");
    window.localStorage.setItem(COUNT_KEY, "0");
    setProcessed(0);
    runAllInternal();
  }

  function runAllInternal() {
    startTransition(async () => {
      let count = 0;
      let rateLimitRetries = 0;
      while (true) {
        const result = applyResult(await reformatNextOcrPaperAction());
        if (!result.ok && /rate[- ]limited/i.test(result.message) && rateLimitRetries < 8) {
          rateLimitRetries += 1;
          const waitSeconds = Math.min(30, 5 * 2 ** (rateLimitRetries - 1));
          const waitMessage = `Temporary service limit reached. Waiting ${waitSeconds}s before retry ${rateLimitRetries}/8…`;
          setStatus(waitMessage);
          window.localStorage.setItem(STATUS_KEY, waitMessage);
          await new Promise((resolve) => window.setTimeout(resolve, waitSeconds * 1000));
          continue;
        }
        if (!result.ok || result.done) {
          window.localStorage.removeItem(BATCH_KEY);
          setStatus((current) => `${current} Completed in this run: ${count}.`);
          break;
        }
        rateLimitRetries = 0;
        count += 1;
      }
    });
  }

  return (
    <div className="mt-6 max-w-2xl rounded-3xl border border-accent/20 bg-accent-soft/30 p-6 sm:p-8">
      <p className="text-sm leading-6 text-muted">
        The local formatter reads each original OCR paper, keeps every question, sub-question, mark,
        equation, and instruction in order, and adds a blue, Markdown-style study layout. A paper is
        replaced only after the complete lossless document has been built.
      </p>
      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runOne()}
          disabled={running}
          className="rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:border-accent disabled:cursor-wait disabled:opacity-60"
        >
          {running ? "Editing…" : "Run next paper"}
        </button>
        <button
          type="button"
          onClick={runAll}
          data-ocr-run-all
          disabled={running}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:cursor-wait disabled:opacity-60"
        >
          {running ? "Running full batch…" : "Run all 188 papers"}
        </button>
      </div>
      <p role="status" className="mt-5 rounded-xl border border-border bg-surface px-4 py-3 text-sm leading-6">
        {status}
      </p>
      <p className="mt-3 text-xs text-muted">Completed during this session: {processed}</p>
    </div>
  );
}
