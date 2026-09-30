"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowClockwise, GraduationCap, House } from "@phosphor-icons/react";

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-accent">
        <GraduationCap size={28} weight="bold" />
      </span>
      <p className="mt-6 text-sm font-semibold uppercase tracking-wide text-muted">Something went wrong</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
        This page didn&rsquo;t load
      </h1>
      <p className="mt-3 max-w-md text-muted">
        It&rsquo;s usually temporary. Try again, or head back and pick another page — the rest of the
        site is still working.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground transition hover:opacity-90"
        >
          <ArrowClockwise size={16} weight="bold" />
          Try again
        </button>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground transition hover:border-accent hover:text-accent"
        >
          <House size={16} weight="bold" />
          Homepage
        </Link>
      </div>
    </div>
  );
}
