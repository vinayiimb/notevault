import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookOpenText, Calculator, Notebook } from "@phosphor-icons/react/dist/ssr";
import {
  getSeoSubject,
  getSeoProgrammes,
  getRelatedSubjects,
  isProgrammeIndexable,
  isSubjectIndexable,
  getSeoProgrammeSemester,
  getProgrammeSemesterNumbers,
  isProgrammeSemesterIndexable,
  type SeoSubject,
} from "@/lib/du-pyp-seo";
import {
  subjectPapersMetadata,
  programmeSemesterMetadata,
  collectionPageJsonLd,
  absoluteUrl,
} from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { PaperCard } from "@/components/seo/paper-card";
import { ProgrammeSemesterView } from "@/components/seo/programme-semester-view";
import { getSemesterGuidePost, getPyqUsageGuidePost } from "@/lib/blog";

/**
 * One sentence of genuinely subject-specific coverage detail, built only
 * from fields already on `subject` — never invented. Deliberately narrow:
 * `session`/`set` come straight from scraped source data with no
 * normalization (the same subject can carry both "NOV-DEC-2025" and
 * "Nov-Dec" for the same exam), so they're not reliable enough to phrase
 * confidently. `marks` and `courseNumbers` are clean, structured fields —
 * stick to those.
 */
function buildCoverageNote(subject: SeoSubject): string | null {
  if (subject.papers.length === 0) return null;
  const marks = [...new Set(subject.papers.map((p) => p.marks).filter(Boolean))] as string[];
  const sets = [...new Set(subject.papers.map((p) => p.set).filter(Boolean))] as string[];

  const bits: string[] = [];
  if (marks.length === 1) {
    bits.push(`each paper carries ${marks[0]} marks`);
  }
  if (sets.length > 1) {
    bits.push(`multiple question sets are available for some years`);
  }
  if (bits.length === 0) return null;
  return `${bits.join("; ")[0].toUpperCase()}${bits.join("; ").slice(1)}.`;
}

export const revalidate = 86400;
export const dynamicParams = true;

/**
 * `/papers/[programmeSlug]/[subjectSlug]` also serves the programme-semester
 * page at `/papers/[programmeSlug]/semester-N` (N = 1–8). Kept in this one
 * route because Next App Router can't have two dynamic segments at the same
 * level, and no real subject slug ever matches `^semester-[1-8]$`.
 */
function parseSemesterSegment(seg: string): number | null {
  const m = seg.match(/^semester-([1-8])$/);
  return m ? Number(m[1]) : null;
}

export async function generateStaticParams() {
  const progs = await getSeoProgrammes();
  const params: { programmeSlug: string; subjectSlug: string }[] = [];
  // Pre-build subjects of the 10 largest programmes only; the long tail is
  // ISR-on-demand and cached on first hit. Keeps build memory bounded — the
  // 18MB catalog is parsed once, but each rendered page still costs.
  for (const p of progs
    .filter(isProgrammeIndexable)
    .sort((a, b) => b.totalPapers - a.totalPapers)
    .slice(0, 10)) {
    for (const s of p.subjects) {
      if (isSubjectIndexable(s)) params.push({ programmeSlug: p.slug, subjectSlug: s.slug });
    }
    // Also pre-build this programme's semester pages — small in number,
    // high SEO value ("du <course> sem <n> pyq").
    for (const n of await getProgrammeSemesterNumbers(p.slug)) {
      params.push({ programmeSlug: p.slug, subjectSlug: `semester-${n}` });
    }
  }
  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ programmeSlug: string; subjectSlug: string }>;
}): Promise<Metadata> {
  const { programmeSlug, subjectSlug } = await params;

  const semNum = parseSemesterSegment(subjectSlug);
  if (semNum !== null) {
    const ps = await getSeoProgrammeSemester(programmeSlug, semNum);
    if (!ps) return { title: "Not found", robots: { index: false, follow: false } };
    const meta = programmeSemesterMetadata(ps.programme.name, ps.programme.slug, ps.semester, {
      subjectCount: ps.subjects.length,
      paperCount: ps.totalPapers,
      years: ps.years,
    });
    return isProgrammeSemesterIndexable(ps) ? meta : { ...meta, robots: { index: false, follow: true } };
  }

  const found = await getSeoSubject(programmeSlug, subjectSlug);
  if (!found) return { title: "Subject not found", robots: { index: false, follow: false } };

  const { programme, subject } = found;
  const meta = subjectPapersMetadata(subject.name, programme.name, `${programme.slug}/${subject.slug}`, {
    semesters: subject.semesters,
    years: subject.years,
    paperCode: subject.paperCodes[0] ?? null,
    paperCount: subject.papers.length,
  });
  if (!isSubjectIndexable(subject) || !isProgrammeIndexable(programme)) {
    return { ...meta, robots: { index: false, follow: true } };
  }
  return meta;
}

