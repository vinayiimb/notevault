import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-surface-muted/10">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-4">
          <div>
            <h3 className="font-display text-sm font-bold text-foreground">DU PYQ Online</h3>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Delhi University previous year question papers, notes, syllabus and answer keys by course and semester. Free access with no login required.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Study Resources</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/previous-year-papers" className="text-muted hover:text-accent transition">
                  Previous Year Papers
                </Link>
              </li>
              <li>
                <Link href="/notes" className="text-muted hover:text-accent transition">
                  Notes
                </Link>
              </li>
              <li>
                <Link href="/syllabus" className="text-muted hover:text-accent transition">
                  Syllabus
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">Browse</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/browse/college" className="text-muted hover:text-accent transition">
                  Courses
                </Link>
              </li>
              <li>
                <Link href="/semesters" className="text-muted hover:text-accent transition">
                  Semesters
                </Link>
              </li>
              <li>
                <Link href="/pyq-notes" className="text-muted hover:text-accent transition">
                  Full Archive
                </Link>
              </li>
              <li>
                <Link href="/pyp" className="text-muted hover:text-accent transition">
                  Official Papers (PYP)
                </Link>
              </li>
              <li>
                <Link href="/practice" className="text-muted hover:text-accent transition">
                  Practice Mode
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted">More & Support</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/blog" className="text-muted hover:text-accent transition">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/resources" className="text-muted hover:text-accent transition">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/link-to-us" className="text-muted hover:text-accent transition">
                  Link to us
                </Link>
              </li>
              <li>
                <Link href="/feedback" className="text-muted hover:text-accent transition">
                  Feedback & Requests
                </Link>
              </li>
              <li>
                <a href="https://wa.me/919376180015" target="_blank" rel="noopener noreferrer" className="text-muted hover:text-accent transition">
                  WhatsApp Helpdesk
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 border-t border-border/60 pt-6 text-center text-xs text-muted">
          <p>© {new Date().getFullYear()} DU PYQ Online. Free access with no login required.</p>
        </div>
      </div>
    </footer>
  );
}
