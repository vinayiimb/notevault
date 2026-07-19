import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { CoverageFilters } from "@/components/coverage/coverage-filters";
import { CoverageResourceTable } from "@/components/coverage/coverage-resource-table";

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

  // Fixed 5-step buckets rather than scaling to the max in view — PYQ counts
  // per subject/year are usually 0-3, so a relative scale would make a
  // single paper look "maximum hot" and wash out the signal.
  function heatClass(count: number) {
    if (count === 0) return "bg-transparent text-muted";
    if (count === 1) return "bg-heat-2 text-heat-text";
    if (count === 2) return "bg-heat-3 text-heat-text";
    if (count === 3) return "bg-heat-4 text-heat-text";
    if (count === 4) return "bg-heat-5 text-heat-text";
    return "bg-heat-6 text-heat-text";
  }

  return (
    <div className="p-8">
      <div className="rounded-[28px] border border-border bg-surface p-8 shadow-[0_10px_40px_rgba(15,23,42,.06)] sm:p-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          PYQ coverage
        </h1>
        <p className="mt-2 text-sm text-muted">
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
            <div className="mt-8 overflow-x-auto rounded-2xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="sticky left-0 z-10 min-w-56 bg-surface px-5 py-3 text-left text-xs font-bold tracking-wider text-muted uppercase">
                      Subject
                    </th>
                    {years.map((y) => (
                      <th
                        key={y}
                        className="px-3 py-3 text-center text-xs font-bold tracking-wider text-muted uppercase"
                      >
                        {y}
                      </th>
                    ))}
                    <th className="px-4 py-3 text-center text-xs font-bold tracking-wider text-muted uppercase">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {term.subjects.map((s) => {
                    const total = s.resources.length;
                    return (
                      <tr
                        key={s.id}
                        className="border-b border-[#F1F5F9] transition-colors last:border-0 hover:bg-surface-muted dark:border-border"
                        style={{ height: 56 }}
                      >
                        <td className="sticky left-0 z-10 bg-surface px-5 py-2 font-medium">
                          <Link href={`/admin/subjects/${s.id}`} className="hover:text-accent">
                            {s.name}
                          </Link>
                        </td>
                        {years.map((y) => {
                          const count = s.resources.filter((r) => r.year === y).length;
                          return (
                            <td
                              key={y}
                              className={`px-3 py-2 text-center text-sm font-semibold transition-colors ${heatClass(count)}`}
                            >
                              {count === 0 ? "—" : count}
                            </td>
                          );
                        })}
                        <td className="px-4 py-2 text-center font-semibold text-foreground">{total}</td>
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
            <p className="mt-1 text-xs text-muted">
              Edit inline to fix a wrong year or move a paper to a different subject.
            </p>
            <div className="mt-3 overflow-hidden rounded-2xl border border-border">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted">
                    <th className="px-4 py-2 text-left text-xs font-bold tracking-wider text-muted uppercase">
                      Subject
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold tracking-wider text-muted uppercase">
                      Title
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold tracking-wider text-muted uppercase">
                      Year
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold tracking-wider text-muted uppercase">
                      Uploaded
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-bold tracking-wider text-muted uppercase"></th>
                  </tr>
                </thead>
                <tbody>
                  <CoverageResourceTable
                    rows={flatList.map((r) => ({
                      id: r.id,
                      subjectId: r.subjectId,
                      subjectName: r.subjectName,
                      title: r.title,
                      type: "PYQ",
                      year: r.year,
                      createdAt: r.createdAt.toLocaleDateString(),
                    }))}
                    subjects={term.subjects.map((s) => ({ id: s.id, name: s.name }))}
                  />
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
