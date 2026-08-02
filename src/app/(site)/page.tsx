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
    <div>
      <section className={`relative -mt-[92px] ${heroImage ? "" : "bg-brand"}`}>
        {heroImage ? (
          // The image is uploaded by an admin at an arbitrary aspect ratio and
          // is designed to be shown in full — never cropped, never squeezed
          // into a fixed box. It renders at its natural width-derived height
          // (like a normal inline image); hero-image-fade masks its bottom
          // edge to transparent and hero-image-overlay blends that fade into
          // the page background, so the banner dissolves into the copy below
          // instead of ending on a hard edge or needing a text scrim.
          // eslint-disable-next-line @next/next/no-img-element
          <div className="relative">
            <img src={heroImage} alt="" className="hero-image-fade block h-auto w-full" />
            <div aria-hidden="true" className="hero-image-overlay absolute inset-0" />
          </div>
        ) : (
          <div className="relative min-h-[460px] sm:min-h-[520px]">
            <div
              aria-hidden="true"
              className="absolute inset-0 min-h-[720px] bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,.24),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(255,255,255,.15),transparent_30%)]"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/30 to-black/10" />
          </div>
        )}

        {heroImage && <StudyAccessShowcase />}

        <div
          className={
            heroImage
              ? "relative mx-auto flex max-w-5xl flex-col items-center px-4 pt-8 pb-16 text-center sm:px-6 sm:pt-10"
              : "absolute inset-x-0 top-0 z-10 mx-auto flex max-w-5xl flex-col items-center px-4 pt-32 pb-16 text-center sm:px-6 sm:pt-36 lg:pt-40"
          }
        >
          <p
            className={`mb-5 text-xs font-semibold tracking-[0.2em] uppercase ${heroImage ? "text-muted" : "text-white/80"}`}
          >
            {siteSettings.heroEyebrow}
          </p>
          <h1
            className={`max-w-4xl text-balance font-display text-5xl leading-[0.93] font-extrabold tracking-[-0.04em] whitespace-pre-line sm:text-7xl lg:text-[5.25rem] ${heroImage ? "text-foreground" : "text-white"}`}
          >
            {siteSettings.heroHeadline}
          </h1>
          <p
            className={`mt-6 max-w-2xl text-pretty text-base font-medium leading-relaxed sm:text-lg ${heroImage ? "text-muted" : "text-white/90"}`}
          >
            {siteSettings.heroSubtitle}
          </p>
          <div className="mt-8 w-full max-w-2xl">
            <Suspense fallback={<div className="h-14 w-full" />}>
              <SearchBar />
            </Suspense>
          </div>
          <p className={`mt-4 text-sm ${heroImage ? "text-muted" : "text-white/70"}`}>
            {siteSettings.heroSearchCaption}
          </p>
        </div>
      </section>

      <div className="relative z-10 mx-auto mt-6 max-w-6xl px-4 sm:mt-8 sm:px-6 lg:mt-10">
        <section className="overflow-hidden rounded-2xl bg-surface shadow-[0_8px_24px_rgba(31,35,90,.12)] lg:grid lg:grid-cols-[1.35fr_.65fr]">
          <div className="flex flex-col justify-center p-6 sm:p-8 lg:p-10">
            <div className="flex items-start gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                <GraduationCap size={22} weight="bold" />
              </span>
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight">Take me to my semester</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted">
                  Pick your course once and jump directly to the papers that matter.
                </p>
              </div>
            </div>
            {jumpData.length > 0 ? (
              <div className="mt-6">
                <CourseSemesterJump programs={jumpData} embedded />
              </div>
            ) : (
              <p className="mt-6 text-sm text-muted">Courses are being added. Browse the archive in the meantime.</p>
            )}
          </div>

          <nav aria-label="Study shortcuts" className="border-t border-border lg:border-t-0 lg:border-l">
            <Shortcut
              icon={<CompassRose size={20} weight="bold" />}
              title="I need a PYQ"
              detail="Browse by course and semester"
              href="/browse/college"
            />
            <Shortcut
              icon={<BookOpen size={20} weight="bold" />}
              title="I want the full paper"
              detail="Read OCR text without downloading"
              href="/pyq-notes"
            />
            <Shortcut
              icon={<Sparkle size={20} weight="bold" />}
              title="Test me before the exam"
              detail="Build a quiz, flashcards, or a map"
              href="/tools/exam-kit"
            />
            <Shortcut
              icon={<Exam size={20} weight="bold" />}
              title="I need this session's paper"
              detail="Every year, every course, straight from Drive"
              href="/exam-sessions"
            />
          </nav>
        </section>
      </div>

    </div>
  );
}

function Shortcut({
  icon,
  title,
  detail,
  href,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group flex min-h-28 items-center gap-4 border-b border-border px-6 py-5 last:border-b-0 hover:bg-brand-soft sm:px-8"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-brand group-hover:bg-brand group-hover:text-brand-foreground">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-foreground">{title}</span>
        <span className="mt-1 block text-sm text-muted">{detail}</span>
      </span>
      <ArrowRight
        size={17}
        weight="bold"
        className="ml-auto shrink-0 text-muted transition-transform group-hover:translate-x-1 group-hover:text-brand"
      />
    </Link>
  );
}
