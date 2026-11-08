// ISR, not force-static — same fix as /browse/college, /notes, and
// /subjects/[id]: force-static bakes this page in once at build time and
// never re-fetches the database again.
export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, CaretRight, Scroll } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Delhi University Syllabus",
  description: "Browse the latest Delhi University syllabus, course structures, and paper types for DU undergraduate programs.",
  alternates: { canonical: "/syllabus" },
};

export default async function SyllabusPage() {
  const programs = await getProgramsByLevel("COLLEGE");

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Syllabus", url: "/syllabus" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="mt-2 max-w-3xl">
        <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-5xl">
          Delhi University Course Syllabus
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-[17px]">
          Browse the official Delhi University Undergraduate Curriculum Framework (UGCF) syllabus.
          View course structures, credits, paper types (DSC, DSE, GE, SEC, VAC, AEC), and subject listings.
        </p>
      </div>

      {/* Overview */}
      <section className="mt-8 rounded-[28px] bg-surface-muted p-5 sm:p-8">
        <h2 className="flex items-center gap-2 text-[19px] font-semibold tracking-[-0.02em] text-foreground">
          <Scroll size={20} className="text-accent" />
          Understanding the DU UGCF course structure
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-3 text-[14px] leading-snug text-muted sm:grid-cols-2 md:grid-cols-3">
          {[
            ["DSC (Core Course)", "Discipline Specific Core courses are compulsory modules essential to the primary program."],
            ["DSE (Elective Course)", "Discipline Specific Elective papers offer specialized topics in the core field."],
            ["GE (Generic Elective)", "Generic Elective courses are interdisciplinary options chosen from other programs."],
          ].map(([name, text]) => (
            <div key={name} className="rounded-[18px] bg-surface p-4">
              <span className="mb-1 block text-[15px] font-semibold text-foreground">{name}</span>
              {text}
            </div>
          ))}
        </div>
      </section>

      {/* Program Syllabus Grid */}
      <section className="mt-12 sm:mt-16">
        <h2 className="flex items-center gap-2 font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] sm:text-[32px]">
          <BookOpen size={26} className="shrink-0 text-accent" />
          Syllabus by degree programme
        </h2>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
          {programs.map((program) => {
            const subjectCount = program.terms.reduce((n, t) => n + t.subjects.length, 0);

            return (
              <div key={program.id} className="flex flex-col justify-between rounded-[22px] bg-surface-muted p-5 sm:p-6">
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">
                      {program.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[12px] font-semibold text-accent">
                      {subjectCount} subjects
                    </span>
                  </div>
                  {program.summary && <p className="mt-1.5 text-[13px] text-muted">{program.summary}</p>}

                  <div className="mt-4 space-y-4">
                    {program.terms.map((term) => (
                      <div key={term.id}>
                        <Link
                          href={`/terms/${term.id}`}
                          className="text-[14px] font-semibold text-foreground hover:text-brand"
                        >
                          {term.name}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {term.subjects.slice(0, 4).map((sub: { id: string; name: string }) => (
                            <Link
                              key={sub.id}
                              href={`/subjects/${sub.id}`}
                              className="rounded-full bg-surface px-2.5 py-1 text-[12px] text-muted transition-colors duration-300 hover:bg-accent-soft hover:text-accent"
                            >
                              {sub.name.length > 25 ? `${sub.name.slice(0, 22)}...` : sub.name}
                            </Link>
                          ))}
                          {term.subjects.length > 4 && (
                            <span className="self-center text-[12px] text-muted">+{term.subjects.length - 4} more</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 text-right">
                  <Link
                    href={`/programs/${program.slug}`}
                    className="inline-flex items-center gap-0.5 text-[14px] font-medium text-brand hover:underline underline-offset-4"
                  >
                    View complete syllabus structure <CaretRight size={12} weight="bold" />
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
