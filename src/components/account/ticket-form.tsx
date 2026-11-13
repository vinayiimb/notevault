"use client";

import { useActionState, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CheckCircle, ImageSquare, X } from "@phosphor-icons/react";
import { submitTicketAction } from "@/lib/support-actions";
import type { FormResult } from "@/lib/paid-notes-actions";
import { MAX_MESSAGE, MAX_SUBJECT, TICKET_KINDS, type TicketKind } from "@/lib/support-rules";

const field =
  "w-full rounded-[14px] border border-foreground/[0.1] bg-background px-3.5 py-3 text-[15px] outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20";

// Controlled fields: React clears an action form once it returns, and a failed
// send (bad title, 5 MB image…) must not wipe what the student typed.
export function TicketForm({ initialKind }: { initialKind: TicketKind }) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(submitTicketAction, {});
  const [kind, setKind] = useState<TicketKind>(initialKind);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [seen, setSeen] = useState(state);
  const fileRef = useRef<HTMLInputElement>(null);
  const from = usePathname();

  // A successful send clears the form. Done during render (not in an effect) so it costs no extra paint.
  if (state !== seen) {
    setSeen(state);
    if (state.ok) {
      setSubject("");
      setMessage("");
      setFile(null);
    }
  }

  const placeholder =
    kind === "ERROR"
      ? "Which note / paper / page, and what is wrong? e.g. 'Unit 2 formula for … is incorrect'"
      : kind === "SUGGESTION"
        ? "What should we add or change, and how would it help you?"
        : "What happened, and what did you expect to happen?";

  return (
    <form
      action={(fd) => {
        fd.set("userAgent", navigator.userAgent);
        formAction(fd);
      }}
      className="rounded-[28px] bg-surface p-5 shadow-[var(--shadow-tile)] sm:p-7">
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="pageUrl" value={from} />

      <fieldset>
        <legend className="text-sm font-semibold">What is this about?</legend>
        <div className="mt-2 grid grid-cols-1 gap-1 rounded-[18px] bg-foreground/[0.06] p-1 sm:grid-cols-3">
          {TICKET_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => setKind(k.id)}
              aria-pressed={kind === k.id}
              className={`min-h-11 rounded-[14px] px-3 text-sm font-semibold transition ${
                kind === k.id ? "bg-surface text-foreground shadow-[var(--shadow-tile)]" : "text-muted hover:text-foreground"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-muted">{TICKET_KINDS.find((k) => k.id === kind)?.hint}</p>
      </fieldset>

      <label htmlFor="tk-subject" className="mt-5 block text-sm font-semibold">Title</label>
      <input
        id="tk-subject"
        name="subject"
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        maxLength={MAX_SUBJECT}
        required
        placeholder="A few words, e.g. “Notes not opening on my phone”"
        className={`mt-1.5 ${field}`}
      />

      <label htmlFor="tk-message" className="mt-4 block text-sm font-semibold">Details</label>
      <textarea
        id="tk-message"
        name="message"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        maxLength={MAX_MESSAGE}
        required
        rows={6}
        placeholder={placeholder}
        className={`mt-1.5 resize-y leading-6 ${field}`}
      />

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          name="screenshot"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (f && f.size > 5 * 1024 * 1024) {
              setFileError("That image is over 5 MB.");
              e.target.value = "";
              setFile(null);
              return;
            }
            setFileError(null);
            setFile(f);
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-foreground/[0.06] px-4 text-sm font-semibold transition hover:bg-foreground/[0.1]"
        >
          <ImageSquare size={17} /> {file ? "Change screenshot" : "Add a screenshot"}
        </button>
        {file && (
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-brand/10 px-3 py-2 text-xs text-brand">
            <span className="max-w-[12rem] truncate">{file.name}</span>
            <button
              type="button"
              aria-label="Remove screenshot"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
            >
              <X size={13} weight="bold" />
            </button>
          </span>
        )}
      </div>
      {fileError && <p className="mt-2 text-sm text-red-600">{fileError}</p>}

      {state.error && <p role="alert" className="mt-3 text-sm text-red-600">{state.error}</p>}
      {state.ok && !pending && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-700">
          <CheckCircle size={18} weight="fill" className="shrink-0" /> Sent. We&apos;ll reply here — check back soon.
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-5 flex min-h-12 w-full items-center justify-center rounded-[14px] bg-brand text-[15px] font-semibold text-brand-foreground transition hover:bg-brand-hover disabled:opacity-60 sm:w-auto sm:px-8"
      >
        {pending ? "Sending…" : "Send ticket"}
      </button>
    </form>
  );
}
