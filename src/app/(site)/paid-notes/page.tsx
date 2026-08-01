import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Paid Notes — NoteVault",
  description: "Complete subject notes from NoteVault.",
};

export default function PaidNotesPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-4 py-24 text-center sm:px-6">
      <p className="text-sm font-semibold text-brand">Complete subject notes</p>
      <h1 className="mt-3 text-balance font-display text-4xl font-bold tracking-[-0.03em] sm:text-5xl">
        Paid notes are coming to NoteVault.
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
