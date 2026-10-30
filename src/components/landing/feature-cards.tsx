"use client";

import Link from "next/link";
import { BookOpenText, CaretRight, NotePencil, Sparkle } from "@phosphor-icons/react";

const tile =
  "group flex h-full flex-col rounded-[28px] bg-surface p-7 shadow-[var(--shadow-tile)] transition-[transform,box-shadow] duration-500 ease-[var(--ease-apple)] motion-safe:hover:-translate-y-1 hover:shadow-[var(--shadow-tile-hover)] sm:p-8";
const textLink = "inline-flex items-center gap-0.5 text-[15px] font-medium text-brand hover:underline underline-offset-4";

function Icon({ children, tint }: { children: React.ReactNode; tint: string }) {
  return <span className={`flex size-11 items-center justify-center rounded-[14px] ${tint}`}>{children}</span>;
}

export function FeatureCards() {
  return (
    <div className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6">
      <div className="-mt-8 mb-12 grid grid-cols-1 gap-4 sm:-mt-16 sm:gap-5 md:grid-cols-3">
        <div className={tile}>
          <Icon tint="bg-[#e8f2fd] text-[#0071e3] dark:bg-[#0e2a4a] dark:text-[#0a84ff]">
            <BookOpenText size={24} weight="fill" />
          </Icon>
          <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em] text-foreground">All PYQs</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            16,000+ Delhi University question papers across 118 programmes, open right in your browser.
          </p>
          <Link href="/papers" className={`${textLink} mt-auto pt-6`}>
            Open all PYQs <CaretRight size={14} weight="bold" />
          </Link>
        </div>

        <div className={tile}>
          <Icon tint="bg-[#e9f9e4] text-[#3aa82c] dark:bg-[#15301a] dark:text-[#5dd34b]">
            <NotePencil size={24} weight="fill" />
          </Icon>
          <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em] text-foreground">Free subject notes</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Ask for high-yield notes for your subject. We write the most-requested ones first.
          </p>
          <Link href="/notes" className={`${textLink} mt-auto pt-6`}>
            Request free notes <CaretRight size={14} weight="bold" />
          </Link>
        </div>

        <div className={tile}>
          <Icon tint="bg-[#fff2e0] text-[#e07b00] dark:bg-[#3a2610] dark:text-[#ff9f0a]">
            <Sparkle size={24} weight="fill" />
          </Icon>
          <h3 className="mt-5 text-[21px] font-semibold tracking-[-0.02em] text-foreground">Paid notes</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Complete notes for every subject, organised unit by unit and ready to study.
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-6">
            <Link
              href="/paid-notes"
              className="inline-flex min-h-10 items-center rounded-full bg-brand px-5 text-[15px] font-medium text-brand-foreground hover:bg-brand-hover"
            >
              Get full access
            </Link>
            <Link href="/notes/preview" className={textLink}>
              Preview <CaretRight size={14} weight="bold" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
