import Link from "next/link";
import { Stack } from "@phosphor-icons/react/dist/ssr";
import { getPaperTypeHub } from "@/lib/du-pyp-seo";
import { absoluteUrl, collectionPageJsonLd, type Faq } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { FaqBlock } from "@/components/seo/faq-block";
import { ShareButtons } from "@/components/seo/share-buttons";
import { SampleQuestions } from "@/components/seo/sample-questions";
import { getSampleQuestions } from "@/lib/subject-questions";

const TYPES = {
  AEC: { path: "/ability-enhancement-courses", name: "Ability Enhancement Courses (AEC)", blurb: "language and communication papers" },
  SEC: { path: "/skill-enhancement-courses", name: "Skill Enhancement Courses (SEC)", blurb: "hands-on skill papers" },
  VAC: { path: "/value-addition-courses", name: "Value Addition Courses (VAC)", blurb: "value-added papers" },
  GE: { path: "/generic-electives", name: "Generic Electives (GE)", blurb: "cross-discipline elective papers" },
} as const;

export type HubType = keyof typeof TYPES;

export function paperTypeMetadata(type: HubType) {
  const t = TYPES[type];
  const title = `${t.name} Previous Year Question Papers PDF | DU UGCF`;
  const description = `Delhi University ${t.name} previous year question papers (UGCF / NEP 2020) — every ${type} subject with its papers by exam year. View or download the original PDFs, free.`;
  return {
    title,
    description,
    alternates: { canonical: t.path },
    openGraph: { title, description, url: absoluteUrl(t.path), type: "website" as const },
  };
}

/** /ability-enhancement-courses, /skill-enhancement-courses, … — UGCF paper-type landing pages. */
export async function PaperTypeHub({ type }: { type: HubType }) {
  const t = TYPES[type];
  const { subjects, totalPapers } = await getPaperTypeHub(type);
  const samples = await getSampleQuestions(
    subjects
      .slice()
      .sort((a, b) => b.paperCount - a.paperCount)
      .map((s) => ({
        name: s.name,
        href: `/papers/${s.placements[0].programmeSlug}/${s.placements[0].subjectSlug}`,
        paperCodes: s.paperCodes,
      })),
    8,
  );
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: t.name, url: t.path },
  ];
  const faqs: Faq[] = [
    {
      q: `What are ${t.name} at Delhi University?`,
      a: `${type} papers are part of DU's UGCF 2022 (NEP 2020) undergraduate structure — ${t.blurb} taken alongside the main discipline papers. This page lists every ${type} subject that has question papers here.`,
    },
    {
      q: `Where can I download ${type} previous year question papers?`,
      a: `Below are ${subjects.length} ${type} subjects with ${totalPapers.toLocaleString("en-IN")} question papers in total. Open a subject to view or download the original PDFs, free and without login.`,
    },
  ];
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionPageJsonLd({
              name: `${t.name} — DU Previous Year Question Papers`,
              description: `Delhi University ${type} subjects with previous year question papers.`,
              url: t.path,
              itemUrls: subjects.flatMap((s) => s.placements.map((p) => `/papers/${p.programmeSlug}/${p.subjectSlug}`)),
            }),
          ),
        }}
      />
      <VisibleBreadcrumb items={breadcrumbs} />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-accent">
          <Stack size={20} weight="bold" />
          <span className="text-sm font-semibold uppercase tracking-wide">Delhi University · UGCF</span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {t.name} — Previous Year Question Papers
        </h1>
        <p className="mt-3 text-muted">
          {subjects.length} {type} subjects, {totalPapers.toLocaleString("en-IN")} question papers. Pick a subject, then
          the programme you study, to view or download the original PDFs by exam year.
        </p>
      </header>

      <ul className="space-y-2">
        {subjects.map((s) => (
          <li key={s.name} className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-medium text-foreground">{s.name}</span>
              <span className="shrink-0 text-xs text-muted">{s.paperCount} papers</span>
            </div>
            <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
              {s.placements.map((p) => (
                <Link
                  key={p.programmeSlug + p.subjectSlug}
                  href={`/papers/${p.programmeSlug}/${p.subjectSlug}`}
                  className="text-xs text-accent hover:underline"
                >
                  {p.programmeName}
                </Link>
              ))}
            </div>
          </li>
        ))}
      </ul>

      <SampleQuestions title={`Sample questions from recent ${type} papers`} items={samples} />

      <div className="mt-10">
        <ShareButtons url={absoluteUrl(t.path)} text={`DU ${type} previous year papers:`} />
      </div>
      <FaqBlock faqs={faqs} />
    </div>
  );
}
