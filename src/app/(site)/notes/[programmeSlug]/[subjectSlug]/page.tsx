import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCanonicalNote } from "@/lib/canonical-subject-notes-data";
import { NotesSection } from "@/components/subjects/notes-section";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export function generateStaticParams() {
  return [];
}
export const dynamicParams = true;
// ISR, not force-dynamic — keeps this route out of Vercel's serverless
// function count (see the same fix on /subjects/[id]) while still
// re-checking the database regularly so newly-deployed or edited notes
// show up without a full redeploy.
export const revalidate = 60;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programmeSlug: string; subjectSlug: string }>;
}): Promise<Metadata> {
  const { programmeSlug, subjectSlug } = await params;
  const note = await getCanonicalNote(programmeSlug, subjectSlug);
  if (!note || !note.content.trim()) return {};

  const title = `${note.subjectName} Notes – ${note.programmeName}`;
  const description = `Compiled study notes for ${note.subjectName} (${note.programmeName}), built from actual DU previous year question papers — key concepts, definitions, and exam patterns.`;

  return {
    title,
    description,
    alternates: { canonical: `/notes/${programmeSlug}/${subjectSlug}` },
    openGraph: { title, description },
  };
}

export default async function CanonicalSubjectNotePage({
  params,
}: {
  params: Promise<{ programmeSlug: string; subjectSlug: string }>;
}) {
  const { programmeSlug, subjectSlug } = await params;
  const note = await getCanonicalNote(programmeSlug, subjectSlug);
  if (!note || !note.content.trim()) notFound();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Papers", url: "/papers" },
    { name: note.programmeName, url: `/admin/subject-notes/program/${programmeSlug}` },
    { name: note.subjectName, url: `/notes/${programmeSlug}/${subjectSlug}` },
  ];

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />
      <p className="text-sm text-muted">{note.programmeName}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{note.subjectName}</h1>
      <p className="mt-2 text-sm text-muted">
        Compiled from actual DU previous year question papers — key concepts, definitions, and exam
        patterns.
      </p>

      <section className="mt-8">
        <NotesSection content={note.content} theme={note.theme} subjectName={note.subjectName} />
      </section>
    </div>
  );
}
