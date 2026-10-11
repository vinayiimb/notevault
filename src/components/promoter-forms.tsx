"use client";

import { useActionState } from "react";
import { issuePromoterLoginAction, promoterLoginAction, type ApproveResult, type FormResult } from "@/lib/paid-notes-actions";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none";

export function PromoterLoginForm() {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(promoterLoginAction, {});
  return (
    <form action={formAction} className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <label className="block text-xs font-medium text-muted" htmlFor="pl-email">Email</label>
      <input id="pl-email" name="email" type="email" required autoComplete="email" className={`mt-1.5 ${inputClass}`} />
      <label className="mt-4 block text-xs font-medium text-muted" htmlFor="pl-password">Password</label>
      <input id="pl-password" name="password" type="password" required autoComplete="current-password" className={`mt-1.5 ${inputClass}`} />
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

const adminInput = "rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none";

// Admin side: add a promoter or reissue their password. The password is
// stored hashed, so this is the only time it's visible.
export function IssuePromoterLoginForm() {
  const [state, formAction, pending] = useActionState<ApproveResult, FormData>(issuePromoterLoginAction, {});
  return (
    <div>
      <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
        <input name="email" type="email" required placeholder="Promoter's email" className={`${adminInput} min-w-0 flex-1`} />
        <input name="name" placeholder="Name (optional)" className={`${adminInput} min-w-0 sm:w-40`} />
        <button type="submit" disabled={pending} className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-60">
          {pending ? "Saving…" : "Add / reset login"}
        </button>
      </form>
      {state.error && <p className="mt-2 text-sm text-red-500">{state.error}</p>}
      {state.ok && (
        <p className="mt-3 rounded-lg border border-green-600/30 bg-green-600/5 p-3 text-sm">
          Login for <strong>{state.email}</strong> — password{" "}
          <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">{state.password}</code>
          <span className="block text-xs text-muted">Shown only once. They sign in at www.dupyq.online/promoter</span>
        </p>
      )}
    </div>
  );
}
