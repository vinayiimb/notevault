"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle, XCircle } from "@phosphor-icons/react";
import { keyLabel, type JamQuestion } from "@/lib/jam-economics";
import { markQuestion, readAttempts, saveAttempt, scoreMock, type MockAttempt, type MockTest } from "@/lib/jam-mock";
import { SolutionMarkdown } from "@/components/pyq-analyser/solution-markdown";
import { Result } from "@/components/jam/mock-cbt";

// Topic tests are practice, not an exam: one question at a time, Submit checks it
// straight away, and the attempt is saved after every answer.

type Answer = { picked: string[]; nat: string; time: number };

const clock = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

function Wordmark() {
  return (
    <span className="font-display text-[22px] font-bold leading-[0.95] tracking-tight text-[#e8743b] sm:text-[26px]">
      IIT JAM
      <span className="block text-[15px] text-[#f0a35e] sm:text-[17px]">Economics</span>
    </span>
  );
}

export function JamTopicTest({ test, questions }: { test: MockTest; questions: JamQuestion[] }) {
  const [phase, setPhase] = useState<"loading" | "test" | "result">("loading");
  const [attemptId, setAttemptId] = useState("");
  const [startedAt, setStartedAt] = useState(0);
  const [done, setDone] = useState<Record<string, Answer>>({});
  const [idx, setIdx] = useState(0);
  const [draft, setDraft] = useState({ picked: [] as string[], nat: "" });
  const [tick, setTick] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [attempt, setAttempt] = useState<MockAttempt | null>(null);

  useEffect(() => {
    Promise.resolve().then(() => {
      const reviewId = new URLSearchParams(window.location.search).get("review");
      const found = reviewId ? readAttempts().find((a) => a.id === reviewId && a.testId === test.id) : null;
      if (found) {
        setAttempt(found);
        setPhase("result");
        return;
      }
      setAttemptId(Date.now().toString(36));
      setStartedAt(Date.now());
      setPhase("test");
    });
  }, [test.id]);

  const q = questions[idx];
  const answered = q ? done[q.id] : undefined;

  // Stopwatch for the current question; stops once it is answered.
  useEffect(() => {
    if (phase !== "test" || answered) return;
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [phase, answered, idx]);

  const record = (next: Record<string, Answer>): MockAttempt => {
    const a: MockAttempt = {
      id: attemptId,
      testId: test.id,
      kind: test.kind,
      title: test.title,
      at: Date.now(),
      usedSec: Math.round((Date.now() - startedAt) / 1000),
      ...scoreMock(questions, next),
      responses: next,
    };
    saveAttempt(a);
    return a;
  };

  const go = (i: number) => {
    setIdx(i);
    setTick(0);
    setShowSolution(false);
    const a = done[questions[i].id];
    setDraft(a ? { picked: a.picked, nat: a.nat } : { picked: [], nat: "" });
  };

  const submit = () => {
    const next = { ...done, [q.id]: { ...draft, time: tick } };
    setDone(next);
    record(next);
  };

  const finish = () => {
    const a = record(done);
    window.history.replaceState(null, "", `?review=${a.id}`);
    setAttempt(a);
    setPhase("result");
    window.scrollTo(0, 0);
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
          setDone({});
          setAttemptId(Date.now().toString(36));
          setStartedAt(Date.now());
          setAttempt(null);
          go(0);
          setPhase("test");
        }}
      />
    );

  const mark = answered ? markQuestion(q, answered) : null;
  const canSubmit = q.type === "NAT" ? draft.nat.trim() !== "" : draft.picked.length > 0;
  const allDone = questions.every((qq) => done[qq.id]);
  const pick = (label: string) =>
    !answered &&
    setDraft((d) => ({ ...d, picked: q.type === "MCQ" ? [label] : d.picked.includes(label) ? d.picked.filter((l) => l !== label) : [...d.picked, label].sort() }));

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[#f7f7f7] text-[#111] dark:bg-background dark:text-foreground">
      <div className="mx-auto max-w-[1100px] px-3 pb-10 pt-6 sm:px-8 sm:pt-9">
        <header className="flex items-center justify-between rounded-[40px] bg-white px-7 py-4 sm:px-12 sm:py-5 dark:bg-surface">
          <Link href="/jameco/mock" aria-label="All mock tests">
            <Wordmark />
          </Link>
          <Link href="/jameco/mock" className="text-[17px] text-[#111] hover:underline sm:text-[19px] dark:text-foreground">
            Exit Exam
          </Link>
        </header>

        <main className="mt-6 min-h-[75vh] rounded-t-[40px] bg-white px-5 py-7 sm:mt-9 sm:px-12 sm:py-10 dark:bg-surface">
          <div className="flex flex-col-reverse gap-4 border-b border-[#eee] pb-6 sm:flex-row sm:items-center sm:justify-between dark:border-border">
            <div className="flex flex-wrap gap-3 sm:gap-3.5">
              {questions.map((qq, i) => {
                const m = done[qq.id] ? markQuestion(qq, done[qq.id]).result : null;
                return (
                  <button
                    key={qq.id}
                    type="button"
                    onClick={() => go(i)}
                    aria-current={i === idx}
                    className={`size-[38px] rounded-[10px] border text-[16px] transition ${
                      m === "wrong" ? "border-red-300 bg-red-50 text-red-700" : m ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-[#e2e2e2] bg-white text-[#111] dark:bg-surface dark:text-foreground"
                    } ${i === idx ? "!border-[#111] dark:!border-foreground" : ""}`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>
            <p className="shrink-0 text-[17px] text-[#9aa1ad] sm:text-[19px]">
              {test.unit} &gt; {test.topic}
            </p>
          </div>

          <div className="mt-6 flex items-center justify-between text-[17px] text-[#9aa1ad] sm:text-[19px]">
            <span>
              Question {idx + 1}/{questions.length}:
              <span className="block text-[13px] sm:ml-2 sm:inline">
                JAM {q.year} · {q.type} · {q.marks} mark{q.marks > 1 ? "s" : ""}
              </span>
            </span>
            <span className="font-mono text-[18px] font-bold tabular-nums text-[#111] dark:text-foreground">{clock(answered ? answered.time : tick)}</span>
          </div>

          <div className="mt-5 text-[18px] leading-relaxed sm:text-[19px] [&_.nt-root]:!bg-transparent [&_.nt-root]:![font-size:inherit] [&_.nt-root]:![color:inherit] [&_.pyq-solution]:![font-size:inherit] [&_.pyq-solution]:![color:inherit]">
            <SolutionMarkdown key={`t-${q.id}`} content={q.stem} />
          </div>

          {q.type === "NAT" ? (
            <input
              value={draft.nat}
              onChange={(e) => !answered && /^-?\d*\.?\d*$/.test(e.target.value) && setDraft({ ...draft, nat: e.target.value })}
              readOnly={!!answered}
              inputMode="decimal"
              placeholder="Your answer"
              aria-label="Numerical answer"
              className="mt-5 h-11 w-56 rounded-xl border border-[#ddd] bg-white px-3 text-[18px] text-[#111] focus:border-[#111] focus:outline-none"
            />
          ) : (
            <div className="mt-5 space-y-3">
              {q.type === "MSQ" && <p className="text-sm text-[#9aa1ad]">Select all correct options.</p>}
              {q.options.map((o) => {
                const right = answered && (q.key === "all" || q.key.split(",").includes(o.label));
                const wrongPick = answered && !right && answered.picked.includes(o.label);
                return (
                  <label
                    key={o.label}
                    className={`flex cursor-pointer items-center gap-3 rounded-lg py-1.5 text-[18px] sm:text-[19px] ${right ? "text-emerald-700" : wrongPick ? "text-red-600" : ""}`}
                  >
                    <input
                      type={q.type === "MCQ" ? "radio" : "checkbox"}
                      name={`topic-${q.id}`}
                      checked={draft.picked.includes(o.label)}
                      onChange={() => pick(o.label)}
                      disabled={!!answered}
                      className="size-[18px] shrink-0 accent-[#111]"
                    />
                    <span className="min-w-0 flex-1 [&_.nt-root]:!bg-transparent [&_.nt-root]:![font-size:inherit] [&_.nt-root]:![color:inherit] [&_.pyq-solution]:![font-size:inherit] [&_.pyq-solution]:![color:inherit] [&_.pyq-solution_p]:!my-0">
                      <SolutionMarkdown content={o.text} />
                    </span>
                    {right && <CheckCircle size={20} weight="fill" className="shrink-0" />}
                    {wrongPick && <XCircle size={20} weight="fill" className="shrink-0" />}
                  </label>
                );
              })}
            </div>
          )}

          {!answered ? (
            <button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              className="mt-7 h-[52px] rounded-full bg-[#f5f5f5] px-12 text-[18px] text-[#111] transition hover:bg-[#ebebeb] disabled:opacity-60 dark:bg-surface-muted dark:text-foreground"
            >
              Submit
            </button>
          ) : (
            <div className="mt-7 space-y-5">
              <p className={`flex items-center gap-2 text-[17px] font-medium ${mark?.result === "wrong" ? "text-red-600" : "text-emerald-700"}`}>
                {mark?.result === "wrong" ? <XCircle size={22} weight="fill" /> : <CheckCircle size={22} weight="fill" />}
                {mark?.result === "wrong" ? "Incorrect" : mark?.result === "bonus" ? "Marks to all" : "Correct"} · Answer: {keyLabel(q)}
              </p>
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={() => setShowSolution((v) => !v)} className="h-[48px] rounded-full bg-[#f5f5f5] px-8 text-[17px] hover:bg-[#ebebeb] dark:bg-surface-muted">
                  {showSolution ? "Hide solution" : "View solution"}
                </button>
                {idx < questions.length - 1 && (
                  <button type="button" onClick={() => go(idx + 1)} className="h-[48px] rounded-full bg-[#111] px-8 text-[17px] text-white hover:opacity-90 dark:bg-foreground dark:text-background">
                    Next question
                  </button>
                )}
                {allDone && (
                  <button type="button" onClick={finish} className="h-[48px] rounded-full bg-[#e8743b] px-8 text-[17px] text-white hover:opacity-90">
                    See result
                  </button>
                )}
              </div>
              {showSolution && (
                <div className="rounded-3xl bg-[#fafafa] p-5 sm:p-7 dark:bg-surface-muted [&_.nt-root]:!bg-transparent">
                  <SolutionMarkdown key={`s-${q.id}`} content={q.solution} />
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
