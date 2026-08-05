import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Browse DU Courses",
  description:
    "Browse every Delhi University degree course on DU PYQ Online and jump straight to its semester-wise previous year question papers and notes.",
  alternates: { canonical: "/courses" },
};

const breadcrumbs = [
  { name: "Home", url: "/" },
  { name: "Courses", url: "/courses" },
];

export default async function CoursesPage() {
  const programs = await getProgramsByLevel("COLLEGE");
  const jumpData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />
      <p className="text-sm text-muted">Courses</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Browse Delhi University Courses
      </h1>
      <p className="mt-2 text-sm text-muted">
        Pick your course and semester for a quick jump, or browse every course below.
      </p>

      {programs.length > 0 && (
        <div className="mt-6 max-w-2xl">
          <CourseSemesterJump programs={jumpData} />
        </div>
      )}

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-muted">
        Browse all courses
      </h2>

      {programs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No programs added yet. Check back soon.</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="bg-surface-muted/35 text-xs text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Course</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Semesters</th>
                  <th scope="col" className="px-4 py-3 font-semibold">Subjects</th>
                  <th scope="col" className="w-12 px-4 py-3"><span className="sr-only">Open course</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {programs.map((program) => {
                  const subjectCount = program.terms.reduce((n, t) => n + t.subjects.length, 0);
                  return (
                    <tr key={program.id} className="relative transition-colors hover:bg-accent-soft/35 focus-within:bg-accent-soft/35">
                      <th scope="row" className="px-5 py-4 font-medium sm:px-6">
                        <Link
                          href={`/programs/${program.slug}`}
                          className="inline-flex items-center gap-2 text-left text-foreground outline-none transition before:absolute before:inset-0 before:content-[''] hover:text-accent hover:underline focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                        >
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                            <GraduationCap size={16} weight="bold" />
                          </span>
                          <span>
                            {program.name}
                            {program.summary && (
                              <span className="mt-0.5 block text-xs font-normal text-muted">{program.summary}</span>
                            )}
                          </span>
                        </Link>
                      </th>
                      <td className="px-4 py-4 text-muted">
                        {program.terms.length} term{program.terms.length === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-4 text-muted">
                        {subjectCount} subject{subjectCount === 1 ? "" : "s"}
                      </td>
                      <td className="px-4 py-4 text-right">
                        <ArrowRight aria-hidden="true" size={17} weight="bold" className="inline-block text-muted" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
