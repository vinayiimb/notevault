"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowUp, Megaphone } from "@phosphor-icons/react";
import { replyNoticeAction, type ReplyResult } from "@/lib/student-notice-actions";

type Reply = { id: string; body: string; createdAt: string };

/** A message from the team at the top of the dashboard. The student can answer it; the team reads replies in Admin -> Students. */
export function NoticeCard({ id, title, body, date, replies }: { id: string; title: string; body: string; date: string; replies: Reply[] }) {
  const [state, action, pending] = useActionState<ReplyResult, FormData>(replyNoticeAction, {});
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <section aria-label="Message from DU PYQ" className="rounded-[24px] bg-surface p-4 shadow-[var(--shadow-tile)] sm:p-5">
      <div className="flex gap-3.5">
        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand/10 text-brand">
          <Megaphone size={20} weight="fill" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-baseline justify-between gap-x-3">
            <span className="text-[17px] font-semibold tracking-[-0.015em]">{title}</span>
            <span className="text-[13px] text-muted">DU PYQ · {date}</span>
          </p>
          <p className="mt-1 whitespace-pre-line text-[15px] leading-snug text-foreground/80">{body}</p>

          {replies.length > 0 && (
            <ul className="mt-3 flex flex-col items-end gap-1.5">
              {replies.map((r) => (
                <li key={r.id} className="max-w-[85%] whitespace-pre-line break-words rounded-[18px] rounded-br-[6px] bg-brand px-3.5 py-2 text-[15px] leading-snug text-brand-foreground">
                  {r.body}
                </li>
              ))}
              <li className="text-[12px] text-muted">The team will reply on WhatsApp or here.</li>
            </ul>
          )}

          {!open && replies.length === 0 ? (
            <button type="button" onClick={() => setOpen(true)} className="mt-2 min-h-9 text-[15px] font-medium text-brand">
              Reply
            </button>
          ) : (
            <form ref={formRef} action={action} className="mt-3">
              <input type="hidden" name="noticeId" value={id} />
              <div className="flex items-end gap-2 rounded-[22px] bg-surface-muted py-1.5 pl-4 pr-1.5 ring-1 ring-inset ring-transparent focus-within:ring-brand">
                <textarea
                  name="body"
                  required
                  maxLength={1000}
                  rows={1}
                  autoFocus={open && replies.length === 0}
                  placeholder="Reply to DU PYQ"
                  aria-label={`Reply to: ${title}`}
                  className="max-h-32 min-h-8 flex-1 resize-none bg-transparent py-1 text-[16px] leading-6 outline-none placeholder:text-muted [field-sizing:content]"
                />
                <button type="submit" disabled={pending} aria-label="Send reply" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-brand-foreground transition active:scale-90 disabled:opacity-50">
                  <ArrowUp size={16} weight="bold" />
                </button>
              </div>
              {state.error && <p role="alert" className="mt-1.5 px-2 text-[13px] text-red-600 dark:text-red-400">{state.error}</p>}
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
