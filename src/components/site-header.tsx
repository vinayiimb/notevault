import Link from "next/link";
import { Suspense } from "react";
import { ChartBar, SignIn, Stack } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";

export function SiteHeader() {
  return (
    <div className="sticky top-4 z-40 mx-auto w-[92%] max-w-6xl">
      <header className="flex h-[72px] items-center gap-6 rounded-3xl bg-surface px-6 shadow-[0_10px_30px_rgba(0,0,0,.08)] sm:px-8">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display font-semibold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Stack size={18} weight="bold" />
          </span>
          <span>NoteVault</span>
        </Link>

        <nav className="hidden items-center gap-8 text-sm font-medium text-muted md:flex">
          <Link href="/browse/college" className="transition hover:text-foreground">
            PYQ
          </Link>
          <Link href="/tools" className="transition hover:text-foreground">
            Tools
          </Link>
          <Link href="/dashboard" className="flex items-center gap-1.5 transition hover:text-foreground">
            <ChartBar size={16} weight="bold" />
            Dashboard
          </Link>
        </nav>

        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <div className="hidden flex-1 justify-end sm:flex">
            <Suspense fallback={<div className="h-[42px] w-full max-w-xs" />}>
              <SearchBar compact />
            </Suspense>
          </div>
          <ThemeToggle />
          <Link
            href="/login"
            className="hidden shrink-0 items-center gap-1.5 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-brand-foreground transition hover:scale-[1.04] hover:shadow-md sm:flex"
          >
            <SignIn size={16} weight="bold" />
            Login
          </Link>
        </div>
      </header>
    </div>
  );
}
