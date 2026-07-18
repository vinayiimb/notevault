import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CoverageFilters } from "@/components/coverage/coverage-filters";

export default async function AdminCoveragePage({
  searchParams,
}: {
  searchParams: Promise<{ programId?: string; termId?: string }>;
}) {
  const { programId = "", termId = "" } = await searchParams;

  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: {
      terms: {
        orderBy: { order: "asc" },
        include: { subjects: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
    },
  });
  const programData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name, subjects: t.subjects })),
  }));

  const term = termId
    ? await prisma.term.findUnique({
        where: { id: termId },
        include: {
          program: { select: { name: true } },
          subjects: {
            orderBy: { name: "asc" },
            include: {
              resources: {
                where: { type: "PYQ" },
                orderBy: [{ year: "asc" }, { createdAt: "asc" }],
                select: { id: true, title: true, year: true, createdAt: true },
              },
            },
          },
        },
      })
    : null;

  // A fixed 2020-current baseline so a fully-missing year still shows as an
  // empty column (that's the whole point — spotting gaps at a glance), plus
  // any outlier years actually present in the data.
  const currentYear = new Date().getFullYear();
  const yearsInData = term
    ? term.subjects.flatMap((s) => s.resources.map((r) => r.year).filter((y): y is number => y != null))
    : [];
  const minYear = Math.min(2020, ...(yearsInData.length ? yearsInData : [2020]));
  const maxYear = Math.max(currentYear, ...(yearsInData.length ? yearsInData : [currentYear]));
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i).reverse();

  const flatList = term
    ? term.subjects.flatMap((s) =>
        s.resources.map((r) => ({ ...r, subjectName: s.name, subjectId: s.id }))
      )
    : [];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">PYQ coverage</h1>
      <p className="mt-1 text-sm text-muted">
        Pick a course and semester to see which years are missing for each subject — useful
        when uploading papers in batches across multiple zips.
      </p>

      <div className="mt-6">
        <CoverageFilters programs={programData} programId={programId} termId={termId} />
      </div>

      {!term && (
        <p className="mt-6 text-sm text-muted">Pick a course and semester above to see coverage.</p>
      )}

      {term && (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="sticky left-0 z-10 min-w-56 bg-surface-muted px-4 py-2 text-left font-medium">
                    Subject
                  </th>
                  {years.map((y) => (
                    <th key={y} className="px-3 py-2 text-center font-medium">
                      {y}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                {term.subjects.map((s) => {
                  const total = s.resources.length;
                  return (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="sticky left-0 z-10 bg-surface px-4 py-2 font-medium">
                        <Link href={`/admin/subjects/${s.id}`} className="hover:text-accent">
                          {s.name}
                        </Link>
                      </td>
                      {years.map((y) => {
                        const count = s.resources.filter((r) => r.year === y).length;
                        return (
                          <td
                            key={y}
                            className={`px-3 py-2 text-center ${
                              count === 0 ? "text-muted" : "font-semibold text-green"
                            }`}
                          >
                            {count === 0 ? "—" : count}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center text-muted">{total}</td>
                    </tr>
                  );
                })}
                {term.subjects.length === 0 && (
                  <tr>
                    <td colSpan={years.length + 2} className="px-4 py-6 text-center text-muted">
                      No subjects in this semester yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <h2 className="mt-10 text-lg font-semibold">
            Full list — {term.program.name} · {term.name} ({flatList.length} papers)
          </h2>
          <div className="mt-3 overflow-hidden rounded-xl border border-border">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted">
                  <th className="px-4 py-2 text-left font-medium">Subject</th>
                  <th className="px-4 py-2 text-left font-medium">Title</th>
                  <th className="px-4 py-2 text-left font-medium">Year</th>
                  <th className="px-4 py-2 text-left font-medium">Uploaded</th>
                </tr>
              </thead>
              <tbody>
                {flatList
                  .slice()
                  .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || (a.year ?? 0) - (b.year ?? 0))
                  .map((r) => (
                    <tr key={r.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <Link href={`/admin/subjects/${r.subjectId}`} className="hover:text-accent">
                          {r.subjectName}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{r.title}</td>
                      <td className="px-4 py-2">{r.year ?? "—"}</td>
                      <td className="px-4 py-2 text-muted">{r.createdAt.toLocaleDateString()}</td>
                    </tr>
                  ))}
                {flatList.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted">
                      No PYQ papers uploaded for this semester yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
