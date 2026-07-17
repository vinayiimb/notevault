import Link from "next/link";
import { Suspense } from "react";
import { BookOpen, Exam, GraduationCap, ImageSquare, Notebook } from "@phosphor-icons/react/dist/ssr";
import { SearchBar } from "@/components/search-bar";
import { getStats, getProgramsByLevel, getSiteSettings } from "@/lib/data";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";

export default async function HomePage() {
  const [stats, programs, siteSettings] = await Promise.all([
    getStats(),
    getProgramsByLevel("COLLEGE"),
    getSiteSettings(),
  ]);
  const heroImage = siteSettings.heroImageUrl;
  const jumpData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name })),
  }));

  return (
    <div>
      <section className="relative -mt-[92px] min-h-[640px] overflow-hidden bg-[linear-gradient(180deg,#54d1ff,#42c3f3_55%,#62d8ff)]">
        {heroImage && (
          // Plain <img>, not next/image: the admin can upload any image at
          // any aspect ratio. Used here as a full-bleed background behind
          // the headline, so it's cropped to fill (object-cover) — the
          // uncropped, full-image view still lives on the admin Settings
          // preview, where reviewing the actual file (not a composited
          // background) is what matters.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={heroImage}
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
        )}
        {heroImage && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/55" />
        )}

        <div className="relative z-10 mx-auto flex min-h-[640px] max-w-4xl flex-col items-center justify-center px-4 pt-[92px] text-center sm:px-6">
          <h1 className="font-display text-5xl leading-[0.95] font-extrabold tracking-[-0.02em] whitespace-pre-line text-white drop-shadow-sm sm:text-7xl">
            {siteSettings.heroHeadline}
          </h1>
          <p className="mx-auto mt-6 inline-flex items-center rounded-full bg-black/25 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md sm:text-base">
            {siteSettings.heroSubtitle}
          </p>
          <div className="mx-auto mt-8 w-full max-w-xl">
            <Suspense fallback={<div className="h-[46px] w-full" />}>
              <SearchBar />
            </Suspense>
          </div>

          {!heroImage && (
            <div className="mt-10 flex flex-col items-center gap-2 text-white/80">
              <ImageSquare size={32} weight="bold" />
              <p className="text-sm font-medium">
                Upload a hero illustration from{" "}
                <Link href="/admin/settings" className="underline">
                  Admin → Settings
                </Link>{" "}
                to show it here.
              </p>
            </div>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <section>
          <div className="flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-brand-soft text-brand">
              <GraduationCap size={22} weight="bold" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">PYQ</h2>
              <p className="text-sm text-muted">
                Previous year papers for B.A., B.Com, B.Sc and other programs.
              </p>
            </div>
          </div>

          {jumpData.length > 0 && (
            <div className="mt-5 max-w-2xl">
              <CourseSemesterJump programs={jumpData} />
            </div>
          )}

          <Link
            href="/browse/college"
            className="mt-4 inline-block text-sm font-medium text-brand hover:underline"
          >
            Or browse every course →
          </Link>
        </section>

        <section className="mt-14 grid grid-cols-2 gap-4 border-y border-border py-8 sm:grid-cols-4">
          <Stat icon={<GraduationCap size={18} weight="bold" />} label="Programs" value={stats.programs} />
          <Stat icon={<Notebook size={18} weight="bold" />} label="Subjects" value={stats.subjects} />
          <Stat icon={<BookOpen size={18} weight="bold" />} label="Notes & PYQs" value={stats.resources} />
          <Stat icon={<Exam size={18} weight="bold" />} label="Bank questions" value={stats.questions} />
        </section>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs tracking-wide uppercase">{label}</span>
      </span>
      <span className="font-mono text-2xl font-semibold text-foreground">{value}</span>
    </div>
  );
}
