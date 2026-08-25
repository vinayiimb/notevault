export function generateStaticParams() { return []; }
export const dynamicParams = true;
export const dynamic = "force-dynamic";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CatalogCourseCoverageTable } from "@/components/coverage/catalog-course-coverage-table";
import { getCatalogCourseCoverage } from "@/lib/pyq-catalog";

export default async function CourseCoveragePage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = await params;
  const data = await getCatalogCourseCoverage(programId);
  if (!data) notFound();
  const completeSubjects = data.rows.filter((row) =>
    row.cells.every((cell) => cell.papers.length > 0),
  ).length;

  return (
    <div className="p-8">
      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <p className="text-sm text-muted">
          <Link href="/admin/course-coverage" className="hover:text-accent">
            Catalog coverage
          </Link>
        </p>
        <p className="mt-6 text-xs font-semibold text-accent">Course</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          {data.course}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Each column preserves the college library&apos;s source-year label. Open a checked cell to inspect
          every file option or add another PDF; open an empty cell to upload the missing paper directly into
          the public Full Archive.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <span className="rounded-full bg-surface-muted px-3 py-1.5 text-muted">
            {data.rows.length} subjects
          </span>
          <span className="rounded-full bg-success-soft px-3 py-1.5 font-medium text-success">
            {completeSubjects} complete across all years
          </span>
          <span className="rounded-full bg-surface-muted px-3 py-1.5 text-muted">
            {data.rows.length - completeSubjects} still missing a year
          </span>
        </div>

        <div className="mt-8">
          <h2 className="mb-3 text-lg font-semibold">Subjects and year coverage</h2>
          <CatalogCourseCoverageTable data={data} />
        </div>

        <aside className="mt-8 rounded-xl bg-yellow-soft px-4 py-3 text-sm leading-6 text-muted">
          “2023-2025” is intentionally left as one source column because that is how the college library
          grouped the files; it may contain more than one academic-year sitting.
        </aside>
      </div>
    </div>
  );
}
