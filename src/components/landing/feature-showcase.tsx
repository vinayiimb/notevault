"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle, DownloadSimple, FilePdf, LockSimple } from "@phosphor-icons/react";
import { SINGLE_PRICE } from "@/lib/paid-notes-pricing";
import s from "./feature-showcase.module.css";

// Homepage "Practice / Learn / Revise" rows: copy on one side, a small
// animated mock of the real feature on the other — a cursor moves in and
// "presses" the same steps a student would take on the site.
export function FeatureShowcase() {
  return (
    <section className="mx-auto mt-20 flex max-w-6xl flex-col gap-24 px-4 sm:mt-28 sm:gap-32 sm:px-6">
      <Row
        eyebrow="Practice"
        title="29,000+ Question Papers"
        body={
          <>
            Every DU previous year paper, organised by course, semester and subject — across{" "}
            <Hl>all 118 programmes</Hl>. Pick a subject, tap a year, and the paper <Hl>opens right in your browser</Hl>.
            Free, no login.
          </>
        }
        cta={{ href: "/papers", label: "Browse Free Papers" }}
        mock={<PapersMock />}
      />
      <Row
        reverse
        eyebrow="Learn"
        title="Complete Subject Notes"
        body={
          <>
            Unit-wise notes built from <Hl>actual DU question papers</Hl> — with worked answers, diagrams and tables. Read
            the first <Hl>30% of any subject free</Hl>, then unlock the rest from <Hl>₹{SINGLE_PRICE}</Hl>.
          </>
        }
        cta={{ href: "/notes", label: "Read a Free Preview" }}
        mock={<NotesMock />}
      />
      <Row
        eyebrow="Revise"
        title="Notes as a PDF"
        body={
          <>
            Download your notes as a <Hl>clean, themed PDF</Hl> — the same look as the website, not a plain print. Revise on
            the metro, in the library, anywhere.
          </>
        }
        cta={{ href: "/paid-notes", label: "See Pricing" }}
        mock={<PdfMock />}
      />
    </section>
  );
}