export default async function SubjectPapersPage({
  params,
}: {
  params: Promise<{ programmeSlug: string; subjectSlug: string }>;
}) {
  const { programmeSlug, subjectSlug } = await params;

  // Programme-semester page?
  const semNum = parseSemesterSegment(subjectSlug);
  if (semNum !== null) {
    const ps = await getSeoProgrammeSemester(programmeSlug, semNum);
    if (!ps || ps.subjects.length === 0) notFound();
    const allSems = await getProgrammeSemesterNumbers(programmeSlug);
    return (
      <ProgrammeSemesterView
        data={ps}
        otherSemesters={allSems.filter((n) => n !== semNum)}
        guidePost={getSemesterGuidePost(semNum)}
      />
    );
  }

  const found = await getSeoSubject(programmeSlug, subjectSlug);
  if (!found) notFound();
  const { programme, subject } = found;

  // A subject that resolves but carries no real papers is not a 404 (it's a
  // genuine catalog entry) — but it must not be a soft-200 indexable page.
  const hasContent = subject.papers.length > 0;
  const related = await getRelatedSubjects(programme.slug, subject.slug);
  const pyqUsageGuide = getPyqUsageGuidePost();

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: programme.name, url: `/papers/${programme.slug}` },
    { name: subject.name, url: `/papers/${programme.slug}/${subject.slug}` },
  ];

  const papersByYear = new Map<string, typeof subject.papers>();
  for (const p of subject.papers) {
    const key = p.year ?? "Undated";
    if (!papersByYear.has(key)) papersByYear.set(key, []);
    papersByYear.get(key)!.push(p);
  }
  const years = [...papersByYear.keys()].sort((a, b) =>
    a === "Undated" ? 1 : b === "Undated" ? -1 : Number(b) - Number(a),
  );

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      {hasContent && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(
              collectionPageJsonLd({
                name: `${subject.name} — DU ${programme.name} Previous Year Question Papers`,
                description: `Previous year question papers for ${subject.name} (${programme.name}), Delhi University.`,
                url: absoluteUrl(`/papers/${programme.slug}/${subject.slug}`),
                itemUrls: subject.papers.map((p) => absoluteUrl(`/paper/${p.slug}`)),
              }),
            ),
          }}
        />
      )}
      <VisibleBreadcrumb items={breadcrumbs} />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-accent">
          <BookOpenText size={20} weight="bold" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            <Link href={`/papers/${programme.slug}`} className="hover:underline">
              {programme.name}
            </Link>
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {subject.name} — DU Previous Year Question Papers
        </h1>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted">Programme</dt>
            <dd className="font-medium text-foreground">{programme.name}</dd>
          </div>
          {subject.semesters.length > 0 && (
            <div>
              <dt className="text-muted">Semester</dt>
              <dd className="font-medium text-foreground">{subject.semesters.join(", ")}</dd>
            </div>
          )}
          {subject.paperTypes.length > 0 && (
            <div>
              <dt className="text-muted">Paper type</dt>
              <dd className="font-medium text-foreground">{subject.paperTypes.join(", ")}</dd>
            </div>
          )}
          {subject.paperCodes.length > 0 && (
            <div>
              <dt className="text-muted">Paper code{subject.paperCodes.length > 1 ? "s" : ""}</dt>
              <dd className="font-medium text-foreground">
                {subject.paperCodes.map((c, i) => (
                  <span key={c}>
                    {i > 0 && ", "}
                    <Link href={`/paper-code/${c}`} className="text-accent hover:underline">
                      {c}
                    </Link>
                  </span>
                ))}
              </dd>
            </div>
          )}
          {subject.credits && (
            <div>
              <dt className="text-muted">Credits</dt>
              <dd className="font-medium text-foreground">{subject.credits}</dd>
            </div>
          )}
          {subject.years.length > 0 && (
            <div>
              <dt className="text-muted">Exam years</dt>
              <dd className="font-medium text-foreground">
                {subject.years[subject.years.length - 1]}–{subject.years[0]}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-4 text-muted">
          {hasContent
            ? `${subject.papers.length} previous year question paper${
                subject.papers.length === 1 ? "" : "s"
              } for ${subject.name} at Delhi University (${programme.name}). View or download each original PDF below.`
            : `${subject.name} is part of the Delhi University ${programme.name} syllabus. No previous year question papers have been catalogued for it yet — check back later.`}
        </p>
        {hasContent && buildCoverageNote(subject) && (
          <p className="mt-2 text-sm text-muted">{buildCoverageNote(subject)}</p>
        )}

        {subject.syllabusUrl && (
          <p className="mt-2 text-sm">
            <a
              href={subject.syllabusUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent hover:underline"
            >
              Official DU syllabus PDF for this paper →
            </a>
          </p>
        )}
      </header>

      {hasContent && (
        <div className="space-y-8">
          {years.map((year) => (
            <section key={year}>
              <h2 className="mb-3 text-lg font-bold text-foreground">
                {year === "Undated" ? "Undated papers" : `${year} question papers`}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {papersByYear.get(year)!.map((p) => (
                  <PaperCard key={p.slug} paper={p} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {hasContent && subject.semesters.length > 0 && (
        <section className="mt-14 border-t border-border pt-8">
          <h2 className="mb-4 text-xl font-bold text-foreground">Tools for this subject</h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            <li>
              <Link
                href="/tools/internal-marks-calculator"
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm hover:border-accent/50"
              >
                <Calculator size={18} className="shrink-0 text-accent" weight="bold" />
                <span>
                  <span className="font-medium text-foreground">Internal Marks Calculator</span>
                  <span className="block text-xs text-muted">
                    Check where you stand before the {subject.name} exam
                  </span>
                </span>
              </Link>
            </li>
            <li>
              <Link
                href="/tools/exam-kit"
                className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm hover:border-accent/50"
              >
                <Notebook size={18} className="shrink-0 text-accent" weight="bold" />
                <span>
                  <span className="font-medium text-foreground">Exam Kit</span>
                  <span className="block text-xs text-muted">Build a revision plan around this paper</span>
                </span>
              </Link>
            </li>
            {pyqUsageGuide && (
              <li>
                <Link
                  href={`/blog/${pyqUsageGuide.slug}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 text-sm hover:border-accent/50 sm:col-span-2"
                >
                  <BookOpenText size={18} className="shrink-0 text-accent" weight="bold" />
                  <span>
                    <span className="font-medium text-foreground">{pyqUsageGuide.title}</span>
                    <span className="block text-xs text-muted">
                      How to turn these papers into an actual revision strategy
                    </span>
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {related.length > 0 && (
        <section className="mt-14 border-t border-border pt-8">
          <h2 className="mb-4 text-xl font-bold text-foreground">
            Related subjects in {programme.name}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {related.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/papers/${programme.slug}/${s.slug}`}
                  className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm hover:border-accent/50"
                >
                  <span className="min-w-0 truncate font-medium text-foreground">{s.name}</span>
                  <span className="ml-2 shrink-0 text-xs text-muted">{s.papers.length}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-10 text-sm text-muted">
        <Link href={`/papers/${programme.slug}`} className="text-accent hover:underline">
          ← All {programme.name} subjects
        </Link>
      </p>
    </div>
  );
}
