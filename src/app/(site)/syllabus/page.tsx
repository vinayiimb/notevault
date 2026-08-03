export const dynamic = "force-static";
import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, Scroll } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "Delhi University Syllabus | DU PYQ Online",
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
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Delhi University Course Syllabus
        </h1>
        <p className="mt-3 text-base text-muted">
          Browse the official Delhi University Undergraduate Curriculum Framework (UGCF) syllabus. 
          View course structures, credits, paper types (DSC, DSE, GE, SEC, VAC, AEC), and subject listings.
        </p>
      </div>

      {/* Overview Card */}
      <section className="mt-8 rounded-2xl border border-border bg-surface p-6">
        <h2 className="flex items-center gap-2 text-lg font-bold text-foreground">
          <Scroll size={20} className="text-accent" />
          Understanding DU UGCF Course Structure
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs text-muted">
          <div className="p-3 bg-surface-muted rounded-xl">
            <span className="font-bold text-foreground block mb-1">DSC (Core Course)</span>
            Discipline Specific Core courses are compulsory modules essential to the primary program.
          </div>
          <div className="p-3 bg-surface-muted rounded-xl">
            <span className="font-bold text-foreground block mb-1">DSE (Elective Course)</span>
            Discipline Specific Elective papers offer specialized topics in the core field.
          </div>
          <div className="p-3 bg-surface-muted rounded-xl">
            <span className="font-bold text-foreground block mb-1">GE (Generic Elective)</span>
            Generic Elective courses are interdisciplinary options chosen from other programs.
          </div>
        </div>
      </section>

      {/* Program Syllabus Grid */}
      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <BookOpen size={22} className="text-accent" />
          Syllabus by Degree Programme
        </h2>
        
        <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
          {programs.map((program) => {
            const subjectCount = program.terms.reduce((n, t) => n + t.subjects.length, 0);

            return (
              <div
                key={program.id}
                className="flex flex-col justify-between rounded-2xl border border-border bg-surface p-6 transition hover:border-accent"
              >
                <div>
                  <div className="flex items-start justify-between gap-4">
                    <h3 className="font-bold text-foreground text-base sm:text-lg leading-snug">
                      {program.name}
                    </h3>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-bold text-accent">
                      {subjectCount} subjects
                    </span>
                  </div>
                  {program.summary && <p className="mt-1.5 text-xs text-muted">{program.summary}</p>}

                  <div className="mt-4 space-y-3">
                    {program.terms.map((term) => (
                      <div key={term.id} className="text-xs">
                        <Link
                          href={`/terms/${term.id}`}
                          className="font-semibold text-foreground hover:text-brand hover:underline"
                        >
                          {term.name}
                        </Link>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {term.subjects.slice(0, 4).map((sub: { id: string; name: string }) => (
                            <Link
                              key={sub.id}
                              href={`/subjects/${sub.id}`}
                              className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted hover:bg-brand-soft hover:text-brand transition"
                            >
                              {sub.name.length > 25 ? `${sub.name.slice(0, 22)}...` : sub.name}
                            </Link>
                          ))}
                          {term.subjects.length > 4 && (
                            <span className="text-[10px] text-muted self-center">
                              +{term.subjects.length - 4} more
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-border/40 text-right">
                  <Link
                    href={`/programs/${program.slug}`}
                    className="text-xs font-bold text-brand hover:underline"
                  >
                    View complete syllabus structure →
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
