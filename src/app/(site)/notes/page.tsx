// ISR, not force-static — same fix as /browse/college and /subjects/[id]:
// force-static bakes this page in once at build time and never re-fetches
// the database, so it only ever shows whatever programmes existed at the
// last build instead of all 120+.
export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight, Check } from "@phosphor-icons/react/dist/ssr";
import { getNotesFeaturedSlugs, getProgrammesWithNotesStatus } from "@/lib/canonical-subject-notes-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { LeadForm } from "@/components/notes-leads/lead-form";

export const metadata: Metadata = {
  title: "DU Notes by Course and Semester",
  description: "Access subject-wise study notes, revision materials, and study guides for Delhi University courses. Free download and online reading.",
  alternates: { canonical: "/notes" },
};

export default async function NotesPage() {
  const featuredSlugs = await getNotesFeaturedSlugs();
  const programmes = await getProgrammesWithNotesStatus(featuredSlugs);
  const readyCount = programmes.reduce((sum, p) => sum + p.notesCount, 0);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Notes", url: "/notes" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      {/* Lead capture: course -> semester -> subject -> phone. Nothing is opened for the
          student; the lead lands in Admin -> Leads and the notes go out on WhatsApp. */}
      <section className="mt-1 overflow-hidden rounded-[28px] bg-surface-muted px-4 py-7 sm:mt-3 sm:rounded-[32px] sm:px-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-[3.5rem]">
            DU Study Notes by Course &amp; Semester
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-snug text-muted sm:mt-4 sm:text-[19px] sm:leading-relaxed">
            Pick your course, semester and subject. We send you the notes, with solved answers and exam tips, on
            WhatsApp.
          </p>
        </div>

        <div
          id="get-notes"
          className="mx-auto mt-6 max-w-md scroll-mt-24 rounded-[26px] bg-surface p-4 shadow-[var(--shadow-tile)] sm:mt-10 sm:rounded-[28px] sm:p-7"
        >
          <h2 className="mb-3 text-[20px] font-semibold tracking-[-0.02em] sm:mb-1 sm:text-[22px]">Get your notes</h2>
          <p className="mb-5 hidden text-[15px] text-muted sm:block">Takes 20 seconds. No sign-up.</p>
          <LeadForm courses={programmes.map((p) => ({ slug: p.slug, name: p.name }))} source="notes-hub" />
        </div>

        <ul className="mx-auto mt-8 flex max-w-3xl flex-col items-center justify-center gap-x-8 gap-y-2.5 text-[15px] text-muted sm:flex-row sm:flex-wrap">
          {[
            readyCount > 0 ? `${readyCount} subjects with ready notes` : "Built from real DU papers",
            "Solved answers for repeated questions",
            "A real person replies on WhatsApp",
          ].map((line) => (
            <li key={line} className="flex items-center gap-2">
              <Check size={16} weight="bold" className="shrink-0 text-brand" />
              {line}
            </li>
          ))}
        </ul>
      </section>

      {/* Browse Notes by Program */}
      <section className="mt-16 sm:mt-20" id="by-programme">
        <h2 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
          Browse by programme
        </h2>
        <p className="mt-2 text-[15px] text-muted sm:text-[17px]">
          {featuredSlugs && featuredSlugs.length > 0
            ? `${programmes.length} programme${programmes.length === 1 ? "" : "s"} with notes available now.`
            : `All ${programmes.length} official DU programmes.`}{" "}
          Pick yours to see which subjects have notes ready to send.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {programmes.map((programme) => (
            <Link
              key={programme.slug}
              href={`/notes/${programme.slug}`}
              className="group flex flex-col justify-between rounded-[22px] bg-surface-muted p-5 transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]"
            >
              <div>
                <h3 className="text-[15px] font-semibold leading-snug tracking-[-0.01em] text-foreground sm:text-[17px]">
                  {programme.name}
                </h3>
                <p className="mt-1 text-[13px] text-muted">{programme.subjectCount} subjects</p>
              </div>

              <div className="mt-5 flex items-center justify-between gap-2">
                {programme.notesCount > 0 ? (
                  <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-[12px] font-semibold text-success">
                    {programme.notesCount} note{programme.notesCount === 1 ? "" : "s"} available
                  </span>
                ) : (
                  <span className="text-[13px] text-muted">Notes coming soon</span>
                )}
                <span className="inline-flex items-center gap-0.5 text-[13px] font-medium text-brand group-hover:underline underline-offset-4">
                  Open <CaretRight size={12} weight="bold" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
