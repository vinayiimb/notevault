import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getProgrammeSubjectsWithNotesStatus } from "@/lib/canonical-subject-notes-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { LeadGateButton, LeadGateLink, LeadGateProvider } from "@/components/notes-leads/lead-gate";

export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;
// ISR, not force-dynamic — keeps this off Vercel's serverless function
// count (same reasoning as /subjects/[id] and /browse/college) while still
// picking up newly-deployed notes without a full redeploy.
export const revalidate = 3600;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programmeSlug: string }>;
}): Promise<Metadata> {
  const { programmeSlug } = await params;
  const programme = await getProgrammeSubjectsWithNotesStatus(programmeSlug);
  if (!programme) return {};

  const title = `${programme.name} — Study Notes | DU PYQ Online`;
  const description = `Compiled study notes for ${programme.name}, organized by subject — built from actual DU previous year question papers.`;

  return {
    title,
    description,
    alternates: { canonical: `/notes/${programmeSlug}` },
    openGraph: { title, description },
  };
}

export default async function ProgrammeNotesPage({
  params,
}: {
  params: Promise<{ programmeSlug: string }>;
}) {
  const { programmeSlug } = await params;
  const programme = await getProgrammeSubjectsWithNotesStatus(programmeSlug);
  if (!programme) notFound();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Notes", url: "/notes" },
    { name: programme.name, url: `/notes/${programmeSlug}` },
  ];

  const withNotes = programme.subjects.filter((s) => s.hasNotes);
  const withoutNotes = programme.subjects.filter((s) => !s.hasNotes);

  // Semester is admin-set per note (canonical-programmes.json has no
  // semester field), so some notes may not have one yet — those land in
  // "Other" rather than being dropped from the list.
  const bySemester = new Map<number | "other", typeof withNotes>();
  for (const s of withNotes) {
    const key = s.semester ?? "other";
    if (!bySemester.has(key)) bySemester.set(key, []);
    bySemester.get(key)!.push(s);
  }
  const semesterGroups = [...bySemester.entries()].sort((a, b) => {
    if (a[0] === "other") return 1;
    if (b[0] === "other") return -1;
    return a[0] - b[0];
  });

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <p className="text-sm text-muted">
        <Link href="/notes" className="hover:text-accent">
          Notes
        </Link>
      </p>
      <h1 className="mt-2 text-balance font-display text-[2rem] font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl">
        {programme.name}
      </h1>
      <p className="mt-3 text-[15px] text-muted sm:text-[17px]">
        {programme.subjects.length} subjects · {withNotes.length} with compiled notes
      </p>

      <LeadGateProvider
        course={{ slug: programmeSlug, name: programme.name }}
        subjects={programme.subjects.map(({ slug, name, hasNotes, semester }) => ({ slug, name, hasNotes, semester }))}
      >
      {semesterGroups.length > 0 && (
        <section className="mt-10 space-y-8">
          {semesterGroups.map(([semester, subjects]) => (
            <div key={semester}>
              <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">
                {semester === "other" ? "Notes available" : `Semester ${semester}`}
              </h2>
              <ul className="mt-3 divide-y divide-border/70 overflow-hidden rounded-[22px] bg-surface-muted">
                {subjects.map((s) => (
                  <li key={s.slug}>
                    <LeadGateLink
                      href={`/notes/${programmeSlug}/${s.slug}`}
                      subjectSlug={s.slug}
                      className="flex items-center justify-between gap-4 px-5 py-4 transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]"
                    >
                      <span className="text-[16px] font-medium leading-snug tracking-[-0.01em] text-foreground">{s.name}</span>
                      <span className="inline-flex shrink-0 items-center gap-0.5 text-[13px] font-medium text-brand">
                        Get notes <CaretRight size={12} weight="bold" />
                      </span>
                    </LeadGateLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {withoutNotes.length > 0 && (
        <section className="mt-8">
          <h2 className="px-1 text-[13px] font-semibold uppercase tracking-wide text-muted">Coming soon</h2>
          <p className="mt-1 text-xs text-muted">Tap a subject and we&apos;ll WhatsApp you when its notes are ready.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {withoutNotes.map((s) => (
              <LeadGateButton
                key={s.slug}
                subjectSlug={s.slug}
                className="rounded-full bg-surface-muted px-3.5 py-1.5 text-left text-[13px] text-muted transition-colors duration-300 hover:bg-accent-soft hover:text-accent"
              >
                {s.name}
              </LeadGateButton>
            ))}
          </div>
        </section>
      )}
      </LeadGateProvider>
    </div>
  );
}
