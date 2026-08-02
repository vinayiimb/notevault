import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarBlank } from "@phosphor-icons/react/dist/ssr";
import { getProgramBySlug } from "@/lib/data";
import { levelLabel } from "@/lib/utils";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) return {};

  const title = `${program.name} PYQs & Notes`;
  const description = `Browse ${program.name} previous year question papers and notes by semester and subject on DU PYQ Online.`;

  return {
    title,
    description,
    alternates: { canonical: `/programs/${program.slug}` },
    openGraph: { title, description },
  };
}

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const program = await getProgramBySlug(slug);
  if (!program) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: "/" },
          { name: program.name, url: `/programs/${program.slug}` },
        ]}
      />
      <p className="text-sm text-muted">{levelLabel(program.level)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">{program.name}</h1>
      {program.summary && <p className="mt-2 max-w-2xl text-muted">{program.summary}</p>}

      {program.terms.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No terms added yet.</p>
      ) : (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {program.terms.map((term) => (
            <Link
              key={term.id}
              href={`/terms/${term.id}`}
              className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
            >
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                <CalendarBlank size={20} weight="bold" />
              </span>
              <h2 className="font-medium">{term.name}</h2>
              <p className="mt-auto text-xs text-muted">
                {term.subjects.length} subject{term.subjects.length === 1 ? "" : "s"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
