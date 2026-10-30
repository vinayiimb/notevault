import type { Metadata } from "next";
import Link from "next/link";
import { GraduationCap, House, MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { MascotArt } from "@/components/landing/mascot";

export const metadata: Metadata = {
  title: "Page Not Found",
  description: "The page or study material you're looking for could not be found on DU PYQ Online.",
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      {/* The parrot is a bust, so fade its flat bottom edge into the page. */}
      <span className="mascot-bob block w-28 [mask-image:linear-gradient(to_bottom,black_70%,transparent)] sm:w-32">
        <MascotArt />
      </span>
      <p className="mt-4 text-[15px] font-semibold text-brand">404 · Even our parrot looked everywhere</p>
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
          className="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-[15px] font-medium text-accent-foreground hover:bg-accent-hover"
        >
          <House size={16} weight="bold" />
          Homepage
        </Link>
        <Link
          href="/browse/college"
          className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-[15px] font-medium text-foreground hover:text-accent"
        >
          <GraduationCap size={16} weight="bold" />
          Browse programmes
        </Link>
        <Link
          href="/search"
          className="inline-flex items-center gap-2 rounded-full bg-surface-muted px-5 py-2.5 text-[15px] font-medium text-foreground hover:text-accent"
        >
          <MagnifyingGlass size={16} weight="bold" />
          Search
        </Link>
      </div>
    </div>
  );
}
