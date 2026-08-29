import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hash } from "@phosphor-icons/react/dist/ssr";
import {
  getSeoPaperCode,
  getIndexablePaperCodeUrls,
  isPaperCodeIndexable,
} from "@/lib/du-pyp-seo";
import { paperCodeMetadata, collectionPageJsonLd, absoluteUrl } from "@/lib/seo";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { PaperCard } from "@/components/seo/paper-card";

export const revalidate = 86400;
export const dynamicParams = true;

export async function generateStaticParams() {
  const urls = await getIndexablePaperCodeUrls();
  // Pre-build the first 200; the rest are ISR-on-demand.
  return urls.slice(0, 200).map((u) => ({ code: u.path.split("/").pop()! }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const pc = await getSeoPaperCode(code);
  if (!pc) return { title: "Paper code not found", robots: { index: false, follow: false } };

  const meta = paperCodeMetadata(pc.code, pc.subjectNames, pc.papers.length, pc.years);
  if (!isPaperCodeIndexable(pc)) return { ...meta, robots: { index: false, follow: true } };
  return meta;
}

export default async function PaperCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const pc = await getSeoPaperCode(code);
  if (!pc || pc.papers.length === 0) notFound();

  const primary = pc.subjectNames[0] ?? "Course";
  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
    { name: `Paper code ${pc.code}`, url: `/paper-code/${pc.code}` },
  ];

  const papersByYear = new Map<string, typeof pc.papers>();
  for (const p of pc.papers) {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            collectionPageJsonLd({
              name: `Paper code ${pc.code} — ${primary} DU Previous Year Papers`,
              description: `Delhi University question papers for Unique Paper Code ${pc.code} (${primary}).`,
              url: absoluteUrl(`/paper-code/${pc.code}`),
              itemUrls: pc.papers.map((p) => absoluteUrl(`/paper/${p.slug}`)),
            }),
          ),
        }}
      />
      <VisibleBreadcrumb items={breadcrumbs} />

      <header className="mb-8">
        <div className="mb-2 flex items-center gap-2 text-accent">
          <Hash size={20} weight="bold" />
          <span className="text-sm font-semibold uppercase tracking-wide">
            DU Unique Paper Code
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">
          {pc.code} — {primary}
        </h1>
        <p className="mt-3 text-muted">
          Unique Paper Code <strong className="text-foreground">{pc.code}</strong> at Delhi
          University{" "}
          {pc.subjectNames.length > 1
            ? `covers the papers ${pc.subjectNames.join(", ")}`
            : `is the paper "${primary}"`}
          .{" "}
          {pc.papers.length} previous year question paper{pc.papers.length === 1 ? "" : "s"}
          {pc.years.length > 1
            ? ` from ${pc.years[pc.years.length - 1]}–${pc.years[0]}`
            : pc.years[0]
              ? ` from ${pc.years[0]}`
              : ""}
          {pc.credits ? `, ${pc.credits} credits` : ""}.
        </p>

        {pc.placements.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-muted">Appears under:</p>
            <ul className="flex flex-wrap gap-2">
              {pc.placements.map((pl) => (
                <li key={`${pl.programmeSlug}/${pl.subjectSlug}`}>
                  <Link
                    href={`/papers/${pl.programmeSlug}/${pl.subjectSlug}`}
                    className="inline-block rounded-lg border border-border bg-surface px-3 py-1.5 text-sm font-medium text-foreground hover:border-accent/50"
                  >
                    {pl.subjectName} · {pl.programmeName}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {pc.syllabusUrl && (
          <p className="mt-3 text-sm">
            <a
              href={pc.syllabusUrl}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="text-accent hover:underline"
            >
              Official DU syllabus PDF →
            </a>
          </p>
        )}
      </header>

      <div className="space-y-8">
        {years.map((year) => (
          <section key={year}>
            <h2 className="mb-3 text-lg font-bold text-foreground">
              {year === "Undated" ? "Undated papers" : `${year} question papers`}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {papersByYear.get(year)!.map((p) => (
                <PaperCard key={p.slug} paper={p} showSubject={pc.subjectNames.length > 1} />
              ))}
            </div>
          </section>
        ))}
      </div>

      <p className="mt-10 text-sm text-muted">
        <Link href="/tools/du-paper-code-finder" className="text-accent hover:underline">
          Decode another DU paper code →
        </Link>
      </p>
    </div>
  );
}
