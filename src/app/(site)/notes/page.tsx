// ISR, not force-static — same fix as /browse/college and /subjects/[id]:
// force-static bakes this page in once at build time and never re-fetches
// the database, so it only ever shows whatever programmes existed at the
// last build instead of all 120+.
export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpenText, FileText, Sparkle } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "DU Notes by Course and Semester | DU PYQ Online",
  description: "Access subject-wise study notes, revision materials, and study guides for Delhi University courses. Free download and online reading.",
  alternates: { canonical: "/notes" },
};

export default async function NotesPage() {
  const programs = await getProgramsByLevel("COLLEGE");

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Notes", url: "/notes" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          DU Study Notes by Course &amp; Semester
        </h1>
        <p className="mt-3 text-base text-muted">
          Access high-quality study notes, revision notebooks, and structured topic summaries designed 
          for Delhi University undergraduate courses. Read online or download PDF materials with no sign-in.
        </p>
      </div>

      {/* Featured Note Resources */}
      <section className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[#0284c7]/20 bg-sky-soft/40 p-6 flex flex-col justify-between">
          <div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-sky/20 text-sky-dark">
              <Sparkle size={20} weight="fill" />
            </span>
            <h3 className="mt-4 font-bold text-foreground text-lg">Compiled Notes &amp; Revision Kits</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              We compile and structure topic summaries directly linked to the official syllabus. Check your specific subject pages to read compiled notes online.
            </p>
          </div>
          <Link
            href="/browse/college"
            className="mt-6 text-sm font-bold text-sky-dark hover:underline"
          >
            Find compiled notes →
          </Link>
        </div>

        <div className="rounded-2xl border border-border bg-surface p-6 flex flex-col justify-between">
          <div>
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <FileText size={20} weight="bold" />
            </span>
            <h3 className="mt-4 font-bold text-foreground text-lg">PDF Resource Downloads</h3>
            <p className="mt-2 text-sm text-muted leading-relaxed">
              Hundreds of subject-wise PDF notes uploaded by admins and students. Fully formatted, searchable, and structured by semester.
            </p>
          </div>
          <Link
            href="/pyq-notes"
            className="mt-6 text-sm font-bold text-accent hover:underline"
          >
            Browse PDF downloads →
          </Link>
        </div>
      </section>

      {/* Browse Notes by Program */}
      <section className="mt-16 border-t border-border/60 pt-12">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <BookOpenText size={22} className="text-accent" />
          Study Materials by Course
        </h2>
        <p className="text-sm text-muted mt-1">Select a course to view its notes, syllabus, and papers organized by semester.</p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <div
              key={program.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
            >
              <div>
                <h3 className="font-semibold text-foreground text-sm sm:text-base">{program.name}</h3>
                {program.summary && <p className="mt-1 text-xs text-muted leading-relaxed">{program.summary}</p>}
              </div>

              <div className="mt-4 pt-4 border-t border-border/40 flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-1.5">
                  {program.terms.slice(0, 3).map((term) => (
                    <Link
                      key={term.id}
                      href={`/terms/${term.id}`}
                      className="text-xs text-muted hover:text-brand hover:underline"
                    >
                      {term.name.replace("Semester ", "Sem ")}
                    </Link>
                  ))}
                  {program.terms.length > 3 && <span className="text-xs text-muted">...</span>}
                </div>
                <Link
                  href={`/programs/${program.slug}`}
                  className="text-xs font-bold text-brand hover:underline"
                >
                  Explore →
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
