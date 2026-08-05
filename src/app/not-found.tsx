import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, House, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page or study material you're looking for could not be found on DU PYQ Online.",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <GraduationCap size={28} weight="bold" />
      </span>
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">404</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        We couldn&rsquo;t find that page
      </h1>
      <p className="mt-3 max-w-md text-muted">
        The question paper, note, or page you&rsquo;re looking for doesn&rsquo;t exist or may have
        moved. Try searching, or jump back into the archive below.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
        >
          <House size={16} weight="bold" />
          Homepage
        </Link>
        <Link
          href="/courses"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          <GraduationCap size={16} weight="bold" />
          Browse programmes
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          <MagnifyingGlass size={16} weight="bold" />
          Search
        </Link>
      </div>
    </div>
  );
}
