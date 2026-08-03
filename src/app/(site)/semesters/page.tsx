export const dynamic = "force-static";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Browse DU Study Material by Semester | DU PYQ Online",
  description: "Browse Delhi University study materials, question papers, notes, and syllabus organized from Semester 1 to Semester 6.",
  alternates: { canonical: "/semesters" },
};

export default async function SemestersPage() {
  const programs = await getProgramsByLevel("COLLEGE");

  // Dynamically map and group terms under Semester 1 to Semester 6
  const semesterGroups = [1, 2, 3, 4, 5, 6].map((num) => {
    const links = programs.flatMap((program) => {
      const term = program.terms.find((t) => {
        const match = t.name.match(/\d+/);
        return (match && parseInt(match[0]) === num) || t.order === num;
      });
      if (term) {
        return [{
          id: term.id,
          programName: program.name.replace(" — University of Delhi", ""),
          termName: term.name,
          url: `/terms/${term.id}`,
        }];
      }
      return [];
    });

    return {
      num,
      name: `Semester ${num}`,
      links,
    };
  });

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Semesters", url: "/semesters" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          DU Study Material by Semester
        </h1>
        <p className="mt-3 text-base text-muted">
          Browse question papers, study notes, and syllabus structures by semester. 
          Jump straight into odd/even semester resources for all Delhi University courses.
        </p>
      </div>

      {/* Grid of Semesters */}
      <section className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {semesterGroups.map((group) => (
          <div
            key={group.num}
            className="flex flex-col rounded-2xl border border-border bg-surface p-6 transition hover:border-accent hover:shadow-xs"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Calendar size={20} weight="bold" />
              </span>
              <h2 className="font-bold text-foreground text-lg sm:text-xl">
                {group.name}
              </h2>
            </div>
            
            <p className="text-xs text-muted mt-2">
              Browse syllabus and study archives for {group.name} college courses.
            </p>

            <ul className="mt-6 flex-1 space-y-3.5 border-t border-border/40 pt-4">
              {group.links.length === 0 ? (
                <li className="text-xs text-muted">No courses listed yet.</li>
              ) : (
                group.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.url}
                      className="group flex items-start justify-between text-xs text-muted hover:text-accent"
                    >
                      <div className="min-w-0 pr-2">
                        <span className="font-medium text-foreground truncate block group-hover:text-accent">
                          {link.programName}
                        </span>
                        <span className="text-[10px] mt-0.5 block">{link.termName} material</span>
                      </div>
                      <CaretRight
                        size={12}
                        weight="bold"
                        className="text-muted/60 shrink-0 self-center transition-transform group-hover:translate-x-0.5 group-hover:text-accent"
                      />
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        ))}
      </section>
    </div>
  );
}
