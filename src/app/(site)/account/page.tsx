export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { describeItems, getStudentEmail, getUnlockedItems } from "@/lib/paid-notes";
import { studentLogoutAction } from "@/lib/paid-notes-actions";

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
};

export default async function AccountPage() {
  const email = await getStudentEmail();
  if (!email) redirect("/login?next=/account");

  const [owned, pendingCount] = await Promise.all([
    getUnlockedItems(email).then((s) => [...s]),
    prisma.purchase.count({ where: { email, status: "PENDING" } }),
  ]);
  const names = await describeItems(owned);

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-3xl font-bold tracking-[-0.03em]">Your account</h1>
      <form action={studentLogoutAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
        <span className="break-all">Signed in as {email}</span>
        <button type="submit" className="font-medium text-brand hover:underline">Sign out</button>
      </form>

      <section className="mt-8 rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold">Your notes ({owned.length})</h2>
        {owned.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-2">
            {owned.map((key) => (
              <li key={key}>
                <Link href={`/notes/${key}`} className="text-sm font-medium text-brand hover:underline">{names[key]} →</Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-muted">
            No notes unlocked yet.{" "}
            <Link href="/paid-notes" className="font-medium text-brand hover:underline">See prices — from ₹49</Link>
          </p>
        )}
        {pendingCount > 0 && (
          <p className="mt-4 border-t border-border pt-4 text-sm text-muted">
            {pendingCount} payment{pendingCount > 1 ? "s" : ""} waiting for verification — usually done within a few hours.
          </p>
        )}
      </section>
    </div>
  );
}
