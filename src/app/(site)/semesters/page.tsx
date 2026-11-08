// ISR, not force-static — same fix as /browse/college, /notes, and
// /subjects/[id]: force-static bakes this page in once at build time and
// never re-fetches the database again.
export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { NotesPromptAnyCourse } from "@/components/notes-leads/notes-prompt-any";

export const metadata: Metadata = {
  title: "Browse DU Study Material by Semester",
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <NotesPromptAnyCourse />
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="mt-2 max-w-3xl">
        <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-5xl">
          DU Study Material by Semester
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-[17px]">
          Browse question papers, study notes, and syllabus structures by semester.
          Jump straight into odd/even semester resources for all Delhi University courses.
        </p>
      </div>

      {/* Grid of Semesters */}
      <section className="mt-10 grid grid-cols-1 gap-3 sm:mt-12 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {semesterGroups.map((group) => (
          <div key={group.num} className="flex flex-col rounded-[22px] bg-surface-muted p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-[14px] bg-accent-soft text-accent">
                <Calendar size={22} weight="bold" />
              </span>
              <h2 className="text-[19px] font-semibold tracking-[-0.02em] text-foreground">{group.name}</h2>
            </div>

            <p className="mt-3 text-[14px] leading-snug text-muted">
              Browse syllabus and study archives for {group.name} college courses.
            </p>

            <ul className="mt-5 flex-1 divide-y divide-border/70 overflow-hidden rounded-[16px] bg-surface">
              {group.links.length === 0 ? (
                <li className="px-4 py-3 text-[13px] text-muted">No courses listed yet.</li>
              ) : (
                group.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.url}
                      className="group flex items-center justify-between gap-2 px-4 py-3 transition-colors duration-300 hover:bg-surface-muted"
                    >
                      <div className="min-w-0">
                        <span className="block truncate text-[14px] font-medium text-foreground">{link.programName}</span>
                        <span className="mt-0.5 block text-[12px] text-muted">{link.termName} material</span>
                      </div>
                      <CaretRight
                        size={12}
                        weight="bold"
                        className="shrink-0 text-brand transition-transform duration-300 group-hover:translate-x-0.5"
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
