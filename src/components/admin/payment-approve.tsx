"use client";

import { useActionState } from "react";
import { WhatsappLogo } from "@phosphor-icons/react";
import { approvePurchaseAction, resetStudentPasswordAction, type ApproveResult } from "@/lib/paid-notes-actions";
import { googleSignInEnabled } from "@/lib/firebase-config";

const LOGIN_URL = "https://www.dupyq.online/login";

function whatsappText(r: ApproveResult, subjects: string) {
  const lines = r.password
    ? [
        "Hi! Your DU PYQ Online notes are unlocked ✅",
        `Subjects: ${subjects}`,
        "",
        `Sign in here: ${LOGIN_URL}`,
        ...(googleSignInEnabled ? [`Tap "Continue with Google" and pick ${r.email} — or use:`] : []),
        `Email: ${r.email}`,
        `Password: ${r.password}`,
      ]
    : [
        "Hi! Your payment is verified and your new notes are unlocked ✅",
        `Subjects: ${subjects}`,
        "",
        `Sign in with your existing login (${r.email}): ${LOGIN_URL}`,
      ];
  return encodeURIComponent(lines.join("\n"));
}

// The issued password only ever exists here, right after the action — it's
// stored hashed, so if it's lost, use "Reset password" to issue a new one.
function Result({ r, subjects }: { r: ApproveResult; subjects: string }) {
  if (r.error) return <p className="text-sm text-red-500">{r.error}</p>;
  if (!r.ok) return null;
  return (
    <div className="mt-3 rounded-lg border border-green-600/30 bg-green-600/5 p-3 text-sm">
      {r.password ? (
        <p>
          Login for <strong>{r.email}</strong> — password <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">{r.password}</code>
          <span className="block text-xs text-muted">Shown only once. Send it now.</span>
        </p>
      ) : (
        <p>Approved — added to their existing login ({r.email}).</p>
      )}
      {r.phone && (
        <a
          href={`https://wa.me/${r.phone}?text=${whatsappText(r, subjects)}`}
          target="_blank"
          rel="noreferrer"
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
        >
          <WhatsappLogo size={14} weight="bold" />
          Send on WhatsApp
        </a>
      )}
    </div>
  );
}

export function ApprovePaymentButton({ id, subjects }: { id: string; subjects: string }) {
  const [state, action, pending] = useActionState<ApproveResult, FormData>(approvePurchaseAction, {});
  return (
    <div>
      {!state.ok && (
        <form action={action}>
          <input type="hidden" name="id" value={id} />
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90 disabled:opacity-60"
          >
            {pending ? "Approving…" : "Approve & create login"}
          </button>
        </form>
      )}
      <Result r={state} subjects={subjects} />
    </div>
  );
}

export function ResetPasswordButton({ email, phone, subjects }: { email: string; phone: string; subjects: string }) {
  const [state, action, pending] = useActionState<ApproveResult, FormData>(resetStudentPasswordAction, {});
  return (
    <div>
      <form action={action}>
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="phone" value={phone} />
        <button type="submit" disabled={pending} className="text-xs text-muted hover:text-foreground disabled:opacity-60">
          {pending ? "Resetting…" : "Reset password & resend login"}
        </button>
      </form>
      <Result r={state} subjects={subjects} />
    </div>
  );
}
