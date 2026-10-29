"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { SignIn } from "@phosphor-icons/react/dist/ssr";
import { BookOpenText } from "@phosphor-icons/react";
import { SearchBar } from "@/components/search-bar";
import { ThemeToggle } from "@/components/theme-toggle";
import { MobileNavMenu, SiteNavigation } from "@/components/site-navigation";

export function SiteHeader() {
  const pathname = usePathname();
  const isPapers = pathname === "/papers" || pathname.startsWith("/papers");

  return (
    <div
      className={`sticky top-0 z-40 mx-auto w-full transition-all duration-200 ${
        isPapers
          ? "sm:top-3 sm:w-[98%] sm:max-w-[1920px]"
          : "sm:top-4 sm:w-[92%] sm:max-w-6xl"
      }`}
    >
      <header className="flex h-16 sm:h-[72px] items-center justify-between gap-3 sm:gap-5 border-b border-black/[0.06] bg-surface/75 px-4 backdrop-blur-2xl backdrop-saturate-[1.8] dark:border-white/10 sm:rounded-[22px] sm:border sm:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_10px_36px_rgba(0,0,0,0.08)] sm:px-6">
        <div className="flex items-center gap-3">
          {/* Transparent parrot + live text instead of /logo.png's white box,
              so the mark sits cleanly on the glass header in both themes. */}
          <Link href="/" aria-label="DU PYQ Online home" className="logo-wiggle flex shrink-0 items-center gap-1.5">
            <Image
              src="/mascot.webp"
              alt=""
              width={480}
              height={435}
              priority
              className="h-9 sm:h-11 w-auto"
            />
            <span className="flex flex-col text-[15px] font-extrabold leading-[0.95] tracking-[-0.02em] text-foreground sm:text-[17px]">
              <span>DU</span>
              <span>PYQ</span>
            </span>
          </Link>
          {isPapers && (
            <div className="hidden sm:flex items-center gap-2 border-l border-border/70 pl-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
                <BookOpenText size={14} weight="bold" />
                Browse Question Papers
              </span>
            </div>
          )}
        </div>

        <SiteNavigation />

        <div className="ml-auto flex items-center justify-end gap-2.5 sm:gap-3">
          <div className="hidden flex-1 justify-end lg:flex">
            <Suspense fallback={<div className="h-[42px] w-full max-w-xs" />}>
              <SearchBar compact />
            </Suspense>
          </div>
          <ThemeToggle />
          {/* Student sign-in only. Admins use the direct /admin/login link. */}
          <Link
            href="/login"
            aria-label="Log in"
            className="flex h-8 sm:h-9 items-center justify-center rounded-full bg-brand px-4.5 sm:px-5 text-xs sm:text-sm font-medium text-brand-foreground transition hover:bg-brand-hover"
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
