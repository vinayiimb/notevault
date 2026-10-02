export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { getStudentEmail } from "@/lib/paid-notes";
import { StudentLoginForm } from "@/components/paid-notes/student-login-form";

export const metadata: Metadata = {
  title: "Sign in to your notes",
  robots: { index: false },
};

export default async function PaidNotesLoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, email] = await Promise.all([searchParams, getStudentEmail()]);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold tracking-[-0.03em]">Sign in to your notes</h1>
      <p className="mt-3 text-center text-sm text-muted">
        Use the Gmail you paid with and the password we sent you on WhatsApp.
      </p>
      {email && (
        <p className="mt-6 rounded-xl border border-border bg-surface-muted px-4 py-3 text-center text-sm text-muted">
          You&apos;re signed in as {email}.{" "}
          <Link href="/paid-notes" className="font-medium text-brand hover:underline">Go to your notes →</Link>
        </p>
      )}
      <StudentLoginForm next={next ?? ""} />
      <p className="mt-6 text-center text-sm text-muted">
        Haven&apos;t bought yet?{" "}
        <Link href="/paid-notes" className="font-medium text-brand hover:underline">See prices — from ₹49</Link>
      </p>
    </div>
  );
}
