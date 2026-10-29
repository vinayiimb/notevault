import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CaretRight, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { getProgramsByLevel, getSiteSettings } from "@/lib/data";
import { getAllDuPypProgrammes } from "@/lib/du-pyp-data";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";
import { FeatureCards } from "@/components/landing/feature-cards";
import { FeatureShowcase } from "@/components/landing/feature-showcase";
import { Mascot } from "@/components/landing/mascot";

export const metadata: Metadata = {
  title: "DU Previous Year Papers & Notes",
  description: "Find Delhi University previous year question papers by course, semester, subject, paper type and year. Read or download DU PYQs free.",
  alternates: { canonical: "/" },
};

// updateSiteSettingsAction already calls revalidatePath("/") on save, which
// should purge this immediately — this is a safety net in case that signal
// is ever missed or delayed, so an edited headline/subtitle self-corrects
// within the hour instead of looking permanently stuck on old cached text.
export const revalidate = 3600;

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
            <h1 className="w-full text-balance font-display text-[2.35rem] leading-[1.05] font-semibold tracking-[-0.035em] text-white whitespace-pre-line drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)] sm:text-5xl sm:leading-[1.04] lg:text-[4rem]">
              Delhi University Previous Year Question Papers &amp; Notes
            </h1>

            {siteSettings.heroSubtitle && (
              <div className="mt-4 sm:mt-6 hidden sm:inline-flex items-center justify-center rounded-full bg-white/20 backdrop-blur-xl backdrop-saturate-150 px-6 py-2.5 text-sm sm:text-base lg:text-[17px] font-medium tracking-[-0.01em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_8px_30px_rgba(2,80,140,0.18)] border border-white/40">
                <span>{siteSettings.heroSubtitle}</span>
              </div>
            )}

            <div className="mt-7 sm:mt-8 w-full max-w-xl hidden sm:block">
              <Suspense fallback={<div className="h-14 w-full rounded-2xl bg-white/20 backdrop-blur-md animate-pulse" />}>
                <SearchBar />
              </Suspense>
            </div>

            {siteSettings.heroSearchCaption && (
              <div className="mt-3.5 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/35 bg-white/15 px-4 py-1.5 text-xs font-medium text-white backdrop-blur-xl">
                <span>💡 {siteSettings.heroSearchCaption}</span>
              </div>
            )}
          </div>
        </div>

        {/* Feature Cards below hero */}
        <FeatureCards />
      </section>

      <div className="relative z-10 mx-auto mt-24 max-w-5xl px-4 sm:mt-40 sm:px-6">
        {/* Tier 1: Express Course & Degree Jump — the parrot peeks over the top edge */}
        <div className="relative">
          <Mascot
            className="absolute -top-[92px] right-5 w-[112px] sm:-top-[140px] sm:right-12 sm:w-[180px]"
            bubbleClassName="right-[96%] top-10 hidden w-max max-w-[250px] sm:block"
            tips={[
              "Pick your course and I'll fetch every paper.",
              "Psst… questions repeat. Check the most repeated ones below.",
              "Papers open right here. No login, no downloads.",
              "Tap me for a tip!",
            ]}
          />
        <section className="relative overflow-hidden rounded-[32px] bg-surface-muted p-6 sm:p-10 lg:p-12">
          <div className="relative z-10">
            <div className="mb-8 flex items-center gap-4">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-[14px] bg-surface text-brand shadow-[var(--shadow-tile)]">
                <GraduationCap size={26} weight="fill" />
              </span>
              <div className="min-w-0">
                <h2 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[34px]">
                  Take me to my course papers
                </h2>
                <p className="mt-1 text-[15px] text-muted sm:text-[17px]">
                  Pick your degree once and jump straight into its papers.
                </p>
              </div>
            </div>

            <CourseSemesterJump
              programs={jumpData}
              allProgrammes={duProgrammes}
              embedded
            />
          </div>
        </section>
        </div>

        {/* Practice / Learn / Revise — animated feature mock-ups */}
        <FeatureShowcase />

        {/* Repeated-question analyses — internal links to our most useful, original pages */}
        <section className="mx-auto mt-28 max-w-5xl sm:mt-36">
          <h2 className="font-display text-[28px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[40px]">Most repeated questions, by subject.</h2>
          <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted">
            We put every available paper for a subject side by side and counted which topics came back.
          </p>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <li>
              <Link href="/blog/du-bcom-hons-financial-accounting-most-repeated-questions" className="group flex h-full flex-col rounded-[22px] bg-surface-muted p-5 text-foreground transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]">
                <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">B.Com (Hons) Financial Accounting</span>
                <span className="mt-1.5 block text-[13px] leading-snug text-muted">Numericals that repeat with new numbers</span>
                <span className="mt-auto inline-flex items-center gap-0.5 pt-4 text-[13px] font-medium text-brand group-hover:underline underline-offset-4">Read the analysis <CaretRight size={12} weight="bold" /></span>
              </Link>
            </li>
            <li>
              <Link href="/blog/du-bcom-hons-business-laws-most-repeated-questions" className="group flex h-full flex-col rounded-[22px] bg-surface-muted p-5 text-foreground transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]">
                <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">B.Com (Hons) Business Laws</span>
                <span className="mt-1.5 block text-[13px] leading-snug text-muted">Topics that came in all 3 NEP papers</span>
                <span className="mt-auto inline-flex items-center gap-0.5 pt-4 text-[13px] font-medium text-brand group-hover:underline underline-offset-4">Read the analysis <CaretRight size={12} weight="bold" /></span>
              </Link>
            </li>
            <li>
              <Link href="/blog/du-environmental-science-aec-most-repeated-questions" className="group flex h-full flex-col rounded-[22px] bg-surface-muted p-5 text-foreground transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]">
                <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">Environmental Science (AEC)</span>
                <span className="mt-1.5 block text-[13px] leading-snug text-muted">17 papers, abbreviations and true/false with answers</span>
                <span className="mt-auto inline-flex items-center gap-0.5 pt-4 text-[13px] font-medium text-brand group-hover:underline underline-offset-4">Read the analysis <CaretRight size={12} weight="bold" /></span>
              </Link>
            </li>
            <li>
              <Link href="/blog/du-business-communication-sec-most-repeated-questions" className="group flex h-full flex-col rounded-[22px] bg-surface-muted p-5 text-foreground transition-colors duration-300 hover:bg-[color-mix(in_srgb,var(--surface-muted)_88%,var(--foreground))]">
                <span className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">Business Communication (SEC)</span>
                <span className="mt-1.5 block text-[13px] leading-snug text-muted">What changed in the 2026 papers</span>
                <span className="mt-auto inline-flex items-center gap-0.5 pt-4 text-[13px] font-medium text-brand group-hover:underline underline-offset-4">Read the analysis <CaretRight size={12} weight="bold" /></span>
              </Link>
            </li>
          </ul>
        </section>

        {/* About / Informational Description section */}
        <section className="mx-auto mt-28 max-w-3xl border-t border-border pt-12 text-[15px] leading-relaxed text-muted sm:mt-36">
          <h3 className="mb-4 font-display text-xl font-semibold tracking-[-0.02em] text-foreground">
            About DU PYQ Online Portal
          </h3>
          <p className="mb-4">
            DU PYQ Online is a dedicated student resource platform built to support the Delhi University academic community. Our mission is to simplify exam preparation by providing unified, free access to essential study materials. We serve undergraduate students across various college campuses, offering a complete repository of study resources designed to improve learning outcomes and make preparation stress-free.
          </p>
          <p className="mb-4">
            On our platform, you can explore a wide variety of resources including <Link href="/previous-year-papers" className="text-brand hover:underline">Delhi University previous year question papers</Link>, detailed study <Link href="/notes" className="text-brand hover:underline">notes</Link>, and official degree <Link href="/syllabus" className="text-brand hover:underline">syllabus structures</Link>. We host papers for many popular courses like B.Com (Hons), B.A. (H) Economics, B.Sc. (H) Physics, and more. Every question paper is free to read or download with no login, sign-up, or registration required. Study notes are free to preview, with the full notes available as a paid upgrade.
          </p>
          <p className="mb-4">
            We offer flexible options for finding study materials. You can easily <Link href="/browse/college" className="text-brand hover:underline">browse courses</Link> to view a structured subject roadmap or <Link href="/semesters" className="text-brand hover:underline">browse by semester</Link> to jump directly to files relevant to your current academic term (Semester 1 through Semester 6). Our advanced study files are integrated with high-accuracy OCR text extraction, allowing students to read and search question papers directly online without downloading PDFs.
          </p>
          <p>
            Whether you need to review the syllabus rules, test your knowledge using our revision kits, or download past papers from our <Link href="/papers" className="text-brand hover:underline">full archive</Link>, DU PYQ Online ensures you have stable, crawlable, and fast access to everything you need. All our study collections, solution keys, and past papers are updated regularly to match the latest UGCF regulations.
          </p>
        </section>
      </div>
    </div>
  );
}
