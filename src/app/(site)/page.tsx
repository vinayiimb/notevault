import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { getProgramsByLevel, getSiteSettings } from "@/lib/data";
import { getAllDuPypProgrammes } from "@/lib/du-pyp-data";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";
import { FeatureCards } from "@/components/landing/feature-cards";

export const metadata: Metadata = {
  title: "DU Previous Year Papers & Notes | DU PYQ Online",
  description: "Find Delhi University previous year question papers by course, semester, subject, paper type and year. Read or download DU PYQs free.",
  alternates: { canonical: "/" },
};

// updateSiteSettingsAction already calls revalidatePath("/") on save, which
// should purge this immediately — this is a safety net in case that signal
// is ever missed or delayed, so an edited headline/subtitle self-corrects
// within a minute instead of looking permanently stuck on old cached text.
export const revalidate = 60;

export default async function HomePage() {
  const [programs, siteSettings] = await Promise.all([
    getProgramsByLevel("COLLEGE"),
    getSiteSettings(),
  ]);
  const duProgrammes = await getAllDuPypProgrammes();
  const heroImage = siteSettings.heroImageUrl;
  const jumpData = programs.map((program) => ({
    id: program.id,
    name: program.name,
    slug: program.slug,
    terms: program.terms.map((term) => ({ id: term.id, name: term.name })),
  }));

  return (
    <div className="pb-16">
      <section className={`relative -mt-[92px] ${heroImage ? "" : "bg-[#34beff]"}`}>
        {heroImage ? (
          <div className="relative w-full overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={heroImage}
              alt="DU PYQ Online – Delhi University Colleges & Archive"
              className="hero-image-fade block h-[620px] w-full object-cover object-top sm:h-auto sm:max-h-none sm:object-contain"
            />
            <div aria-hidden="true" className="hero-image-overlay absolute inset-0" />
          </div>
        ) : (
          <div className="relative min-h-[500px] sm:min-h-[600px] bg-gradient-to-b from-[#cae7ff] via-[#e2f1ff] to-white overflow-hidden">
            {/* Fluffy clouds SVG or CSS shapes */}
            <div className="absolute inset-0 opacity-60">
              <div className="absolute top-[10%] left-[10%] w-32 h-16 bg-white rounded-full blur-xl mix-blend-overlay"></div>
              <div className="absolute top-[20%] right-[15%] w-48 h-24 bg-white rounded-full blur-2xl mix-blend-overlay"></div>
              <div className="absolute top-[5%] left-[60%] w-40 h-20 bg-white rounded-full blur-xl mix-blend-overlay"></div>
            </div>
          </div>
        )}

        {/* Afterboards-style typography floating in the bright blue sky above the campuses */}
        <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-22 pb-8 text-center sm:px-6 sm:pt-36 sm:pb-12 lg:pt-40 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center w-full max-w-3xl">
            <h1 className="w-full text-balance font-display text-[2.35rem] leading-[1.06] font-black tracking-tight text-white whitespace-pre-line drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)] sm:text-5xl sm:leading-[1.04] lg:text-[4rem]">
              Delhi University Previous Year Question Papers &amp; Notes
            </h1>

            {siteSettings.heroSubtitle && (
              <div className="mt-4 sm:mt-6 hidden sm:inline-flex items-center justify-center rounded-full bg-[#0284c7]/35 hover:bg-[#0284c7]/45 backdrop-blur-md px-6 py-2.5 text-sm sm:text-base lg:text-lg font-bold text-white shadow-[0_8px_30px_rgba(2,132,199,0.25)] border border-white/35 transition-all duration-200">
                <span>{siteSettings.heroSubtitle}</span>
              </div>
            )}

            <div className="mt-7 sm:mt-8 w-full max-w-xl hidden sm:block">
              <Suspense fallback={<div className="h-14 w-full rounded-2xl bg-white/20 backdrop-blur-md animate-pulse" />}>
                <SearchBar />
              </Suspense>
            </div>

            {siteSettings.heroSearchCaption && (
              <div className="mt-3.5 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/20 hover:bg-white/25 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md shadow-sm transition-all duration-200">
                <span>💡 {siteSettings.heroSearchCaption}</span>
              </div>
            )}
          </div>
        </div>

        {/* Feature Cards below hero */}
        <FeatureCards />
      </section>

      <div className="relative z-10 mx-auto mt-4 max-w-5xl px-4 sm:mt-8 sm:px-6">
        {/* Tier 1: Express Course & Degree Jump */}
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-surface p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-300 hover:border-brand/30 hover:shadow-[0_16px_50px_rgba(83,88,227,0.08)] sm:p-8 lg:p-10">
          {/* Subtle decoration orbs inside card */}
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/5 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-sky/5 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-blue-100 text-blue-600 shadow-inner">
                  <GraduationCap size={28} weight="bold" />
                </span>
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Take me to my course papers
                  </h2>
                  <p className="mt-1 text-sm text-muted sm:text-base">
                    Pick your degree once and jump directly into the interactive PDF archive.
                  </p>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full bg-[#edf0ff] px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-600 sm:inline-block">
                Express Portal
              </span>
            </div>

            <CourseSemesterJump
              programs={jumpData}
              allProgrammes={duProgrammes}
              embedded
            />
          </div>
        </section>

        {/* About / Informational Description section */}
        <section className="mt-16 border-t border-border/60 pt-12 text-sm text-muted leading-relaxed max-w-4xl mx-auto">
          <h3 className="font-display text-lg font-bold text-foreground mb-4">
            About DU PYQ Online Portal
          </h3>
          <p className="mb-4">
            DU PYQ Online is a dedicated student resource platform built to support the Delhi University academic community. Our mission is to simplify exam preparation by providing unified, free access to essential study materials. We serve undergraduate students across various college campuses, offering a complete repository of study resources designed to improve learning outcomes and make preparation stress-free.
          </p>
          <p className="mb-4">
            On our platform, you can explore a wide variety of resources including <Link href="/previous-year-papers" className="text-brand hover:underline">Delhi University previous year question papers</Link>, detailed study <Link href="/notes" className="text-brand hover:underline">notes</Link>, and official degree <Link href="/syllabus" className="text-brand hover:underline">syllabus structures</Link>. We host papers for many popular courses like B.Com (Hons), B.A. (H) Economics, B.Sc. (H) Physics, and more. To ensure accessibility, every resource is completely open and free to read or download with no login, sign-up, or registration required.
          </p>
          <p className="mb-4">
            We offer flexible options for finding study materials. You can easily <Link href="/browse/college" className="text-brand hover:underline">browse courses</Link> to view a structured subject roadmap or <Link href="/semesters" className="text-brand hover:underline">browse by semester</Link> to jump directly to files relevant to your current academic term (Semester 1 through Semester 6). Our advanced study files are integrated with high-accuracy OCR text extraction, allowing students to read and search question papers directly online without downloading PDFs.
          </p>
          <p>
            Whether you need to review the syllabus rules, test your knowledge using our revision kits, or download past papers from our <Link href="/pyq-notes" className="text-brand hover:underline">full archive</Link>, DU PYQ Online ensures you have stable, crawlable, and fast access to everything you need. All our study collections, solution keys, and past papers are updated regularly to match the latest UGCF regulations.
          </p>
        </section>
      </div>
    </div>
  );
}
