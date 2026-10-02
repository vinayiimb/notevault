export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { describeItems, getNotesCatalog, getPaymentSettings, getStudentEmail, getUnlockedItems } from "@/lib/paid-notes";
import { studentLogoutAction } from "@/lib/paid-notes-actions";
import { PaidNotesCheckout } from "@/components/paid-notes/checkout";

export const metadata: Metadata = {
  title: "Buy Notes – Full DU Subject Notes from ₹49",
  description: "Unlock complete DU subject notes with full solutions — ₹49 per subject, ₹99 for 3 subjects, ₹149 for 5. Pay by UPI.",
  alternates: { canonical: "/paid-notes" },
};

export default async function PaidNotesPage({ searchParams }: { searchParams: Promise<{ add?: string }> }) {
  const settings = await getPaymentSettings();

  if (!settings.active) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-24 text-center sm:px-6">
        <p className="text-sm font-semibold text-brand">Complete subject notes</p>
        <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
          Paid notes are coming to DU PYQ Online.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty leading-relaxed text-muted">
          The complete notes collection is being prepared. You can preview the free archive while access is being finalised.
        </p>
        <Link
          href="/pyq-notes"
          className="mx-auto mt-8 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand px-7 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand-hover"
        >
          Preview Notes
        </Link>
      </div>
    );
  }

  const [{ add }, catalog, email] = await Promise.all([searchParams, getNotesCatalog(), getStudentEmail()]);
  const owned = email ? [...(await getUnlockedItems(email))] : [];
  const pending = email
    ? await prisma.purchase.findMany({ where: { email, status: "PENDING" }, select: { items: true, amount: true, createdAt: true } })
    : [];
  const names = await describeItems(owned);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-brand">Complete subject notes</p>
          <h1 className="mt-2 text-balance font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
            Full notes &amp; solutions, from ₹49
          </h1>
          <p className="mt-3 max-w-xl text-pretty text-sm leading-relaxed text-muted sm:text-base">
            Built from actual DU previous year papers — every unit, worked answers, diagrams and PDF download. Pick your
            course and subjects, pay by UPI, and we&apos;ll send your login on WhatsApp.
          </p>
        </div>
        <div className="shrink-0 text-sm">
          {email ? (
            <form action={studentLogoutAction} className="flex items-center gap-2 text-muted">
              <span className="truncate">Signed in as {email}</span>
              <button type="submit" className="font-medium text-brand hover:underline">Sign out</button>
            </form>
          ) : (
            <Link href="/paid-notes/login" className="font-medium text-brand hover:underline">Already bought? Sign in</Link>
          )}
        </div>
      </div>

      {owned.length > 0 && (
        <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold">Your unlocked notes</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {owned.map((key) => (
              <li key={key}>
                <Link href={`/notes/${key}`} className="text-sm font-medium text-brand hover:underline">
                  {names[key]} →
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      {pending.length > 0 && (
        <p className="mt-4 rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
          {pending.length} payment{pending.length > 1 ? "s" : ""} waiting for verification — usually done within a few hours.
        </p>
      )}

      <PaidNotesCheckout
        catalog={catalog}
        owned={owned}
        initialItem={add}
        upiId={settings.upiId}
        upiPayeeName={settings.upiPayeeName}
        upiQrUrl={settings.upiQrUrl}
        defaultEmail={email}
      />
    </div>
  );
}
