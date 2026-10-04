import type { Metadata } from "next";
import Link from "next/link";
import { notFound, permanentRedirect } from "next/navigation";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import {
  getSeoProgramme,
  getSeoProgrammes,
  getRelatedProgrammes,
  getProgrammeSemesterNumbers,
  getSeoProgrammeSemester,
  isProgrammeIndexable,
  isProgrammeSemesterIndexable,
  isSubjectIndexable,
  resolvePapersPath,
} from "@/lib/du-pyp-seo";
import {
  programmePapersMetadata,
  programmeFaqs,
  collectionPageJsonLd,
  absoluteUrl,
} from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { FaqBlock } from "@/components/seo/faq-block";
import { ShareButtons } from "@/components/seo/share-buttons";

// Content is derived from a static JSON catalog that changes at most a few
// times a week (new exam sessions). Rebuild pages daily; render on demand
// for programmes not in the pre-built set.
export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const progs = await getSeoProgrammes();
  // Pre-build the 60 largest indexable programmes; the rest render on first
  // request and are then cached (ISR). Keeps build time and memory bounded.
  return progs
    .filter(isProgrammeIndexable)
    .sort((a, b) => b.totalPapers - a.totalPapers)
    .slice(0, 40)
    .map((p) => ({ programmeSlug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programmeSlug: string }>;
}): Promise<Metadata> {
  const { programmeSlug } = await params;
  const programme = await getSeoProgramme(programmeSlug);
  if (!programme) return { title: "Programme not found", robots: { index: false, follow: false } };

  const meta = programmePapersMetadata(
    programme.name,
    programme.slug,
    programme.totalPapers,
    programme.indexableSubjectCount,
  );
  if (!isProgrammeIndexable(programme)) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function ProgrammePapersPage({
  params,
}: {
  params: Promise<{ programmeSlug: string }>;
}) {
  const { programmeSlug } = await params;
  const programme = await getSeoProgramme(programmeSlug);
  if (!programme) {
    const path = await resolvePapersPath(programmeSlug);
    if (path) permanentRedirect(path);
    notFound();
  }

  const indexableSubjects = programme.subjects.filter(isSubjectIndexable);
  if (indexableSubjects.length === 0) notFound();

  const relatedProgrammes = await getRelatedProgrammes(programme.slug);
  const semesterNumbers: number[] = [];
  for (const n of await getProgrammeSemesterNumbers(programme.slug)) {
    const ps = await getSeoProgrammeSemester(programme.slug, n);
    if (ps && isProgrammeSemesterIndexable(ps)) semesterNumbers.push(n);
  }

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: programme.name, url: `/papers/${programme.slug}` },
  ];

  const sortedSubjects = indexableSubjects.slice().sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionPageJsonLd({
              name: `${programme.name} Previous Year Question Papers`,
              description: `Delhi University ${programme.name} previous year question papers by subject.`,
              url: absoluteUrl(`/papers/${programme.slug}`),
              itemUrls: indexableSubjects.map((s) => absoluteUrl(`/papers/${programme.slug}/${s.slug}`)),
            }),
          ),
        }}
      />
      <VisibleBreadcrumb items={breadcrumbs} />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-accent">
          <GraduationCap size={20} weight="bold" />
          <span className="text-sm font-semibold uppercase tracking-wide">Delhi University</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {programme.name} Previous Year Question Papers
        </h1>
        <p className="mt-3 text-muted">
          {programme.totalPapers.toLocaleString("en-IN")} previous year question papers for{" "}
          {programme.name} at Delhi University, covering {indexableSubjects.length} subjects
          {programme.semesters.length > 0
            ? ` across semesters ${programme.semesters.join(", ")}`
            : ""}
          . Each subject page lists the available exam years with links to the original PDF
          question papers.
        </p>
        {programme.paperTypes.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Paper types available: {programme.paperTypes.join(", ")}.
          </p>
        )}
      </header>

      {semesterNumbers.length > 0 && (
        <nav className="mb-8" aria-label="Browse by semester">
          <h2 className="mb-3 text-lg font-bold text-foreground">Browse by semester</h2>
          <ul className="flex flex-wrap gap-2">
            {semesterNumbers.map((n) => (
              <li key={n}>
                <Link
                  href={`/papers/${programme.slug}/semester-${n}`}
                  className="inline-block rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground hover:border-accent/50"
                >
                  Semester {n}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <section>
        <h2 className="mb-3 text-lg font-bold text-foreground">Subjects</h2>
        <ul className="grid gap-2 sm:grid-cols-2">
          {sortedSubjects.map((s) => (
            <li key={s.slug}>
              <Link
                href={`/papers/${programme.slug}/${s.slug}`}
                className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm hover:border-accent/50"
              >
                <span className="min-w-0 truncate font-medium text-foreground">{s.name}</span>
                <span className="ml-2 shrink-0 text-xs text-muted">
                  {s.papers.length} paper{s.papers.length === 1 ? "" : "s"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {relatedProgrammes.length > 0 && (
        <section className="mt-14 border-t border-border pt-8">
          <h2 className="mb-4 text-xl font-bold text-foreground">Related programmes</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {relatedProgrammes.map((p) => (
              <li key={p.slug}>
                <Link
                  href={`/papers/${p.slug}`}
                  className="block rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-medium text-foreground hover:border-accent/50"
                >
                  {p.name}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-10">
        <ShareButtons
          url={absoluteUrl(`/papers/${programme.slug}`)}
          text={`Got the DU ${programme.name} PYQs here:`}
        />
      </div>

      <FaqBlock
        faqs={programmeFaqs({
          name: programme.name,
          paperCount: programme.totalPapers,
          subjectCount: indexableSubjects.length,
          semesters: programme.semesters,
          paperTypes: programme.paperTypes,
        })}
      />

      <p className="mt-10 text-sm text-muted">
        Looking for a different course?{" "}
        <Link href="/previous-year-papers" className="text-accent hover:underline">
          Browse all DU previous year papers
        </Link>
        .
      </p>
    </div>
  );
}
