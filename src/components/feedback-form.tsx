"use client";

import { useRef, useState } from "react";
import { CheckCircle, ImageSquare, UploadSimple, X } from "@phosphor-icons/react/dist/ssr";
import { submitFeedbackAction } from "@/lib/actions";

export function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    if (!message.trim()) {
      setError("Feedback can't be empty.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("message", message.trim());
      if (screenshot) formData.set("screenshot", screenshot);
      await submitFeedbackAction(formData);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface px-6 py-12 text-center shadow-[0_10px_30px_rgba(15,23,42,.05)]">
        <CheckCircle size={40} weight="fill" className="text-success" />
        <p className="text-lg font-semibold">Thanks — that&apos;s been sent.</p>
        <p className="text-sm text-muted">Our team will take a look soon.</p>
        <button
          type="button"
          onClick={() => {
            setDone(false);
            setMessage("");
            setScreenshot(null);
          }}
          className="mt-2 text-sm font-semibold text-accent hover:underline"
        >
          Send another
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-surface p-6 shadow-[0_10px_30px_rgba(15,23,42,.05)] sm:p-8">
      <label htmlFor="feedback-message" className="text-sm font-semibold">
        Your feedback <span className="text-accent">*</span>
      </label>

      <div className="relative mt-2">
        <textarea
          id="feedback-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Tell us what's on your mind..."
          rows={6}
          className="w-full resize-y rounded-xl border border-border bg-background px-4 pt-3.5 pb-12 text-sm leading-6 outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          aria-label="Attach a screenshot"
          title="Attach a screenshot"
          className="absolute bottom-3 left-3 flex size-8 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-sm transition hover:bg-accent-hover"
        >
          <UploadSimple size={15} weight="bold" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setScreenshot(e.target.files?.[0] ?? null)}
        />
      </div>

      {screenshot && (
        <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-accent-soft px-3 py-2 text-xs text-accent">
          <ImageSquare size={15} weight="bold" className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{screenshot.name}</span>
          <button type="button" onClick={() => setScreenshot(null)} aria-label="Remove screenshot" className="shrink-0 hover:opacity-70">
            <X size={14} weight="bold" />
          </button>
        </div>
      )}

      {error && <p className="mt-2.5 text-sm text-red-600">{error}</p>}

      <div className="mt-5 flex justify-end">
        <button
          type="button"
          onClick={submit}
          disabled={submitting}
          className="min-h-11 rounded-xl bg-accent px-5 text-sm font-semibold text-accent-foreground transition hover:bg-accent-hover disabled:opacity-50"
        >
          {submitting ? "Sending..." : "Submit feedback"}
        </button>
      </div>
    </div>
  );
}
