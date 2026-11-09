"use client";

import { useState, useTransition } from "react";
import { PaperPlaneTilt } from "@phosphor-icons/react";
import { sendTestAlertAction, type TestAlertResult } from "@/lib/owner-notify-actions";

// Sends a real test message and shows the sender's own reply underneath, so a broken setup explains itself.
export function AlertTestButton() {
  const [result, setResult] = useState<TestAlertResult | null>(null);
  const [pending, start] = useTransition();

  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setResult(await sendTestAlertAction().catch(() => ({ ran: true, ok: false, detail: "Could not run the test (are you still signed in?)." }))))}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60 sm:h-auto sm:py-2"
      >
        <PaperPlaneTilt size={16} weight="bold" />
        {pending ? "Sending…" : "Send test alert"}
      </button>

      {result?.ran && (
        <div
          role="status"
          className={`mt-3 rounded-lg border p-3 text-sm ${result.ok ? "border-green-600/40 bg-green-600/5" : "border-red-500/40 bg-red-500/5"}`}
        >
          <p className="font-semibold">
            {result.ok
              ? "Sent. Check your WhatsApp now."
              : result.provider
                ? "Failed. The alert did not go out."
                : "Nothing is set up. No alert has ever been sent."}
          </p>
          {result.ok && <p className="mt-1 text-muted">If nothing shows up within a minute, the sender accepted it but didn&apos;t deliver it. Read the reply below.</p>}
          {result.hint && <p className="mt-2 leading-relaxed">{result.hint}</p>}
          {result.detail && (
            <p className="mt-2 break-words font-mono text-xs text-muted">
              {result.provider === "cloud" ? "WhatsApp Cloud API" : result.provider === "callmebot" ? "CallMeBot" : "Server"}
              {result.status ? ` · HTTP ${result.status}` : ""}: {result.detail}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
