import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import {
  getSeoProgramme,
  getSeoProgrammes,
  getRelatedProgrammes,
  isProgrammeIndexable,
  isSubjectIndexable,
  type SeoSubject,
} from "@/lib/du-pyp-seo";
import {
  programmePapersMetadata,
  collectionPageJsonLd,
  absoluteUrl,
} from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

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

const ROMAN_TO_NUM: Record<string, number> = {
  I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8,
};

function SemesterGroup({
  programmeSlug,
  semester,
  subjects,
}: {
  programmeSlug: string;
  semester: string;
  subjects: SeoSubject[];
}) {
  const semNum = ROMAN_TO_NUM[semester];
  return (
    <section>
      <h2 className="mb-3 text-lg font-bold text-foreground">
        {semNum ? (
          <Link
            href={`/papers/${programmeSlug}/semester-${semNum}`}
            className="hover:text-accent hover:underline"
          >
            Semester {semester}
          </Link>
        ) : (
          <>Semester {semester}</>
        )}
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {subjects.map((s) => (
          <li key={s.slug}>
            <Link
              href={`/papers/${programmeSlug}/${s.slug}`}
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
  );
}

export default async function ProgrammePapersPage({
  params,
}: {
  params: Promise<{ programmeSlug: string }>;
}) {
  const { programmeSlug } = await params;
  const programme = await getSeoProgramme(programmeSlug);
  if (!programme) notFound();

  const indexableSubjects = programme.subjects.filter(isSubjectIndexable);
  if (indexableSubjects.length === 0) notFound();

  const relatedProgrammes = await getRelatedProgrammes(programme.slug);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: programme.name, url: `/papers/${programme.slug}` },
  ];

  // Bucket subjects by semester (a subject can appear in more than one).
  const bySemester = new Map<string, SeoSubject[]>();
  const noSemester: SeoSubject[] = [];
  for (const s of indexableSubjects) {
    if (s.semesters.length === 0) {
      noSemester.push(s);
      continue;
    }
    for (const sem of s.semesters) {
      if (!bySemester.has(sem)) bySemester.set(sem, []);
      bySemester.get(sem)!.push(s);
    }
  }
  const orderedSemesters = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "Pool"].filter((s) =>
    bySemester.has(s),
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionPageJsonLd({
              name: `${programme.name} Previous Year Question Papers`,
              description: `Delhi University ${programme.name} previous year question papers by semester and subject.`,
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

      <div className="space-y-8">
        {orderedSemesters.map((sem) => (
          <SemesterGroup
            key={sem}
            programmeSlug={programme.slug}
            semester={sem}
            subjects={bySemester
              .get(sem)!
              .slice()
              .sort((a, b) => a.name.localeCompare(b.name))}
          />
        ))}

        {noSemester.length > 0 && (
          <section>
            <h2 className="mb-3 text-lg font-bold text-foreground">Other subjects</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {noSemester
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((s) => (
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
        )}
      </div>

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
