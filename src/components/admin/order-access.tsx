"use client";

import { useActionState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { grantOrderAccessAction, type ApproveResult } from "@/lib/paid-notes-actions";
import { googleSignInEnabled } from "@/lib/firebase-config";

const LOGIN_URL = "https://www.dupyq.online/login";

function whatsappText(r: ApproveResult, subjects: string) {
  const lines = [
    "Hi! Your DU PYQ Online notes are unlocked ✅",
    `Notes: ${subjects}`,
    "",
    `Sign in here: ${LOGIN_URL}`,
    ...(googleSignInEnabled ? [`Tap "Continue with Google" and pick ${r.email}${r.password ? " — or use:" : "."}`] : [`Email: ${r.email}`]),
    ...(r.password ? [`Email: ${r.email}`, `Password: ${r.password}`] : []),
    "",
    "You can read on up to 2 devices. Access lasts 6 months.",
  ];
  return encodeURIComponent(lines.join("\n"));
}

// Admin → Leads, on a paid pop-up order: type the student's Gmail to unlock what they paid for on the site.
export function OrderAccess({ id, subjects }: { id: string; subjects: string }) {
  const [state, action, pending] = useActionState<ApproveResult, FormData>(grantOrderAccessAction, {});
  return (
    <div className="mt-3">
      {!state.ok && (
        <form action={action} className="flex flex-col gap-2 sm:flex-row">
          <input type="hidden" name="id" value={id} />
          <input
            name="email"
            type="email"
            required
            placeholder="Student's Gmail, to unlock on the site"
            className="min-w-0 flex-1 rounded-lg border border-border bg-surface px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Unlocking…" : "Give site access"}
          </button>
        </form>
      )}
      {state.error && <p className="mt-2 text-sm text-red-500">{state.error}</p>}
      {state.ok && (
        <div className="rounded-lg border border-green-600/30 bg-green-600/5 p-3 text-sm">
          {state.password ? (
            <p>
              Login created for <strong>{state.email}</strong> — password{" "}
              <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">{state.password}</code>
              <span className="block text-xs text-muted">Shown only once. Send it now.</span>
            </p>
          ) : (
            <p>Unlocked — added to their existing login ({state.email}).</p>
          )}
          <a
            href={`https://wa.me/${state.phone}?text=${whatsappText(state, subjects)}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            <WhatsappLogo size={14} weight="bold" />
            Send login on WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}
