import Link from "next/link";
import { Suspense } from "react";
import { SignIn, Stack } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileDashboardLink, SiteNavigation } from "@/components/site-navigation";

export function SiteHeader() {
  return (
    <div className="sticky top-4 z-40 mx-auto w-[92%] max-w-6xl">
      <header className="flex h-[72px] items-center gap-5 rounded-2xl bg-surface px-4 shadow-[0_8px_24px_rgba(0,0,0,.08)] sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display font-semibold">
          <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground">
            <Stack size={18} weight="bold" />
          </span>
          <span>NoteVault</span>
        </Link>

        <SiteNavigation />

        <div className="ml-auto flex flex-1 items-center justify-end gap-3">
          <div className="hidden flex-1 justify-end sm:flex">
            <Suspense fallback={<div className="h-[42px] w-full max-w-xs" />}>
              <SearchBar compact />
            </Suspense>
          </div>
          <ThemeToggle />
          <MobileDashboardLink />
          <Link
            href="/login"
            aria-label="Log in"
            className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand text-brand-foreground transition hover:bg-brand-hover sm:h-auto sm:w-auto sm:gap-1.5 sm:rounded-2xl sm:px-6 sm:py-3 sm:text-sm sm:font-semibold"
          >
            <SignIn size={16} weight="bold" />
            <span className="hidden sm:inline">Login</span>
          </Link>
        </div>
      </header>
    </div>
  );
}
