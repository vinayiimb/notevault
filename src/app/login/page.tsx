import Link from "next/link";
import { GraduationCap, ShieldCheck, Stack } from "@phosphor-icons/react/dist/ssr";

export default function EntryGatePage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4 py-16">
      <Link href="/" className="mb-10 flex items-center gap-2 font-semibold">
        <span className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
          <Stack size={18} weight="bold" />
        </span>
        NoteVault
      </Link>

      <div className="w-full max-w-2xl">
        <h1 className="text-center text-2xl font-semibold tracking-tight">Continue as</h1>
        <p className="mt-2 text-center text-sm text-muted">
          Choose how you&apos;d like to enter NoteVault.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Link
            href="/"
            className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 transition hover:border-accent"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <GraduationCap size={22} weight="bold" />
            </span>
            <div>
              <h2 className="text-lg font-medium">Student</h2>
              <p className="mt-1 text-sm text-muted">
                Browse notes, PYQs, and answer keys. No account needed.
              </p>
            </div>
            <span className="mt-auto text-sm font-medium text-accent">
              Continue browsing &rarr;
            </span>
          </Link>

          <Link
            href="/admin/login"
            className="group flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 transition hover:border-accent"
          >
            <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
              <ShieldCheck size={22} weight="bold" />
            </span>
            <div>
              <h2 className="text-lg font-medium">Admin</h2>
              <p className="mt-1 text-sm text-muted">
                Sign in to upload notes and PYQs, and manage subjects.
              </p>
            </div>
            <span className="mt-auto text-sm font-medium text-accent">Sign in &rarr;</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
