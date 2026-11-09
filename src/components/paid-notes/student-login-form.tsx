"use client";

import { useActionState, useState } from "react";
import { studentLoginAction, type FormResult } from "@/lib/paid-notes-actions";
import { DevicePicker } from "./device-picker";

const inputClass =
  "w-full rounded-xl border border-border bg-background px-3.5 py-2.5 text-sm focus:border-brand focus:outline-none";

export function StudentLoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<FormResult, FormData>(studentLoginAction, {});
  // Controlled, because React clears an action form's fields once the action returns — and the
  // device picker (when both slots are taken) resubmits this same form.
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <form action={formAction} className="mt-8 rounded-2xl border border-border bg-surface p-6">
      <input type="hidden" name="next" value={next} />
      <label className="block text-xs font-medium text-muted" htmlFor="sl-email">Gmail</label>
      <input id="sl-email" name="email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      <label className="mt-4 block text-xs font-medium text-muted" htmlFor="sl-password">Password</label>
      <input id="sl-password" name="password" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1.5 ${inputClass}`} />
      {state.devices ? (
        <DevicePicker devices={state.devices} error={state.error} disabled={pending} />
      ) : (
        state.error && <p className="mt-3 text-sm text-red-600">{state.error}</p>
      )}
      {!state.devices && <button
        type="submit"
        disabled={pending}
        className="mt-5 flex min-h-12 w-full items-center justify-center rounded-xl bg-brand text-sm font-semibold text-brand-foreground hover:bg-brand-hover disabled:opacity-60"
      >
        {pending ? "Signing in…" : "Sign in"}
      </button>}
    </form>
  );
}
