import Link from "next/link";
import { Suspense } from "react";
import { SignIn, Stack } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavMenu, SiteNavigation } from "@/components/site-navigation";

export function SiteHeader() {
  return (
    <div className="sticky top-0 z-40 mx-auto w-full sm:top-4 sm:w-[92%] sm:max-w-6xl transition-all duration-200">
      <header className="flex h-16 sm:h-[72px] items-center justify-between gap-3 sm:gap-5 border-b border-border/60 bg-surface/95 px-4 backdrop-blur-md shadow-2xs sm:border-none sm:rounded-2xl sm:shadow-[0_8px_24px_rgba(0,0,0,.08)] sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-display font-bold tracking-tight text-foreground text-base sm:text-lg">
          <span className="flex size-7.5 sm:size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground shadow-sm">
            <Stack size={17} weight="bold" />
          </span>
          <span>DU PYQ Online</span>
        </Link>

        <SiteNavigation />

        <div className="ml-auto flex items-center justify-end gap-2.5 sm:gap-3">
          <div className="hidden flex-1 justify-end lg:flex">
            <Suspense fallback={<div className="h-[42px] w-full max-w-xs" />}>
              <SearchBar compact />
            </Suspense>
          </div>
          <ThemeToggle />
          <Link
            href="/login"
            aria-label="Log in"
            className="flex h-8 sm:h-auto items-center justify-center rounded-full bg-[#f97316] px-4.5 sm:px-6 py-1.5 sm:py-2 text-xs sm:text-sm font-bold text-white shadow-md transition hover:bg-[#ea580c] hover:shadow-lg active:scale-95"
          >
            <SignIn size={15} weight="bold" className="sm:hidden mr-1" />
            <span>Login</span>
          </Link>
          <MobileNavMenu />
        </div>
      </header>
    </div>
  );
}
