import Link from "next/link";

// Crawlable links from every page to the highest-demand course hubs.
const POPULAR_COURSES = [
  ["bcom-hons", "B.Com (Hons)"],
  ["bcom-p", "B.Com Programme"],
  ["ba-hons-economics", "BA (Hons) Economics"],
  ["ba-hons-political-science", "BA (Hons) Political Science"],
  ["b-a-hons-english", "BA (Hons) English"],
  ["bsc-hons-computer-science", "B.Sc (Hons) Computer Science"],
  ["bsc-hons-mathematics", "B.Sc (Hons) Mathematics"],
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-8 bg-surface-muted">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-5">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">DU PYQ Online</h3>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Delhi University previous year question papers, notes, syllabus and answer keys by course and semester. Free access with no login required.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Study resources</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/papers" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Question Papers
                </Link>
              </li>
              <li>
                <Link href="/previous-year-papers" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Previous Year Papers
                </Link>
              </li>
              <li>
                <Link href="/notes" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Notes
                </Link>
              </li>
              <li>
                <Link href="/syllabus" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Syllabus
                </Link>
              </li>
              <li>
                <Link href="/exam-help/datesheet" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Datesheet
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Browse</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/browse/college" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Courses
                </Link>
              </li>
              <li>
                <Link href="/semesters" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Semesters
                </Link>
              </li>
              <li>
                <Link href="/pyp" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Official Papers (PYP)
                </Link>
              </li>
              <li>
                <Link href="/practice" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Practice Mode
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">Popular courses</h4>
            <ul className="mt-3 space-y-2 text-xs">
              {POPULAR_COURSES.map(([slug, name]) => (
                <li key={slug}>
                  <Link href={`/papers/${slug}`} className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                    {name} PYQs
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground">More & support</h4>
            <ul className="mt-3 space-y-2 text-xs">
              <li>
                <Link href="/about" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  About us
                </Link>
              </li>
              <li>
                <Link href="/blog" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="/resources" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Resources
                </Link>
              </li>
              <li>
                <Link href="/link-to-us" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Link to us
                </Link>
              </li>
              <li>
                <Link href="/feedback" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  Feedback & Requests
                </Link>
              </li>
              <li>
                <a href="https://wa.me/919376180015" target="_blank" rel="noopener noreferrer" className="text-muted underline-offset-2 hover:text-foreground hover:underline">
                  WhatsApp Helpdesk
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-10 flex flex-col items-center gap-3 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} DU PYQ Online. Not affiliated with the University of Delhi.</p>
          <nav aria-label="Policies" className="flex flex-wrap justify-center gap-x-5 gap-y-2">
            <Link href="/privacy-policy" className="underline-offset-2 hover:text-foreground hover:underline">Privacy</Link>
            <Link href="/terms-of-service" className="underline-offset-2 hover:text-foreground hover:underline">Terms</Link>
            <Link href="/refund-policy" className="underline-offset-2 hover:text-foreground hover:underline">Refund</Link>
            <Link href="/contact" className="underline-offset-2 hover:text-foreground hover:underline">Contact</Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}
