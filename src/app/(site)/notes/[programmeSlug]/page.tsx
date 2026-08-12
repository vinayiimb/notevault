import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenText } from "@phosphor-icons/react/dist/ssr";
import { getProgrammeSubjectsWithNotesStatus } from "@/lib/canonical-subject-notes-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;
// ISR, not force-dynamic — keeps this off Vercel's serverless function
// count (same reasoning as /subjects/[id] and /browse/college) while still
// picking up newly-deployed notes without a full redeploy.
export const revalidate = 60;

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <p className="text-sm text-muted">
        <Link href="/notes" className="hover:text-accent">
          Notes
        </Link>
      </p>
      <h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold tracking-tight">
        <BookOpenText size={28} className="text-accent" weight="bold" />
        {programme.name}
      </h1>
      <p className="mt-2 text-sm text-muted">
        {programme.subjects.length} subjects · {withNotes.length} with compiled notes
      </p>

      {withNotes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Notes available</h2>
          <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-surface">
            <table className="w-full text-left text-sm">
              <tbody>
                {withNotes.map((s) => (
                  <tr key={s.slug} className="border-b border-border/60 last:border-0 hover:bg-surface-muted">
                    <td className="px-4 py-3 font-medium text-foreground">{s.name}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/notes/${programmeSlug}/${s.slug}`}
                        className="text-xs font-bold text-accent hover:underline"
                      >
                        Read notes →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {withoutNotes.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Coming soon</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {withoutNotes.map((s) => (
              <span
                key={s.slug}
                className="rounded-full bg-surface-muted px-3 py-1 text-xs text-muted"
              >
                {s.name}
              </span>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
