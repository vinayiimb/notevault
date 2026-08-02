"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { GraduationCap, MagnifyingGlass, Sparkle } from "@phosphor-icons/react";

const ECONOMICS_NOTES_URL =
  "https://drive.google.com/drive/folders/1GJ67aNwwfq3Mf_xBXm3POXkxduW5CDPi?usp=sharing";

const POPULAR_DU_COURSES = [
  { name: "B.Com. (Hons)", slug: "b-com-hons" },
  { name: "B.Com. (Programme)", slug: "b-com-prog" },
  { name: "B.A. (H) Economics", slug: "ba-eco-hons" },
  { name: "B.A. (H) History", slug: "ba-hist-hons" },
  { name: "B.A. (H) Political Science", slug: "ba-pol-hons" },
  { name: "B.Sc. (H) Zoology", slug: "bsc-zool-hons" },
  { name: "B.Sc. (H) Botany", slug: "bsc-bot-hons" },
  { name: "B.Sc. (H) Chemistry / Physics", slug: "bsc-chem-hons" },
];

export function StudyAccessShowcase() {
  const [selectedCourse, setSelectedCourse] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  function handleMobileSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
    } else if (selectedCourse) {
      router.push(`/pyq-notes`);
    } else {
      router.push("/pyq-notes");
    }
  }

  return (
    <section aria-label="Study notes and archive" className="study-access-showcase">
      {/* Mobile-Only High-Impact Course & Subject Selector Box (Replaces 3 Cards on Mobile) */}
      <div className="block sm:hidden px-4 pt-4 pb-2">
        <form
          onSubmit={handleMobileSubmit}
          className="rounded-3xl border border-brand/30 bg-surface/95 p-5 shadow-[0_12px_32px_rgba(0,0,0,0.12)] backdrop-blur-md space-y-4"
        >
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-xl bg-brand text-brand-foreground font-bold shadow-sm">
              <GraduationCap size={18} weight="bold" />
            </span>
            <div>
              <h2 className="text-base font-bold font-display text-foreground">Find Your DU Course & Papers</h2>
              <p className="text-[11px] text-muted leading-tight">Select your degree or type your subject title</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {/* Course Select Dropdown */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">1. Select Course</label>
              <select
                value={selectedCourse}
                onChange={(e) => setSelectedCourse(e.target.value)}
                className="w-full rounded-2xl border border-border bg-background px-3.5 py-2.5 text-xs font-semibold text-foreground outline-none transition focus:border-brand shadow-inner"
              >
                <option value="">-- Choose DU Course --</option>
                {POPULAR_DU_COURSES.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subject Search Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted">2. Or Search Subject / Paper</label>
              <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3.5 py-2.5 shadow-inner">
                <MagnifyingGlass size={16} className="text-muted shrink-0" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type subject e.g. Microeconomics..."
                  className="w-full bg-transparent text-xs font-medium text-foreground outline-none placeholder:text-muted"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-xs font-bold text-brand-foreground shadow-md transition hover:bg-brand-hover active:scale-98"
          >
            <Sparkle size={16} weight="fill" />
            <span>Explore Course Papers & Notes →</span>
          </button>
        </form>
      </div>

      {/* Desktop-Only 3 Cards Layout */}
      <div className="hidden sm:block study-access-sky">
        <div className="study-access-cards">
          <article className="study-access-card study-access-card--glass">
            <h2 className="study-access-card__title">
              <span aria-hidden="true">📖</span> Full Archive
            </h2>
            <div className="study-access-card__divider" />
            <p className="study-access-card__copy">
              Browse the complete notes archive by subject, chapter or topic.
            </p>
            <Link href="/pyq-notes" className="study-access-card__small-button">
              Explore Archive →
            </Link>
          </article>

          <article className="study-access-card study-access-card--glass">
            <h2 className="study-access-card__title">
              <span aria-hidden="true">🎀</span> Free Subject Notes
            </h2>
            <div className="study-access-card__divider" />
            <p className="study-access-card__copy">
              Get the complete BA Economics (Hons) notes collection, absolutely free.
            </p>
            <a
              href={ECONOMICS_NOTES_URL}
              target="_blank"
              rel="noreferrer"
              className="study-access-card__small-button"
            >
              View Free Notes →
            </a>
          </article>

          <article className="study-access-card study-access-card--featured">
            <h2 className="study-access-card__featured-title">Paid Notes</h2>
            <p className="study-access-card__featured-copy">
              Complete notes for every subject, organised and ready to study.
            </p>
            <div className="study-access-card__actions">
              <Link href="/pyq-notes" className="study-access-card__outline-button">
                Preview Notes
              </Link>
              <Link href="/paid-notes" className="study-access-card__primary-button">
                Get Full Access
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
