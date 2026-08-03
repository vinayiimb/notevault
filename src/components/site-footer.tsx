import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-muted sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <p>DU PYQ Online. Notes, previous year papers, and answer keys in one place.</p>
          <div className="flex items-center gap-5">
            <Link href="/blog" className="font-medium text-muted transition hover:text-foreground">
              Blog
            </Link>
            <Link href="/resources" className="font-medium text-muted transition hover:text-foreground">
              Resources
            </Link>
            <Link href="/link-to-us" className="font-medium text-muted transition hover:text-foreground">
              Link to us
            </Link>
            <Link href="/pyq-notes" className="font-medium text-accent transition hover:text-foreground">
              Read the complete PYQ archive →
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