function Hl({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-brand">{children}</strong>;
}

function Row({
  eyebrow,
  title,
  body,
  cta,
  mock,
  reverse,
}: {
  eyebrow: string;
  title: string;
  body: React.ReactNode;
  cta: { href: string; label: string };
  mock: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={reverse ? "lg:order-2" : ""}>
        <p className="text-base font-semibold text-foreground sm:text-lg">{eyebrow}</p>
        <h2 className="mt-1 text-balance font-display text-4xl font-bold tracking-[-0.03em] text-foreground sm:text-5xl">{title}</h2>
        <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-foreground/80 sm:text-lg">{body}</p>
        <Link
          href={cta.href}
          className="mt-7 inline-flex min-h-12 items-center gap-2 rounded-full bg-surface-muted px-6 text-base font-semibold text-foreground transition hover:bg-brand hover:text-brand-foreground"
        >
          {cta.label} <ArrowRight size={18} weight="bold" />
        </Link>
      </div>
      <div className={reverse ? "lg:order-1" : ""}>{mock}</div>
    </div>
  );
}

// Shared window frame; plays its animation only while on screen.
function MockWindow({ title, children, bubbles }: { title: string; children: React.ReactNode; bubbles?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [play, setPlay] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setPlay(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-xl px-2 sm:px-0">
      <div
        ref={ref}
        data-play={play}
        aria-hidden="true"
        className={`${s.mock} relative overflow-hidden rounded-[4cqw] border-2 border-brand bg-surface shadow-[0_20px_60px_rgba(83,88,227,0.15)]`}
        style={{ aspectRatio: "5 / 4" }}
      >
        <div className="flex h-[13%] items-center bg-brand px-[4cqw]">
          <p className="font-comic text-[4.4cqw] leading-none text-brand-foreground">{title}</p>
        </div>
        {children}
      </div>
      {bubbles}
    </div>
  );
}

function Bubble({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <p
      aria-hidden="true"
      className={`${s.bubble} absolute z-30 hidden max-w-[15rem] sm:block rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium leading-snug text-foreground shadow-[0_8px_24px_rgba(0,0,0,0.08)] sm:text-base ${className}`}
    >
      {children}
    </p>
  );
}

function Cursor({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${s.cursor} ${s.anim} ${className}`}>
      <path d="M4 2l15 10.5-6.6 1.3 3.9 7.6-2.8 1.4-3.8-7.7L4 19.5z" fill="white" stroke="#1a1d24" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

const SUBJECTS = [
  ["Management Accounting", 7],
  ["Company Law", 5],
  ["Financial Accounting", 6],
  ["Income Tax Law", 4],
  ["Principles of Marketing", 6],
] as const;

function PapersMock() {
  return (
    <MockWindow
      title="Step 1: Find your paper"
      bubbles={
        <>
          <Bubble className="-bottom-10 -left-10">all 118 courses, every semester!</Bubble>
          <Bubble className="-right-8 -top-10">opens right in your browser</Bubble>
        </>
      }
    >
      {/* Left: course + subjects */}
      <div className="absolute left-[4%] top-[17%] w-[44%] text-[2.6cqw]">
        <p className="font-semibold text-muted">B.Com (P) · Subjects</p>
      </div>
      {SUBJECTS.map(([name, count], i) => (
        <div
          key={name}
          className={`absolute left-[3%] flex w-[46%] items-center justify-between rounded-[1.5cqw] px-[2cqw] text-[2.7cqw] text-foreground transition hover:scale-[0.97] hover:bg-accent-soft ${i === 0 ? `${s.anim} ${s.row1}` : ""}`}
          style={{ top: `${25 + i * 12.5}%`, height: "11%" }}
        >
          <span className="truncate">{name}</span>
          <span className="text-muted">{count}</span>
        </div>
      ))}

      {/* Right: years + the opened paper */}
      <div className="absolute left-[52%] top-[17%] w-[44%] text-[2.6cqw] font-semibold text-muted">Years</div>
      {["2026", "2025", "2024"].map((y, i) => (
        <div
          key={y}
          className={`absolute flex items-center justify-center rounded-full text-[2.5cqw] font-semibold transition hover:scale-95 ${
            i === 1 ? `${s.anim} ${s.chip1}` : "bg-surface-muted text-muted"
          }`}
          style={{ left: `${52 + i * 14.5}%`, top: "21%", width: "13%", height: "7%" }}
        >
          {y}
        </div>
      ))}
      <div className={`${s.anim} ${s.sheet1} absolute left-[52%] top-[33%] flex h-[60%] w-[44%] flex-col gap-[1.6cqw] rounded-[1.5cqw] border border-border bg-white p-[2.5cqw] shadow-sm`}>
        <div className="flex items-center gap-[1cqw] text-[2.3cqw] font-semibold text-foreground">
          <FilePdf size="3.4cqw" weight="duotone" className="text-red-500" /> Mgmt Accounting · 2025
        </div>
        {[92, 78, 85, 60, 88, 70, 80].map((w, i) => (
          <div key={i} className="h-[1.2cqw] rounded-full bg-surface-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
      <Cursor className={s.c1} />
    </MockWindow>
  );
}

function NotesMock() {
  return (
    <MockWindow
      title="Step 2: Read the notes"
      bubbles={
        <>
          <Bubble className="-right-12 top-[38%]">worked answers to real DU PYQs</Bubble>
          <Bubble className="-bottom-10 -left-10">first 30% free for every subject</Bubble>
        </>
      }
    >
      <div className="absolute inset-x-[5%] top-[18%] flex flex-col gap-[1.8cqw] text-foreground">
        <p className="text-[3.6cqw] font-bold text-brand">Management Accounting</p>
        <p className="text-[2.6cqw] font-semibold">Unit 1 — Meaning &amp; Scope</p>
        {[95, 88, 70].map((w, i) => (
          <div key={i} className="h-[1.3cqw] rounded-full bg-surface-muted" style={{ width: `${w}%` }} />
        ))}
        {/* mini flowchart */}
        <div className="mt-[1cqw] flex items-center gap-[1.5cqw] text-[2.2cqw]">
          {["Planning", "Control", "Decisions"].map((t, i) => (
            <span key={t} className="flex items-center gap-[1.5cqw]">
              <span className="rounded-[1cqw] border border-brand/40 bg-brand/5 px-[1.8cqw] py-[0.8cqw] font-medium text-brand">{t}</span>
              {i < 2 && <span className="text-muted">→</span>}
            </span>
          ))}
        </div>
      </div>
      {/* the locked remainder */}
      <div className={`${s.anim} ${s.blur2} absolute inset-x-[5%] top-[58%] flex flex-col gap-[1.6cqw]`}>
        <p className="text-[2.6cqw] font-semibold text-foreground">Q1 (10 marks) — Full answer</p>
        {[90, 82, 94, 66].map((w, i) => (
          <div key={i} className="h-[1.3cqw] rounded-full bg-surface-muted" style={{ width: `${w}%` }} />
        ))}
      </div>
      <div className={`${s.anim} ${s.lock2} absolute inset-x-0 bottom-0 top-[56%] flex flex-col items-center justify-center gap-[1.5cqw] bg-gradient-to-b from-surface/40 to-surface`}>
        <LockSimple size="5cqw" weight="bold" className="text-brand" />
        <span className={`${s.anim} ${s.unlockBtn} rounded-full bg-brand px-[4cqw] py-[1.6cqw] text-[2.8cqw] font-semibold text-brand-foreground transition hover:scale-95`}>
          Unlock ₹{SINGLE_PRICE}
        </span>
      </div>
      <Cursor className={s.c2} />
    </MockWindow>
  );
}

function PdfMock() {
  return (
    <MockWindow
      title="Step 3: Revise anywhere"
      bubbles={<Bubble className="-bottom-12 -left-10">same look as the site — not a plain print</Bubble>}
    >
      <div className="absolute inset-x-[5%] top-[18%] flex items-center justify-between">
        <p className="text-[3.2cqw] font-bold text-foreground">Company Law</p>
        <span className={`${s.anim} ${s.dlBtn} flex items-center gap-[1cqw] rounded-[1.5cqw] border border-border bg-surface px-[2.2cqw] py-[1.2cqw] text-[2.4cqw] font-semibold text-foreground transition hover:scale-95`}>
          <DownloadSimple size="3cqw" weight="bold" /> Download PDF
        </span>
      </div>
      <div className="absolute inset-x-[5%] top-[31%]">
        <div className="h-[1.6cqw] overflow-hidden rounded-full bg-surface-muted">
          <div className={`${s.anim} ${s.bar3} h-full rounded-full bg-brand`} />
        </div>
      </div>
      <div className={`${s.anim} ${s.pages3} absolute inset-x-[8%] top-[39%] bottom-[6%]`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="absolute top-0 flex h-full w-[38%] flex-col gap-[1.2cqw] rounded-[1.2cqw] border border-border bg-[#f3f7ff] p-[2cqw] shadow-md"
            style={{ left: `${i * 31}%`, transform: `rotate(${(i - 1) * 4}deg)`, zIndex: 3 - Math.abs(i - 1) }}
          >
            <div className="h-[2cqw] w-3/4 rounded bg-brand/70" />
            {[90, 70, 85, 60, 80].map((w, j) => (
              <div key={j} className="h-[1cqw] rounded-full bg-brand/15" style={{ width: `${w}%` }} />
            ))}
            <div className="mt-auto rounded-[0.8cqw] border border-brand/30 bg-white p-[1cqw]">
              <div className="h-[1cqw] w-2/3 rounded-full bg-brand/20" />
            </div>
          </div>
        ))}
        <p className="absolute -bottom-[1cqw] right-0 z-10 flex items-center gap-[1cqw] rounded-full bg-green-600 px-[2cqw] py-[0.8cqw] text-[2.3cqw] font-semibold text-white">
          <CheckCircle size="2.8cqw" weight="fill" /> Notes.pdf saved
        </p>
      </div>
      <Cursor className={s.c3} />
    </MockWindow>
  );
}
