"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowCounterClockwise,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  MinusCircle,
  SquaresFour,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { JAM_UNITS, keyLabel, type JamQuestion } from "@/lib/jam-economics";
import { SECTIONS, hasAnswer, markQuestion, saveAttempt, readAttempts, scoreMock, type MockAttempt, type MockResult, type MockTest } from "@/lib/jam-mock";
import { SolutionMarkdown } from "@/components/pyq-analyser/solution-markdown";
import { CbtCalculator } from "@/components/mock-test/cbt-calculator";

// Exam console for one JAM Economics mock, modelled on the JAM CBT:
// sections, palette with the five standard statuses, Save & Next / Mark for
// Review, timer with auto-submit, then a scored review with full solutions.

type Status = "not_visited" | "not_answered" | "answered" | "marked" | "answered_marked";
type Saved = { picked: string[]; nat: string; status: Status; time: number };
type Live = { startedAt: number; deadline: number; idx: number; saved: Record<string, Saved> };
type Draft = { picked: string[]; nat: string };

const BLANK: Saved = { picked: [], nat: "", status: "not_answered", time: 0 };
const EMPTY_DRAFT: Draft = { picked: [], nat: "" };

const STATUS_INFO: { status: Status; label: string }[] = [
  { status: "answered", label: "Answered" },
  { status: "not_answered", label: "Not Answered" },
  { status: "not_visited", label: "Not Visited" },
  { status: "marked", label: "Marked for Review" },
  { status: "answered_marked", label: "Answered & Marked (will be evaluated)" },
];

const RESULT_STYLE: Record<MockResult, { label: string; chip: string; pill: string }> = {
  correct: { label: "Correct", chip: "bg-emerald-50 text-emerald-700", pill: "bg-emerald-500 text-white" },
  wrong: { label: "Wrong", chip: "bg-red-50 text-red-700", pill: "bg-red-500 text-white" },
  skipped: { label: "Skipped", chip: "bg-surface-muted text-muted", pill: "bg-surface-muted text-foreground" },
  bonus: { label: "Marks to all", chip: "bg-amber-50 text-amber-700", pill: "bg-amber-400 text-white" },
};

const counted = (s?: Saved) => s?.status === "answered" || s?.status === "answered_marked";

function clock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const hh = Math.floor(s / 3600);
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return hh ? `${hh}:${mm}:${ss}` : `${mm}:${ss}`;
}

const negative = (q: JamQuestion) => (q.type === "MCQ" ? `−${q.marks === 1 ? "⅓" : "⅔"}` : "0");

