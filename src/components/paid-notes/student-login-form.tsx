"use client";

import { useActionState } from "react";
import { studentLoginAction, type FormResult } from "@/lib/paid-notes-actions";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none";

export function StudentLoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(studentLoginAction, {});
  return (
    <form action={formAction} className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <input type="hidden" name="next" value={next} />
      <label className="block text-xs font-medium text-muted" htmlFor="sl-email">Gmail</label>
      <input id="sl-email" name="email" type="email" required autoComplete="email" className={`mt-1.5 ${inputClass}`} />
      <label className="mt-4 block text-xs font-medium text-muted" htmlFor="sl-password">Password</label>
      <input id="sl-password" name="password" type="password" required autoComplete="current-password" className={`mt-1.5 ${inputClass}`} />
      {state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
