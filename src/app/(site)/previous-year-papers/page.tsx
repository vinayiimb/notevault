import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel, getExamSessions } from "@/lib/data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";

export const metadata: Metadata = {
  title: "DU Previous Year Question Papers",
  description: "Download Delhi University previous year question papers by course, subject, semester and year. Access DU PYQs online for free with no login required.",
  alternates: { canonical: "/previous-year-papers" },
};

export default async function PreviousYearPapersPage() {
  const [programs, sessions] = await Promise.all([
    getProgramsByLevel("COLLEGE"),
    getExamSessions(),
  ]);

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          DU Previous Year Question Papers
        </h1>
        <p className="mt-3 text-base text-muted">
          Find and download Delhi University previous year question papers by course, subject, semester, and year. 
          Get instant access to study materials, solution keys, and past papers with no registration required.
        </p>
      </div>

      {/* Grid of Courses */}
      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <GraduationCap size={22} className="text-accent" />
          Browse by Course
        </h2>
        <p className="text-sm text-muted mt-1">Select your Delhi University programme to view semesters and subjects.</p>
        
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => (
            <div
              key={program.id}
              className="flex flex-col rounded-2xl border border-border bg-surface p-5 transition hover:border-accent hover:shadow-xs"
            >
              <h3 className="font-semibold text-foreground">{program.name}</h3>
              {program.summary && <p className="mt-1.5 text-xs text-muted leading-relaxed">{program.summary}</p>}
              
              <div className="mt-4 flex flex-wrap gap-1.5">
                {program.terms.map((term) => (
                  <Link
                    key={term.id}
                    href={`/terms/${term.id}`}
                    className="rounded-lg bg-surface-muted px-2.5 py-1 text-xs text-muted hover:bg-brand-soft hover:text-brand transition"
                  >
                    {term.name}
                  </Link>
                ))}
              </div>

              <Link
                href={`/programs/${program.slug}`}
                className="mt-4 text-xs font-bold text-brand hover:underline"
              >
                View all semesters →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Browse by Exam Session */}
      <section className="mt-16 border-t border-border/60 pt-12">
        <h2 className="flex items-center gap-2 text-xl font-bold text-foreground">
          <Calendar size={22} className="text-accent" />
          Browse by Exam Session
        </h2>
        <p className="text-sm text-muted mt-1">Find semester booklets and exam papers directly inside Google Drive folders.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.slice(0, 6).map((session) => (
            <Link
              key={session.id}
              href={`/exam-sessions/${session.id}`}
              className="flex items-center justify-between rounded-xl border border-border bg-surface p-4 transition hover:border-accent"
            >
              <div className="min-w-0">
                <span className="text-sm font-medium text-foreground truncate block">{session.label}</span>
                <span className="text-xs text-muted mt-0.5 block">{session._count.links} courses linked</span>
              </div>
              <span className="text-xs font-bold text-brand hover:underline">Open →</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