/** Palette chip in the JAM/TCS CBT style: green chamfered = answered, orange shield = not answered, grey = not visited, purple circle = marked. */
function StatusChip({ status, children, className = "" }: { status: Status; children: React.ReactNode; className?: string }) {
  const base = `relative flex items-center justify-center ${className}`;
  if (status === "answered")
    return (
      <span className={`${base} bg-gradient-to-b from-[#6cc04a] to-[#3f9a2b] text-white`} style={{ clipPath: "polygon(0 22%, 22% 0, 78% 0, 100% 22%, 100% 100%, 0 100%)" }}>
        {children}
      </span>
    );
  if (status === "not_answered")
    return (
      <span className={`${base} bg-gradient-to-b from-[#f0672d] to-[#c9400f] text-white`} style={{ clipPath: "polygon(0 0, 100% 0, 100% 72%, 50% 100%, 0 72%)" }}>
        {children}
      </span>
    );
  if (status === "not_visited")
    return <span className={`${base} rounded-[3px] border border-[#b9b9b9] bg-gradient-to-b from-[#f7f7f7] to-[#dcdcdc] text-[#111] shadow-[0_1px_1px_rgba(0,0,0,0.15)]`}>{children}</span>;
  return (
    <span className={`${base} !w-auto mx-auto aspect-square rounded-full bg-gradient-to-b from-[#7d55b3] to-[#5a3590] text-white`}>
      {children}
      {status === "answered_marked" && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white bg-[#3f9a2b]" />}
    </span>
  );
}

/** Plain candidate silhouette, like the photo slot on the JAM CBT screen. */
function CandidateAvatar() {
  return (
    <svg viewBox="0 0 96 96" className="size-[92px] shrink-0" aria-hidden>
      <rect width="96" height="96" fill="#eef2f7" />
      <circle cx="48" cy="36" r="17" fill="#f2c7a5" />
      <path d="M31 33c0-12 8-19 17-19s17 7 17 19c-3-6-9-9-17-9s-14 3-17 9z" fill="#6b3f22" />
      <path d="M14 96c2-20 15-31 34-31s32 11 34 31z" fill="#2f6fd6" />
      <path d="M41 65h14l-7 14z" fill="#fff" />
      <path d="M47 68h2l2 16-3 4-3-4z" fill="#1e4aa0" />
    </svg>
  );
}

function OptionText({ text }: { text: string }) {
  return (
    <span className="min-w-0 flex-1 [&_.nt-root]:!bg-transparent [&_.pyq-solution]:text-[15px] [&_.pyq-solution_p]:!my-0">
      <SolutionMarkdown content={text} />
    </span>
  );
}

function Instructions({ test, questions }: { test: MockTest; questions: JamQuestion[] }) {
  const sections = SECTIONS.filter((s) => questions.some((q) => q.type === s.type));
  return (
    <div className="space-y-5 text-sm leading-relaxed text-muted">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Questions", questions.length],
          ["Marks", test.marks],
          ["Time", `${test.minutes} min`],
          ["Sections", sections.length],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-surface-muted px-4 py-3">
            <p className="text-xs">{k}</p>
            <p className="text-xl font-semibold text-foreground">{v}</p>
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1.5 font-semibold text-foreground">Marking scheme (as in JAM)</p>
        <ul className="list-disc space-y-1 pl-5">
          {sections.map((s) => (
            <li key={s.id}>
              <b className="font-medium text-foreground">{s.label}:</b>{" "}
              {s.type === "MCQ"
                ? "one correct option. A wrong answer costs ⅓ mark (1-mark questions) or ⅔ mark (2-mark questions)."
                : s.type === "MSQ"
                  ? "one or more correct options. You must pick exactly the correct set. No negative and no partial marks."
                  : "type a number. No options, no negative marks."}
            </li>
          ))}
          <li>Questions where IIT awarded marks to all give full marks to everyone.</li>
        </ul>
      </div>
      <div>
        <p className="mb-2 font-semibold text-foreground">Question palette</p>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {STATUS_INFO.map((s) => (
            <li key={s.status} className="flex items-center gap-3">
              <StatusChip status={s.status} className="size-8 shrink-0">
                7
              </StatusChip>
              {s.label}
            </li>
          ))}
        </ul>
      </div>
      <p>
        An answer is saved only with <b className="text-foreground">Save &amp; Next</b> or <b className="text-foreground">Mark for Review &amp; Next</b>.
        Moving away with Previous, the palette or a section tab leaves an unsaved choice behind, just like the real exam. The test submits itself when
        the timer reaches zero.
      </p>
    </div>
  );
}

export function JamMockCbt({ test, questions }: { test: MockTest; questions: JamQuestion[] }) {
  const [phase, setPhase] = useState<"loading" | "intro" | "test" | "result">("loading");
  const [live, setLive] = useState<Live | null>(null);
  const [resume, setResume] = useState<Live | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [now, setNow] = useState(0);
  const [attempt, setAttempt] = useState<MockAttempt | null>(null);
  const [modal, setModal] = useState<null | "submit" | "instructions" | "paper">(null);
  const [calc, setCalc] = useState(false);
  const [palette, setPalette] = useState(false);
  const liveKey = `jam-mock:live:${test.id}`;

  const sections = useMemo(() => SECTIONS.filter((s) => questions.some((q) => q.type === s.type)), [questions]);

  // ?review=<attempt id> opens a submitted attempt; otherwise offer to resume an unfinished one.
  useEffect(() => {
    Promise.resolve().then(() => {
      const reviewId = new URLSearchParams(window.location.search).get("review");
      const found = reviewId ? readAttempts().find((a) => a.id === reviewId && a.testId === test.id) : null;
      if (found) {
        setAttempt(found);
        setPhase("result");
        return;
      }
      try {
        const saved: Live | null = JSON.parse(localStorage.getItem(liveKey) ?? "null");
        if (saved && saved.deadline > Date.now()) setResume(saved);
        setNow(Date.now());
      } catch {}
      setPhase("intro");
    });
  }, [liveKey, test.id]);

  const finish = (l: Live) => {
    const responses: MockAttempt["responses"] = {};
    for (const q of questions) {
      const s = l.saved[q.id];
      if (!s) continue;
      responses[q.id] = { picked: counted(s) ? s.picked : [], nat: counted(s) ? s.nat : "", time: s.time };
    }
    const a: MockAttempt = {
      id: Date.now().toString(36),
      testId: test.id,
      kind: test.kind,
      title: test.title,
      at: Date.now(),
      usedSec: Math.min(test.minutes * 60, Math.round((Date.now() - l.startedAt) / 1000)),
      ...scoreMock(questions, responses),
      responses,
    };
    saveAttempt(a);
    try {
      localStorage.removeItem(liveKey);
    } catch {}
    window.history.replaceState(null, "", `?review=${a.id}`);
    setAttempt(a);
    setLive(null);
    setModal(null);
    setPhase("result");
    window.scrollTo(0, 0);
  };

  // One-second tick: clock, time on the current question, autosave, auto-submit.
  useEffect(() => {
    if (phase !== "test" || !live) return;
    const t = setTimeout(() => {
      if (Date.now() >= live.deadline) return finish(live);
      const id = questions[live.idx].id;
      const next = { ...live, saved: { ...live.saved, [id]: { ...live.saved[id], time: live.saved[id].time + 1 } } };
      setNow(Date.now());
      setLive(next);
      try {
        localStorage.setItem(liveKey, JSON.stringify(next));
      } catch {}
    }, 1000);
    return () => clearTimeout(t);
  });

  // The exam takes the whole screen; stop the page behind it scrolling.
  useEffect(() => {
    if (phase !== "test") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [phase]);

  const begin = (from: Live | null) => {
    const l = from ?? { startedAt: Date.now(), deadline: Date.now() + test.minutes * 60_000, idx: 0, saved: { [questions[0].id]: BLANK } };
    const s = l.saved[questions[l.idx].id];
    setLive(l);
    setNow(Date.now());
    setDraft(counted(s) ? { picked: s.picked, nat: s.nat } : EMPTY_DRAFT);
    setPhase("test");
  };

  if (phase === "loading") return <div className="min-h-[60vh]" />;

  if (phase === "result" && attempt)
    return (
      <Result
        test={test}
        questions={questions}
        attempt={attempt}
        onRetake={() => {
          window.history.replaceState(null, "", window.location.pathname);
          setAttempt(null);
          setResume(null);
          setPhase("intro");
        }}
      />
    );

  if (phase === "intro" || !live)
    return (
      <div className="mx-auto max-w-3xl px-3 pb-12 pt-5 sm:px-5 lg:pt-8">
        <Link href="/jameco/mock" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
          <ArrowLeft size={14} /> All mock tests
        </Link>
        <div className="mt-4 rounded-3xl border border-border bg-surface p-5 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
            IIT JAM Economics · {test.kind === "full" ? "Full-length mock" : test.kind === "section" ? "Sectional mock" : `Topic test · ${test.unit}`}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{test.title}</h1>
          <div className="mt-6">
            <Instructions test={test} questions={questions} />
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            {resume && (
              <button type="button" onClick={() => begin(resume)} className="rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700">
                Resume ({clock((resume.deadline - now) / 1000)} left)
              </button>
            )}
            <button
              type="button"
              onClick={() => begin(null)}
              className={`rounded-xl px-5 py-3 text-sm font-semibold ${resume ? "border border-border text-foreground hover:bg-surface-muted" : "bg-foreground text-background hover:opacity-90"}`}
            >
              {resume ? "Start over" : "I'm ready, start the test"}
            </button>
          </div>
        </div>
      </div>
    );

  const q = questions[live.idx];
  const section = sections.find((s) => s.type === q.type)!;
  const inSection = questions.map((qq, i) => ({ qq, i })).filter((x) => x.qq.type === section.type);
  const statusOf = (id: string): Status => live.saved[id]?.status ?? "not_visited";
  const counts = Object.fromEntries(STATUS_INFO.map((s) => [s.status, questions.filter((qq) => statusOf(qq.id) === s.status).length])) as Record<Status, number>;
  const left = (live.deadline - now) / 1000;

  // Move to question i; `patch` saves the current one first (unsaved drafts are dropped, as in JAM).
  const goTo = (i: number, patch?: Partial<Saved>) => {
    const saved = { ...live.saved };
    if (patch) saved[q.id] = { ...saved[q.id], ...patch };
    const target = questions[i];
    saved[target.id] ??= BLANK;
    setLive({ ...live, idx: i, saved });
    const s = saved[target.id];
    setDraft(counted(s) ? { picked: s.picked, nat: s.nat } : EMPTY_DRAFT);
    setPalette(false);
  };
  const nextIdx = Math.min(live.idx + 1, questions.length - 1);
  const filled = hasAnswer(q, draft);
  const saveNext = () => goTo(nextIdx, { ...draft, status: filled ? "answered" : "not_answered" });
  const markNext = () => goTo(nextIdx, { ...draft, status: filled ? "answered_marked" : "marked" });
  const clear = () => {
    setDraft(EMPTY_DRAFT);
    setLive({ ...live, saved: { ...live.saved, [q.id]: { ...live.saved[q.id], picked: [], nat: "", status: "not_answered" } } });
  };
  const pick = (label: string) =>
    setDraft((d) => ({ ...d, picked: q.type === "MCQ" ? [label] : d.picked.includes(label) ? d.picked.filter((l) => l !== label) : [...d.picked, label].sort() }));

  const shortTitle = test.kind === "full" ? `JAM ${test.year}` : test.kind === "section" ? test.title.replace(" · Section", " Section") : test.title;
  const topBtn = "shrink-0 whitespace-nowrap px-2 py-1 text-[13px] text-white hover:underline sm:px-3 sm:text-[15px]";
  const cbtBtn = "h-10 rounded-[3px] border border-[#c9c9c9] bg-white px-3 text-[15px] text-[#222] shadow-[0_1px_1px_rgba(0,0,0,0.06)] hover:bg-[#f3f3f3] sm:px-5 sm:text-[17px]";

  const paletteBody = (
    <>
      <ul className="grid grid-cols-2 gap-x-2 gap-y-3 px-3 py-4 text-[13px] leading-tight text-[#333]">
        {STATUS_INFO.map((s) => (
          <li key={s.status} className={`flex items-center gap-2 ${s.status === "answered_marked" ? "col-span-2" : ""}`}>
            <StatusChip status={s.status} className="h-[30px] w-[34px] shrink-0 text-[14px]">
              {counts[s.status]}
            </StatusChip>
            {s.label}
          </li>
        ))}
      </ul>
      <p className="bg-[#4a87f5] px-3 py-1 text-[19px] text-white">JAM Economics Mocks</p>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
        <p className="mb-3 text-[16px] font-semibold text-[#111]">Choose a Question</p>
        <div className="grid grid-cols-4 gap-x-3 gap-y-3.5">
          {inSection.map(({ qq, i }) => (
            <button key={qq.id} type="button" onClick={() => goTo(i)} aria-label={`Question ${i + 1}`} aria-current={i === live.idx} className="focus:outline-none">
              <StatusChip status={statusOf(qq.id)} className="h-[44px] w-full text-[18px]">
                {i + 1}
              </StatusChip>
            </button>
          ))}
        </div>
      </div>
      <div className="flex justify-center bg-[#dce7f8] py-2.5">
        <button type="button" onClick={() => setModal("submit")} className="h-11 rounded-[3px] bg-[#8ab4f8] px-4 text-[19px] text-white hover:bg-[#6a9ff5]">
          Submit
        </button>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-white text-[#111] dark:bg-background dark:text-foreground">
      <header className="flex h-8 shrink-0 items-center bg-[#1f2a3d]">
        <span className="min-w-0 flex-1 truncate px-2.5 text-[17px] text-[#f6b026] sm:text-[19px]">{shortTitle}</span>
        <button type="button" onClick={() => setModal("instructions")} className={topBtn}>
          <span className="hidden sm:inline">View </span>Instructions
        </button>
        <button type="button" onClick={() => setModal("paper")} className={`${topBtn} hidden sm:block`}>
          Question Paper
        </button>
        <button type="button" onClick={() => setCalc(true)} className={topBtn}>
          Calculator
        </button>
        <button type="button" onClick={() => setPalette(true)} className={`${topBtn} lg:hidden`} aria-label="Question palette">
          <SquaresFour size={18} />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[30px] shrink-0 items-center justify-between border-b border-[#e5e5e5] px-2.5 text-[16px] sm:text-[18px]">
            <span>Sections</span>
            <span className={left < 300 ? "text-red-600" : ""}>Time Left: {clock(left)}</span>
          </div>
          <div className="flex shrink-0 items-end justify-between gap-2 px-2.5 pt-1">
            <div className="flex">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goTo(questions.findIndex((qq) => qq.type === s.type))}
                  className={`h-[44px] border border-[#e3e3e3] px-2.5 text-[18px] sm:text-[19px] ${s.type === q.type ? "border-[#4a87f5] bg-[#4a87f5] text-white" : "bg-white text-[#111] hover:bg-[#f3f3f3]"}`}
                >
                  {s.type}
                </button>
              ))}
            </div>
            <span className="pb-1.5 text-[14px] sm:text-[18px]">Time Spent (Question): {clock(live.saved[q.id]?.time ?? 0)}</span>
          </div>
          <p className="mt-1 shrink-0 bg-[#4a87f5] px-2.5 py-0.5 text-[18px] text-white sm:text-[19px]">JAM Economics Mock</p>
          <div className="flex shrink-0 items-center gap-3 border-b border-[#e0e0e0] px-2.5 py-1 text-[15px]">
            <b className="font-bold">Question No. {live.idx + 1}</b>
            <span className="ml-auto text-[13px] text-[#555]">
              {test.kind === "topic" ? `JAM ${q.year} · ` : ""}Marks: +{q.marks} · Negative: {negative(q)}
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-7">
            <div className="text-[17px] leading-[1.65] [&_.nt-root]:!bg-transparent [&_.pyq-solution]:!text-[17px]">
              <SolutionMarkdown key={`q-${q.id}`} content={q.stem} />
            </div>
            {q.type === "NAT" ? (
              <input
                value={draft.nat}
                onChange={(e) => /^-?\d*\.?\d*$/.test(e.target.value) && setDraft({ ...draft, nat: e.target.value })}
                inputMode="decimal"
                autoComplete="off"
                aria-label="Numerical answer"
                className="mt-5 h-10 w-56 border border-[#9a9a9a] bg-white px-2 text-[17px] text-[#111] focus:outline-none focus:ring-1 focus:ring-[#4a87f5]"
              />
            ) : (
              <div className="mt-4 space-y-1.5">
                {q.options.map((o) => (
                  <label key={o.label} className="flex cursor-pointer items-center gap-3 py-1 text-[17px]">
                    <input
                      type={q.type === "MCQ" ? "radio" : "checkbox"}
                      name={`opt-${q.id}`}
                      checked={draft.picked.includes(o.label)}
                      onChange={() => pick(o.label)}
                      className="size-[15px] shrink-0 accent-[#4a87f5]"
                    />
                    <OptionText text={o.text} />
                  </label>
                ))}
              </div>
            )}
          </div>

          <footer className="grid shrink-0 grid-cols-2 gap-2 border-t border-[#e5e5e5] bg-white px-3 py-2.5 sm:flex sm:items-center sm:gap-2.5 sm:px-4 dark:bg-background">
            <button type="button" onClick={markNext} className={cbtBtn}>
              <span className="sm:hidden">Mark &amp; Next</span>
              <span className="hidden sm:inline">Mark for Review &amp; Next</span>
            </button>
            <button type="button" onClick={clear} className={cbtBtn}>
              Clear Response
            </button>
            <button type="button" onClick={() => goTo(Math.max(live.idx - 1, 0))} disabled={live.idx === 0} className={`${cbtBtn} disabled:opacity-60 sm:ml-auto`}>
              Previous
            </button>
            <button type="button" onClick={saveNext} className="h-10 rounded-[3px] bg-[#3d82f6] px-5 text-[15px] text-white hover:bg-[#2f6fe0] sm:text-[17px]">
              Save &amp; Next
            </button>
          </footer>
        </main>

        <aside className="hidden w-[272px] shrink-0 flex-col lg:flex">
          <div className="flex h-[120px] shrink-0 items-center gap-4 px-4">
            <CandidateAvatar />
            <span className="text-[17px] leading-snug">Candidate</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col border-l-[5px] border-t-[5px] border-[#c6d4e8]">{paletteBody}</div>
        </aside>
      </div>

      {palette && (
        <div className="fixed inset-0 z-10 flex justify-end bg-black/40 lg:hidden" onClick={() => setPalette(false)}>
          <aside className="flex h-full w-[min(18rem,88vw)] flex-col bg-white text-[#111]" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-[#1f2a3d] px-3 py-2 text-white">
              <span className="text-[15px]">Question Palette</span>
              <button type="button" onClick={() => setPalette(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {paletteBody}
          </aside>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 sm:items-center sm:p-6" onClick={() => setModal(null)}>
          <div className="flex max-h-[88dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-surface sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-lg font-semibold">{modal === "submit" ? "Submit the test?" : modal === "paper" ? "Question paper" : "Instructions"}</h2>
              <button type="button" onClick={() => setModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="overflow-y-auto px-5 py-4">
              {modal === "instructions" && <Instructions test={test} questions={questions} />}
              {modal === "paper" && (
                <ol className="space-y-4">
                  {questions.map((qq, i) => (
                    <li key={qq.id} className="border-b border-border pb-4 last:border-0">
                      <button type="button" onClick={() => (goTo(i), setModal(null))} className="mb-1 text-xs font-semibold text-violet-600 hover:underline">
                        Question {i + 1} · {qq.type} · {qq.marks} mark{qq.marks > 1 ? "s" : ""}
                      </button>
                      <div className="pyq-paper text-sm">
                        <SolutionMarkdown content={qq.stem} />
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {modal === "submit" && (
                <>
                  <div className="divide-y divide-border rounded-2xl border border-border">
                    {sections.map((s) => {
                      const qs = questions.filter((qq) => qq.type === s.type);
                      const n = (st: Status[]) => qs.filter((qq) => st.includes(statusOf(qq.id))).length;
                      return (
                        <div key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
                          <span className="w-full font-medium sm:w-36">{s.label}</span>
                          <span className="text-emerald-700">{n(["answered", "answered_marked"])} answered</span>
                          <span className="text-red-600">{n(["not_answered"])} not answered</span>
                          <span className="text-violet-700">{n(["marked"])} marked</span>
                          <span className="text-muted">{n(["not_visited"])} not visited</span>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-sm text-muted">
                    {clock(left)} still left. Answers marked for review without an answer are not evaluated. You cannot change answers after submitting.
                  </p>
                  <div className="mt-5 flex justify-end gap-2">
                    <button type="button" onClick={() => setModal(null)} className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-surface-muted">
                      Keep working
                    </button>
                    <button type="button" onClick={() => finish(live)} className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700">
                      Submit
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {calc && <CbtCalculator onClose={() => setCalc(false)} />}
    </div>
  );
}

function Result({ test, questions, attempt, onRetake }: { test: MockTest; questions: JamQuestion[]; attempt: MockAttempt; onRetake: () => void }) {
  const [filter, setFilter] = useState<MockResult | "all">("all");
  const [pos, setPos] = useState(0);
  const marked = questions.map((q, i) => ({ q, i, ...markQuestion(q, attempt.responses[q.id]) }));
  const shown = marked.filter((m) => filter === "all" || m.result === filter || (filter === "correct" && m.result === "bonus"));
  const cur = shown[Math.min(pos, shown.length - 1)];
  const pct = Math.max(0, Math.round((attempt.score / attempt.max) * 100));
  const accuracy = attempt.correct + attempt.wrong ? Math.round((attempt.correct / (attempt.correct + attempt.wrong)) * 100) : 0;
  const sum = (ms: typeof marked) => Math.round(ms.reduce((n, m) => n + m.marks, 0) * 100) / 100;
  const groups = [
    ...SECTIONS.map((s) => ({ label: s.label, ms: marked.filter((m) => m.q.type === s.type) })),
    ...(test.kind === "full" ? JAM_UNITS.map((u) => ({ label: u, ms: marked.filter((m) => m.q.unit === u) })) : []),
  ].filter((g) => g.ms.length);
  const r = cur && attempt.responses[cur.q.id];

  return (
    <div className="mx-auto max-w-5xl px-3 pb-12 pt-5 sm:px-5 lg:pt-8">
      <Link href="/jameco/mock" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={14} /> All mock tests
      </Link>

      <section className="mt-4 overflow-hidden rounded-3xl border border-border bg-surface">
        <div className="bg-zinc-900 px-5 py-6 text-white sm:px-8 sm:py-8">
          <p className="text-sm text-zinc-400">
            {test.title} · {new Date(attempt.at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
          </p>
          <p className="mt-2 text-5xl font-semibold tabular-nums">
            {attempt.score}
            <span className="text-2xl font-normal text-zinc-400"> / {attempt.max}</span>
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
            <div className="h-full rounded-full bg-amber-300" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
          {[
            ["Correct", attempt.correct, "text-emerald-600"],
            ["Wrong", attempt.wrong, "text-red-600"],
            ["Skipped", attempt.skipped, "text-muted"],
            ["Accuracy", `${accuracy}%`, "text-foreground"],
            ["Time used", clock(attempt.usedSec), "text-foreground"],
          ].map(([k, v, c]) => (
            <div key={k} className="bg-surface px-5 py-4 last:col-span-2 sm:last:col-span-1">
              <p className="text-xs text-muted">{k}</p>
              <p className={`mt-0.5 text-2xl font-semibold tabular-nums ${c}`}>{v}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const c = g.ms.filter((m) => m.result === "correct" || m.result === "bonus").length;
          const w = g.ms.filter((m) => m.result === "wrong").length;
          return (
            <div key={g.label} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{g.label}</p>
                <p className="text-sm tabular-nums text-foreground">
                  {sum(g.ms)}
                  <span className="text-muted">/{g.ms.reduce((n, m) => n + m.q.marks, 0)}</span>
                </p>
              </div>
              <div className="mt-2.5 flex h-2 overflow-hidden rounded-full bg-surface-muted">
                <span className="bg-emerald-500" style={{ width: `${(c / g.ms.length) * 100}%` }} />
                <span className="bg-red-400" style={{ width: `${(w / g.ms.length) * 100}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {c} correct · {w} wrong · {g.ms.length - c - w} skipped
              </p>
            </div>
          );
        })}
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-foreground">Review answers</h2>
          <div className="flex flex-wrap gap-2">
            {(["all", "correct", "wrong", "skipped"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => (setFilter(f), setPos(0))}
                className={`rounded-full px-3.5 py-1.5 text-sm capitalize transition ${filter === f ? "bg-foreground text-background" : "bg-surface-muted text-muted hover:text-foreground"}`}
              >
                {f} {f === "all" ? marked.length : marked.filter((m) => m.result === f || (f === "correct" && m.result === "bonus")).length}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {shown.map((m, i) => (
            <button
              key={m.q.id}
              type="button"
              onClick={() => setPos(i)}
              className={`h-9 min-w-9 shrink-0 rounded-lg px-2 text-sm font-semibold ${RESULT_STYLE[m.result].pill} ${cur?.q.id === m.q.id ? "ring-2 ring-foreground ring-offset-2 ring-offset-background" : ""}`}
            >
              {m.i + 1}
            </button>
          ))}
        </div>

        {cur ? (
          <article className="mt-4 space-y-4 rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">Question {cur.i + 1}</span>
              <span className={`rounded-full px-2.5 py-1 font-medium ${RESULT_STYLE[cur.result].chip}`}>
                {RESULT_STYLE[cur.result].label} · {cur.marks > 0 ? "+" : ""}
                {Math.round(cur.marks * 100) / 100}
              </span>
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-foreground">
                JAM {cur.q.year} Q{cur.q.number} · {cur.q.type}
              </span>
              <span className="rounded-full bg-surface-muted px-2.5 py-1 text-foreground">{cur.q.topic}</span>
              {r && r.time > 0 && <span className="ml-auto text-muted">{clock(r.time)} spent</span>}
            </div>
            <div className="pyq-paper">
              <SolutionMarkdown key={`r-${cur.q.id}`} content={cur.q.stem} />
            </div>
            {cur.q.type === "NAT" ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <span className="rounded-xl border border-border px-4 py-2.5">
                  Your answer: <b className="font-semibold">{r?.nat || "—"}</b>
                </span>
                <span className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-emerald-800">
                  Correct: <b className="font-semibold">{keyLabel(cur.q)}</b>
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                {cur.q.options.map((o) => {
                  const right = cur.q.key === "all" || cur.q.key.split(",").includes(o.label);
                  const mine = !!r?.picked.includes(o.label);
                  return (
                    <div
                      key={o.label}
                      className={`flex items-start gap-3 rounded-2xl border px-4 py-3 ${right ? "border-emerald-400 bg-emerald-50/70" : mine ? "border-red-300 bg-red-50/70" : "border-border"}`}
                    >
                      <span className="mt-0.5 text-sm font-semibold">({o.label})</span>
                      <OptionText text={o.text} />
                      {mine && <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[11px] font-medium text-background">Your pick</span>}
                    </div>
                  );
                })}
              </div>
            )}
            <div className="rounded-2xl bg-surface-muted/60 p-4 sm:p-5 [&_.nt-root]:!bg-transparent">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                {cur.result === "wrong" ? (
                  <XCircle size={18} weight="fill" className="text-red-500" />
                ) : cur.result === "skipped" ? (
                  <MinusCircle size={18} weight="fill" className="text-muted" />
                ) : (
                  <CheckCircle size={18} weight="fill" className="text-emerald-600" />
                )}
                Solution · Answer: {keyLabel(cur.q)}
              </p>
              <SolutionMarkdown key={cur.q.id} content={cur.q.solution} />
            </div>
            <div className="flex justify-between gap-3">
              <button
                type="button"
                onClick={() => setPos((p) => Math.max(p - 1, 0))}
                disabled={pos === 0}
                className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium hover:bg-surface-muted disabled:opacity-40"
              >
                <ArrowLeft size={14} /> Previous
              </button>
              <button
                type="button"
                onClick={() => setPos((p) => Math.min(p + 1, shown.length - 1))}
                disabled={pos >= shown.length - 1}
                className="flex items-center gap-1.5 rounded-xl bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-40"
              >
                Next <ArrowRight size={14} />
              </button>
            </div>
          </article>
        ) : (
          <p className="mt-4 rounded-2xl border border-border p-6 text-center text-sm text-muted">No questions here.</p>
        )}
      </section>

      <div className="mt-8 flex flex-wrap gap-3">
        <button type="button" onClick={onRetake} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white hover:bg-violet-700">
          <ArrowCounterClockwise size={16} /> Retake this test
        </button>
        <Link href="/jameco/mock" className="rounded-xl border border-border px-5 py-3 text-sm font-semibold text-foreground hover:bg-surface-muted">
          All mock tests
        </Link>
      </div>
    </div>
  );
}
