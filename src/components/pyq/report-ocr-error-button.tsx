"use client";

import { useState } from "react";
import { Flag } from "@phosphor-icons/react";
import { submitFeedbackAction } from "@/lib/actions";

// Reuses the existing Feedback model/inbox (src/app/admin/(dashboard)/feedback)
// rather than a new model — pre-fills the paper so an admin reviewing the
// feedback inbox knows exactly which OCR text to fix.
export function ReportOcrErrorButton({ paperId, paperTitle }: { paperId: string; paperTitle: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function submit() {
    setStatus("sending");
    try {
      const formData = new FormData();
      formData.set(
        "message",
        `[OCR error report] Paper: ${paperTitle} (${paperId})\n\n${note || "(no additional details provided)"}`,
      );
      const result = await submitFeedbackAction(formData);
      if (result.ok) {
        setStatus("sent");
        setNote("");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-foreground transition hover:border-accent hover:text-accent"
      >
        <Flag size={14} weight="bold" />
        Report OCR error
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-3 text-sm">
      {status === "sent" ? (
        <p className="text-notes-emerald-dark">Thanks — we&apos;ll take a look.</p>
      ) : (
        <>
          <label className="block text-xs font-medium text-muted">What looks wrong?</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Question 4's text is garbled"
            className="mt-1 w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:border-accent focus:outline-none"
          />
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground">
              Cancel
            </button>
            <button
              type="button"
              onClick={submit}
              disabled={status === "sending"}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-foreground transition hover:opacity-90 disabled:opacity-50"
            >
              {status === "sending" ? "Sending…" : "Send report"}
            </button>
          </div>
          {status === "error" && <p className="mt-1 text-xs text-red-600">Couldn&apos;t send that — try again.</p>}
        </>
      )}
    </div>
  );
}
