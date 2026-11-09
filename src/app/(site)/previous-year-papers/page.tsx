// ISR, not force-static — same fix as /browse/college, /notes, and
// /subjects/[id]: force-static bakes this page in once at build time and
// never re-fetches the database again.
export const revalidate = 300;
import type { Metadata } from "next";
import Link from "next/link";
import { CaretRight, Calendar, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel, getExamSessions } from "@/lib/data";
import { getSeoProgrammes, isProgrammeIndexable } from "@/lib/du-pyp-seo";
import { getCatalogPaperCount } from "@/lib/du-pyp-data";
import { BreadcrumbJsonLd } from "@/components/seo/breadcrumb-jsonld";
import { VisibleBreadcrumb } from "@/components/seo/visible-breadcrumb";
import { NotesPrompt } from "@/components/notes-leads/notes-prompt";
import { NotesPromoCard } from "@/components/notes-leads/notes-promo";

export const metadata: Metadata = {
  title: "DU Previous Year Question Papers",
  description: "Delhi University previous year question papers by programme, subject, paper code and year. Browse every DU course, view or download the original PDFs, no login required.",
  alternates: { canonical: "/previous-year-papers" },
};

export default async function PreviousYearPapersPage() {
  const [programs, sessions, seoProgrammes] = await Promise.all([
    getProgramsByLevel("COLLEGE").catch(() => []),
    getExamSessions().catch(() => []),
    getSeoProgrammes(),
  ]);

  const totalPapers = getCatalogPaperCount();
  const subjectCount = seoProgrammes.reduce((n, p) => n + p.subjects.length, 0);
  const indexableProgrammes = seoProgrammes
    .filter(isProgrammeIndexable)
    .sort((a, b) => a.name.localeCompare(b.name));

  const breadcrumbs = [
    { name: "Home", url: "/" },
    { name: "Previous Year Papers", url: "/previous-year-papers" },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <BreadcrumbJsonLd items={breadcrumbs} />
      <NotesPrompt source="pyq-page" courses={indexableProgrammes.map(({ slug, name }) => ({ slug, name }))} />
      <VisibleBreadcrumb items={breadcrumbs} />

      <div className="mt-2 max-w-3xl">
        <h1 className="text-balance font-display text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.035em] sm:text-5xl">
          DU Previous Year Question Papers
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted sm:text-[17px]">
          DU PYQ Online has {totalPapers.toLocaleString("en-IN")} Delhi University previous year
          question papers across {seoProgrammes.length} programmes and{" "}
          {subjectCount.toLocaleString("en-IN")} subjects, organised by programme, subject,
          paper code (UPC) and exam session. Every paper links to its original PDF — free, no login required.
        </p>
      </div>

      {/* UGCF paper-type hubs — cross-programme AEC / SEC / VAC / GE landing pages */}
      <NotesPromoCard className="mt-8" />

      <section className="mt-10 sm:mt-14">
        <h2 className="font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">Browse by paper type (UGCF)</h2>
        <ul className="mt-5 flex flex-wrap gap-2">
          {[
            ["/skill-enhancement-courses", "Skill Enhancement (SEC)"],
            ["/value-addition-courses", "Value Addition (VAC)"],
            ["/ability-enhancement-courses", "Ability Enhancement (AEC)"],
            ["/generic-electives", "Generic Electives (GE)"],
          ].map(([href, label]) => (
            <li key={href}>
              <Link
                href={href}
                className="inline-block rounded-full bg-surface-muted px-4 py-2.5 text-[14px] font-medium text-foreground transition-colors duration-300 hover:bg-accent-soft hover:text-accent"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* All DU programmes — crawlable index into the /papers/[programme] hierarchy */}
      <section className="mt-14 sm:mt-16">
        <h2 className="flex items-center gap-2.5 font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">
          <GraduationCap size={26} className="shrink-0 text-accent" />
          All Delhi University programmes
        </h2>
        <p className="mt-2 text-[15px] text-muted sm:text-[17px]">
          {indexableProgrammes.length} programmes with previous year question papers. Open one to
          browse its subjects by semester.
        </p>

        <ul className="mt-6 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {indexableProgrammes.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/papers/${p.slug}`}
                className="flex items-center justify-between gap-3 rounded-[18px] bg-surface-muted px-4 py-3.5 transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]"
              >
                <span className="min-w-0 break-words text-[15px] font-medium text-foreground">{p.name}</span>
                <span className="flex shrink-0 items-center gap-1 text-[13px] text-muted">
                  {p.totalPapers.toLocaleString("en-IN")}
                  <CaretRight size={12} weight="bold" className="text-brand" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Grid of Courses (database-backed programme pages, when populated) */}
      {programs.length > 0 && (
      <section className="mt-14 sm:mt-16">
        <h2 className="flex items-center gap-2.5 font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">
          <GraduationCap size={26} className="shrink-0 text-accent" />
          Browse by course
        </h2>
        <p className="mt-2 text-[15px] text-muted sm:text-[17px]">Select your Delhi University programme to view semesters and subjects.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {programs.map((program) => (
            <div key={program.id} className="flex flex-col rounded-[22px] bg-surface-muted p-5">
              <h3 className="text-[17px] font-semibold leading-snug tracking-[-0.01em] text-foreground">{program.name}</h3>
              {program.summary && <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{program.summary}</p>}

              <div className="mt-4 flex flex-wrap gap-1.5">
                {program.terms.map((term) => (
                  <Link
                    key={term.id}
                    href={`/terms/${term.id}`}
                    className="rounded-full bg-surface px-3 py-1 text-[12px] text-muted transition-colors duration-300 hover:bg-accent-soft hover:text-accent"
                  >
                    {term.name}
                  </Link>
                ))}
              </div>

              <Link
                href={`/programs/${program.slug}`}
                className="mt-5 inline-flex items-center gap-0.5 text-[14px] font-medium text-brand underline-offset-4 hover:underline"
              >
                View all semesters <CaretRight size={12} weight="bold" />
              </Link>
            </div>
          ))}
        </div>
      </section>
      )}

      {/* Browse by Exam Session */}
      {sessions.length > 0 && (
      <section className="mt-14 sm:mt-16">
        <h2 className="flex items-center gap-2.5 font-display text-[24px] font-semibold leading-[1.12] tracking-[-0.03em] text-foreground sm:text-[32px]">
          <Calendar size={26} className="shrink-0 text-accent" />
          Browse by exam session
        </h2>
        <p className="mt-2 text-[15px] text-muted sm:text-[17px]">Find semester booklets and exam papers directly inside Google Drive folders.</p>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.slice(0, 6).map((session) => (
            <Link
              key={session.id}
              href={`/exam-sessions/${session.id}`}
              className="flex items-center justify-between gap-3 rounded-[22px] bg-surface-muted p-5 transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]"
            >
              <div className="min-w-0">
                <span className="block break-words text-[15px] font-semibold text-foreground">{session.label}</span>
                <span className="mt-0.5 block text-[13px] text-muted">{session._count.links} courses linked</span>
              </div>
              <CaretRight size={14} weight="bold" className="shrink-0 text-brand" />
            </Link>
          ))}
        </div>
      </section>
      )}
    </div>
  );
}
