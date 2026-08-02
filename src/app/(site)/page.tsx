import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  CompassRose,
  Exam,
  GraduationCap,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { getProgramsByLevel, getSiteSettings } from "@/lib/data";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";
import { StudyAccessShowcase } from "@/components/study-access-showcase";

export const metadata: Metadata = {
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
          // Full-bleed college illustration without fixed height constraints or cropping on mobile
          // eslint-disable-next-line @next/next/no-img-element
          <div className="relative w-full overflow-hidden">
            <img
              src={heroImage}
              alt="University of Delhi Colleges & Archive"
              className="hero-image-fade block h-[620px] w-full object-cover object-top sm:h-auto sm:max-h-none sm:object-contain"
            />
            <div aria-hidden="true" className="hero-image-overlay absolute inset-0" />
          </div>
        ) : (
          <div className="relative min-h-[620px] sm:min-h-[720px] bg-[#34beff]">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-[radial-gradient(circle_at_20%_25%,rgba(255,255,255,.35),transparent_40%),radial-gradient(circle_at_80%_15%,rgba(255,255,255,.25),transparent_35%)]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/10" />
          </div>
        )}

        {/* Afterboards-style typography floating in the bright blue sky above the campuses */}
        <div className="absolute inset-x-0 top-0 z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-22 pb-8 text-center sm:px-6 sm:pt-36 sm:pb-12 lg:pt-40 pointer-events-none">
          <div className="pointer-events-auto flex flex-col items-center w-full max-w-3xl">
            {siteSettings.heroEyebrow && (
              <div className="mb-3 sm:mb-4 hidden sm:inline-flex items-center gap-2 rounded-full border border-white/25 bg-black/20 px-4 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-2xs backdrop-blur-md">
                <Sparkle size={14} weight="fill" className="animate-pulse text-[#38bdf8]" />
                <span>{siteSettings.heroEyebrow}</span>
              </div>
            )}

            <h1 className="w-full text-balance font-display text-[2.35rem] leading-[1.06] font-black tracking-tight text-white whitespace-pre-line drop-shadow-[0_3px_14px_rgba(0,0,0,0.3)] sm:text-6xl sm:leading-[1.04] lg:text-[4.5rem]">
              {siteSettings.heroHeadline}
            </h1>

            {siteSettings.heroSubtitle && (
              <div className="mt-4 sm:mt-6 hidden sm:inline-flex items-center justify-center rounded-full bg-[#2196c9]/75 hover:bg-[#2196c9]/85 backdrop-blur-md px-6 py-2.5 text-sm sm:text-base lg:text-lg font-bold text-white shadow-lg border border-white/20 transition-all">
                <span>{siteSettings.heroSubtitle}</span>
              </div>
            )}

            <div className="mt-7 sm:mt-8 w-full max-w-xl hidden sm:block">
              <Suspense fallback={<div className="h-14 w-full rounded-2xl bg-white/20 backdrop-blur-md animate-pulse" />}>
                <SearchBar />
              </Suspense>
            </div>

            {siteSettings.heroSearchCaption && (
              <div className="mt-3.5 hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/20 px-4 py-1.5 text-xs font-semibold text-white/95 backdrop-blur-md shadow-2xs">
                <span>💡 {siteSettings.heroSearchCaption}</span>
              </div>
            )}
          </div>
        </div>

        {/* Showcase floating over the base of the globe illustration via -106px top margin */}
        {heroImage && <StudyAccessShowcase />}
      </section>

      <div className="relative z-10 mx-auto mt-8 max-w-6xl px-4 sm:mt-12 sm:px-6">
        {/* Tier 1: Express Course & Semester Jump */}
        <section className="relative overflow-hidden rounded-3xl border border-border/70 bg-surface p-6 shadow-[0_12px_40px_rgba(0,0,0,0.06)] backdrop-blur-sm transition-all duration-300 hover:border-brand/30 hover:shadow-[0_16px_50px_rgba(83,88,227,0.08)] sm:p-8 lg:p-10">
          {/* Subtle decoration orbs inside card */}
          <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-brand/5 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-24 size-80 rounded-full bg-sky/5 blur-3xl" />

          <div className="relative z-10">
            <div className="mb-6 flex flex-col justify-between gap-4 border-b border-border/60 pb-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand shadow-inner">
                  <GraduationCap size={28} weight="bold" />
                </span>
                <div>
                  <h2 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                    Take me to my semester
                  </h2>
                  <p className="mt-1 text-sm text-muted sm:text-base">
                    Pick your course once and jump directly to the papers that matter.
                  </p>
                </div>
              </div>
              <span className="hidden shrink-0 rounded-full border border-brand/20 bg-brand-soft/60 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand sm:inline-block">
                Express Portal
              </span>
            </div>

            {jumpData.length > 0 ? (
              <CourseSemesterJump programs={jumpData} embedded />
            ) : (
              <p className="py-4 text-sm text-muted">Courses are being added. Browse the archive in the meantime.</p>
            )}
          </div>
        </section>

        {/* Tier 2: 4 Quick Study Portals */}
        <section aria-label="Study shortcuts" className="mt-8 sm:mt-10">
          <div className="mb-4 flex items-center justify-between px-1">
            <h3 className="font-display text-xs font-bold uppercase tracking-wider text-muted">
              Quick Study & Revision Hub
            </h3>
            <span className="text-xs text-muted">Choose your study mode</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 sm:gap-5">
            <ShortcutCard
              icon={<CompassRose size={24} weight="bold" />}
              title="I need a PYQ"
              detail="Browse by course and semester"
              href="/browse/college"
              badge="Popular"
            />
            <ShortcutCard
              icon={<BookOpen size={24} weight="bold" />}
              title="I want the full paper"
              detail="Read OCR text without downloading"
              href="/pyq-notes"
              badge="Fast OCR"
            />
            <ShortcutCard
              icon={<Sparkle size={24} weight="bold" />}
              title="Test me before the exam"
              detail="Build a quiz, flashcards, or a map"
              href="/tools/exam-kit"
              badge="AI Tools"
            />
            <ShortcutCard
              icon={<Exam size={24} weight="bold" />}
              title="I need this session's paper"
              detail="Every year, every course, straight from Drive"
              href="/exam-sessions"
              badge="Google Drive"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ShortcutCard({
  icon,
  title,
  detail,
  href,
  badge,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/70 bg-surface p-6 shadow-2xs transition-all duration-300 hover:-translate-y-1 hover:border-brand/60 hover:shadow-lg hover:shadow-brand/10"
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-brand-soft text-brand transition-all duration-300 group-hover:scale-105 group-hover:bg-brand group-hover:text-brand-foreground group-hover:shadow-md">
            {icon}
          </span>
          {badge && (
            <span className="rounded-full border border-border/60 bg-surface-muted px-2.5 py-1 text-[11px] font-bold text-muted transition-colors group-hover:border-brand/30 group-hover:bg-brand-soft/50 group-hover:text-brand">
              {badge}
            </span>
          )}
        </div>
        <h4 className="mt-6 text-lg font-bold tracking-tight text-foreground transition-colors group-hover:text-brand">
          {title}
        </h4>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {detail}
        </p>
      </div>
      <div className="mt-6 flex items-center justify-end border-t border-border/50 pt-4">
        <span className="inline-flex items-center gap-1 text-xs font-bold text-brand group-hover:underline">
          Explore portal
          <ArrowRight size={14} weight="bold" className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}
