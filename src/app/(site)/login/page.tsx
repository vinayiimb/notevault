export const dynamic = "force-dynamic";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getStudentEmail } from "@/lib/paid-notes";
import { StudentLoginForm } from "@/components/paid-notes/student-login-form";
import { GoogleSignInButton } from "@/components/paid-notes/google-sign-in-button";
import { googleSignInEnabled } from "@/lib/firebase-config";

export const metadata: Metadata = {
  title: "Log in to your account",
  robots: { index: false },
};

// Student account sign-in. Admins use /admin/login directly.
export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const [{ next }, email] = await Promise.all([searchParams, getStudentEmail()]);
  if (email) redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/account");

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-16 sm:px-6">
      <h1 className="text-center font-display text-3xl font-bold tracking-[-0.03em]">Log in to your account</h1>
      <p className="mt-3 text-center text-sm text-muted">
        {googleSignInEnabled
          ? "Continue with your Gmail — or use the password we sent you on WhatsApp."
          : "Use your Gmail and the password we sent you on WhatsApp."}
      </p>
      {googleSignInEnabled && (
        <div className="mt-8">
          <GoogleSignInButton next={next ?? ""} />
          <p className="mt-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted before:h-px before:flex-1 before:bg-border after:h-px after:flex-1 after:bg-border">
            or use your password
          </p>
        </div>
      )}
      <StudentLoginForm next={next ?? ""} />
      <p className="mt-6 text-center text-sm text-muted">
        Want the full notes?{" "}
        <Link href="/paid-notes" className="font-medium text-brand hover:underline">See prices — from ₹49</Link>
      </p>
    </div>
  );
}
