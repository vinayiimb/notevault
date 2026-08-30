import Link from "next/link";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import type { SeoProgrammeSemester } from "@/lib/du-pyp-seo";
import { collectionPageJsonLd, absoluteUrl } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

/**
 * /papers/[programmeSlug]/semester-[n] — one semester of one DU programme.
 * Targets the "du [course] sem [n] pyq" query. Lists every subject taught in
 * that semester, grouped by paper type, each linking to its subject page.
 */
export function ProgrammeSemesterView({
  data,
  otherSemesters,
}: {
  data: SeoProgrammeSemester;
  otherSemesters: number[];
}) {
  const { programme, semester, subjects, paperTypes, totalPapers, years } = data;

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: programme.name, url: `/papers/${programme.slug}` },
    { name: `Semester ${semester}`, url: `/papers/${programme.slug}/semester-${semester}` },
  ];

  // Group subjects by paper type (DSC first).
  const TYPE_ORDER = ["DSC", "DSE", "GE", "AEC", "SEC", "VAC", "Academic Track", "Community Outreach", "Compulsory"];
  const byType = new Map<string, typeof subjects>();
  for (const s of subjects) {
    const t = s.paperTypes[0] ?? "Other";
    if (!byType.has(t)) byType.set(t, []);
    byType.get(t)!.push(s);
  }
  const orderedTypes = [
    ...TYPE_ORDER.filter((t) => byType.has(t)),
    ...[...byType.keys()].filter((t) => !TYPE_ORDER.includes(t)),
  ];

  const yearSpan = years.length > 1 ? `${years[years.length - 1]}–${years[0]}` : years[0];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionPageJsonLd({
              name: `${programme.name} Semester ${semester} — DU Previous Year Question Papers`,
              description: `Delhi University ${programme.name} Semester ${semester} previous year question papers, by subject.`,
              url: absoluteUrl(`/papers/${programme.slug}/semester-${semester}`),
              itemUrls: subjects.map((s) => absoluteUrl(`/papers/${programme.slug}/${s.slug}`)),
            }),
          ),
        }}
      />
      <VisibleBreadcrumb items={breadcrumbs} />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-accent">
          <CalendarBlank size={20} weight="bold" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            <Link href={`/papers/${programme.slug}`} className="hover:underline">
              {programme.name}
            </Link>
            {" · Delhi University"}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {programme.name} Semester {semester} Previous Year Question Papers
        </h1>
        <p className="mt-3 text-muted">
          All Semester {semester} subjects for {programme.name} at Delhi University —{" "}
          {subjects.length} subjects, {totalPapers.toLocaleString("en-IN")} previous year question
          papers{yearSpan ? ` from ${yearSpan}` : ""}. Open any subject to view or download the
          original PDF papers by year.
        </p>
        {paperTypes.length > 0 && (
          <p className="mt-2 text-sm text-muted">
            Paper types this semester: {paperTypes.join(", ")}.
          </p>
        )}
      </header>

      <div className="space-y-8">
        {orderedTypes.map((type) => (
          <section key={type}>
            <h2 className="mb-3 text-lg font-bold text-foreground">
              {type === "DSC"
                ? "Core papers (DSC)"
                : type === "DSE"
                  ? "Discipline electives (DSE)"
                  : type === "GE"
                    ? "Generic electives (GE)"
                    : `${type} papers`}
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {byType
                .get(type)!
                .slice()
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
        ))}
      </div>

      {otherSemesters.length > 0 && (
        <nav className="mt-14 border-t border-border pt-8" aria-label="Other semesters">
          <h2 className="mb-4 text-xl font-bold text-foreground">
            Other semesters — {programme.name}
          </h2>
          <ul className="flex flex-wrap gap-2">
            {otherSemesters.map((n) => (
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

      <p className="mt-10 text-sm text-muted">
        <Link href={`/papers/${programme.slug}`} className="text-accent hover:underline">
          ← All {programme.name} semesters &amp; subjects
        </Link>
      </p>
    </div>
  );
}
