import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowRight,
  BookOpen,
  CompassRose,
  Exam,
  GraduationCap,
  Notebook,
  Sparkle,
} from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { getProgramsByLevel, getResourceHighlights, getSiteSettings, getStats } from "@/lib/data";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";

export default async function HomePage() {
  const [stats, programs, siteSettings, highlights] = await Promise.all([
    getStats(),
    getProgramsByLevel("COLLEGE"),
    getSiteSettings(),
    getResourceHighlights(),
  ]);
  const heroImage = siteSettings.heroImageUrl;
  const latestResource = highlights.latestPyq ?? highlights.latestNote;
  const jumpData = programs.map((program) => ({
    id: program.id,
    name: program.name,
    slug: program.slug,
    terms: program.terms.map((term) => ({ id: term.id, name: term.name })),
  }));

  return (
    <div>
      <section
        className={`relative -mt-[92px] min-h-[560px] overflow-hidden sm:min-h-[640px] lg:min-h-[720px] ${heroImage ? "bg-[#2c82d6]" : "bg-brand"}`}
      >
        {!heroImage && (
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_18%_22%,rgba(255,255,255,.24),transparent_34%),radial-gradient(circle_at_82%_12%,rgba(255,255,255,.15),transparent_30%)]"
          />
        )}
        {heroImage && (
          // The image is uploaded by an admin at an arbitrary aspect ratio and
          // is designed to be shown in full (never cropped), sitting flush
          // against the section below it — object-contain + object-bottom
          // keeps the whole image on screen and anchors its own bottom edge
          // to the section's bottom edge, wherever that lands per viewport.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-contain object-bottom"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/15 to-black/70" />

        <div className="relative z-10 mx-auto flex min-h-[560px] max-w-5xl flex-col items-center justify-center px-4 pt-32 pb-16 text-center sm:min-h-[640px] sm:pt-36 sm:pb-24 lg:min-h-[720px] lg:pt-40 lg:pb-36 sm:px-6">
          <p className="mb-5 text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">
            Built for Delhi University students
          </p>
          <h1 className="max-w-4xl text-balance font-display text-5xl leading-[0.93] font-extrabold tracking-[-0.04em] whitespace-pre-line text-white sm:text-7xl lg:text-[5.25rem]">
            {siteSettings.heroHeadline}
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-base font-medium leading-relaxed text-white/90 sm:text-lg">
            {siteSettings.heroSubtitle}
          </p>
          <div className="mt-8 w-full max-w-2xl">
            <Suspense fallback={<div className="h-14 w-full" />}>
              <SearchBar />
            </Suspense>
          </div>
          <p className="mt-4 text-sm text-white/70">Search a subject, paper title, program, or topic.</p>
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
          </nav>
        </section>
      </div>

      <div className="mx-auto max-w-6xl px-4 pt-20 pb-24 sm:px-6 sm:pt-24">
        <section aria-labelledby="vault-pulse" className="overflow-hidden rounded-2xl bg-brand text-brand-foreground">
          <div className="grid gap-8 p-7 sm:p-9 lg:grid-cols-[1fr_auto] lg:items-end lg:p-12">
            <div>
              <p className="text-sm font-semibold text-brand-foreground/70">Just added to the vault</p>
              <h2 id="vault-pulse" className="mt-3 max-w-3xl text-balance font-display text-3xl font-bold tracking-[-0.03em] sm:text-4xl">
                {latestResource ? formatResourceHeading(latestResource) : "Your next paper is already waiting in the library."}
              </h2>
              <p className="mt-3 max-w-2xl text-pretty text-sm leading-relaxed text-brand-foreground/75 sm:text-base">
                Open the newest upload now, or search the full archive by subject and semester.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {latestResource && (
                <Link
                  href={`/subjects/${latestResource.subject.id}`}
                  className="group inline-flex min-h-11 items-center gap-2 rounded-xl bg-surface px-5 py-3 text-sm font-semibold text-foreground hover:-translate-y-0.5"
                >
                  Open newest paper
                  <ArrowRight size={16} weight="bold" className="transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
              <Link
                href="/browse/college"
                className="inline-flex min-h-11 items-center rounded-xl border border-brand-foreground/25 px-5 py-3 text-sm font-semibold text-brand-foreground hover:bg-brand-foreground/10"
              >
                Browse everything
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 border-t border-brand-foreground/15 sm:grid-cols-4">
            <Stat icon={<GraduationCap size={17} weight="bold" />} label="Programs" value={stats.programs} />
            <Stat icon={<Notebook size={17} weight="bold" />} label="Subjects" value={stats.subjects} />
            <Stat icon={<BookOpen size={17} weight="bold" />} label="Notes & PYQs" value={stats.resources} />
            <Stat icon={<Exam size={17} weight="bold" />} label="Bank questions" value={stats.questions} />
          </div>
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

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="border-r border-b border-brand-foreground/15 px-5 py-6 last:border-r-0 sm:border-b-0 sm:px-7">
      <span className="flex items-center gap-2 text-brand-foreground/65">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </span>
      <span className="mt-2 block font-mono text-2xl font-semibold tabular-nums">{value.toLocaleString()}</span>
    </div>
  );
}

function formatResourceHeading(resource: { title: string; subject: { name: string } }) {
  const title = resource.title.trim();
  const subject = resource.subject.name.trim();
  return title.toLocaleLowerCase().startsWith(subject.toLocaleLowerCase()) ? title : `${subject}: ${title}`;
}
