// ISR, not force-static — same fix as /browse/college and /subjects/[id]:
// force-static bakes this page in once at build time and never re-fetches
// the database, so it only ever shows whatever programmes existed at the
// last build instead of all 120+.
export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight, Check } from "@phosphor-icons/react/dist/ssr";
import { getNotesFeaturedSlugs, getProgrammesWithNotesStatus, getReadyNotesByProgramme } from "@/lib/canonical-subject-notes-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { NotesBuyForm } from "@/components/notes-leads/lead-form";

export const metadata: Metadata = {
  title: "DU Notes by Course and Semester",
  description: "Access subject-wise study notes, revision materials, and study guides for Delhi University courses. Free download and online reading.",
  alternates: { canonical: "/notes" },
};

export default async function NotesPage() {
  const featuredSlugs = await getNotesFeaturedSlugs();
  const [unsorted, allReady] = await Promise.all([getProgrammesWithNotesStatus(featuredSlugs), getReadyNotesByProgramme()]);
  // Admin -> Subject Notes "Shown on the public /notes page" still decides which courses the public sees.
  const ready = featuredSlugs.length ? allReady.filter((p) => featuredSlugs.includes(p.slug)) : allReady;
  const readyCount = ready.reduce((sum, p) => sum + p.subjects.length, 0);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Notes", url: "/notes" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      {/* Done first: every subject that already has notes, by course, so students see what is ready right away. */}
      {ready.length > 0 && (
        <section aria-labelledby="ready-title" className="mb-10 mt-2 sm:mb-14 sm:mt-4">
          <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
            <h2 id="ready-title" className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] sm:text-[34px]">
              Notes ready now
            </h2>
            <p className="text-[15px] text-muted">
              {readyCount} subject{readyCount === 1 ? "" : "s"} in {ready.length} course{ready.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
            {ready.map((p) => (
              <div key={p.slug} className="rounded-[22px] bg-surface-muted p-4 sm:p-5">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="min-w-0 text-[17px] font-semibold leading-snug tracking-[-0.01em]">
                    <Link href={`/notes/${p.slug}`} className="hover:text-brand">{p.name}</Link>
                  </h3>
                  <span className="shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-[12px] font-semibold text-success">
                    {p.subjects.length} done
                  </span>
                </div>
                <ul className="mt-3 flex flex-col">
                  {p.subjects.map((s) => (
                    <li key={s.slug}>
                      <Link
                        href={`/notes/${p.slug}/${s.slug}`}
                        className="flex min-h-11 items-center gap-2.5 border-t border-border/70 py-2 text-[15px] first:border-t-0 hover:text-brand"
                      >
                        <Check size={15} weight="bold" className="shrink-0 text-success" aria-hidden />
                        <span className="min-w-0 flex-1 leading-snug">{s.name}</span>
                        {s.semester ? <span className="shrink-0 text-[13px] text-muted">Sem {s.semester}</span> : null}
                        <CaretRight size={12} weight="bold" className="shrink-0 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Lead capture: course -> semester -> subject -> phone. Nothing is opened for the
          student; the lead lands in Admin -> Leads and the notes go out on WhatsApp. */}
      <section className="mt-1 overflow-hidden rounded-[28px] bg-surface-muted px-4 py-7 sm:mt-3 sm:rounded-[32px] sm:px-10 sm:py-14">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-5xl lg:text-[3.5rem]">
            DU Study Notes by Course &amp; Semester
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-[15px] leading-snug text-muted sm:mt-4 sm:text-[19px] sm:leading-relaxed">
            Pick your course and semester, choose a plan, and get your notes on WhatsApp.
          </p>
        </div>

        <div
          id="get-notes"
          className="mx-auto mt-6 max-w-md scroll-mt-24 rounded-[26px] bg-surface p-4 shadow-[var(--shadow-tile)] sm:mt-10 sm:rounded-[28px] sm:p-7"
        >
          <h2 className="mb-3 text-[20px] font-semibold tracking-[-0.02em] sm:mb-1 sm:text-[22px]">Get your notes</h2>
          <p className="mb-5 hidden text-[15px] text-muted sm:block">No sign-up.</p>
          <NotesBuyForm courses={[...unsorted].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ slug: p.slug, name: p.name }))} />
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

    </div>
  );
}
