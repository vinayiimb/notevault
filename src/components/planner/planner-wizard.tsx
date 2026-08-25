"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CaretLeft, CaretRight, CheckCircle } from "@phosphor-icons/react";
import { createPlanAction } from "@/lib/planner-actions";
import type { PlanStrategy, PrepLevel, TargetLevel, WizardProgram } from "./planner-types";

interface PlannerWizardProps {
  programs: WizardProgram[];
  onCancel: () => void;
}

type SubjectSelection = {
  included: boolean;
  examDate: string;
  examTime: string;
  preparationLevel: PrepLevel;
  targetLevel: TargetLevel;
};

const PREP_LEVELS: PrepLevel[] = ["NOT_STARTED", "BASIC", "AVERAGE", "STRONG"];
const PREP_LABEL: Record<PrepLevel, string> = { NOT_STARTED: "Not Started", BASIC: "Basic", AVERAGE: "Average", STRONG: "Strong" };
const TARGET_LEVELS: TargetLevel[] = ["PASS", "GOOD_SCORE", "TOP_SCORE"];
const TARGET_LABEL: Record<TargetLevel, string> = { PASS: "Pass", GOOD_SCORE: "Good Score", TOP_SCORE: "Top Score" };

const WEEKDAY_OPTIONS = [1, 2, 3, 4];
const WEEKEND_OPTIONS = [2, 4, 6];
const TIME_OF_DAY = ["morning", "afternoon", "evening", "night"] as const;
const DAY_TOGGLES: { code: string; label: string }[] = [
  { code: "mon", label: "M" },
  { code: "tue", label: "T" },
  { code: "wed", label: "W" },
  { code: "thu", label: "T" },
  { code: "fri", label: "F" },
  { code: "sat", label: "S" },
  { code: "sun", label: "S" },
];

const STRATEGIES: { key: PlanStrategy; label: string; description: string }[] = [
  { key: "SMART_DU", label: "Smart DU Mode", description: "Exam proximity + PYQ frequency + weak topics + unfinished work — recommended" },
  { key: "BALANCED", label: "Balanced preparation", description: "Even split across syllabus, PYQs, and revision" },
  { key: "PYQ_FOCUSED", label: "PYQ-focused", description: "Weighs previous-year questions most heavily" },
  { key: "SYLLABUS_FIRST", label: "Complete syllabus first", description: "Prioritizes finishing concepts before drilling PYQs" },
  { key: "WEAK_TOPICS_FIRST", label: "Weak topics first", description: "Puts your self-rated weak subjects first" },
  { key: "LAST_MINUTE", label: "Last-minute exam mode", description: "Front-loads exam proximity — for when time is short" },
];

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function StepPill({ n, active, done }: { n: number; active: boolean; done: boolean }) {
  return (
    <div
      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
        done ? "bg-brand text-brand-foreground" : active ? "border-2 border-brand text-brand" : "border border-border text-muted"
      }`}
    >
      {done ? <CheckCircle size={16} weight="bold" /> : n}
    </div>
  );
}

export function PlannerWizard({ programs, onCancel }: PlannerWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  const [programId, setProgramId] = useState(programs[0]?.id ?? "");
  const program = programs.find((p) => p.id === programId) ?? programs[0];
  const [termId, setTermId] = useState(program?.terms[0]?.id ?? "");
  const term = program?.terms.find((t) => t.id === termId) ?? program?.terms[0];

  const [subjectState, setSubjectState] = useState<Record<string, SubjectSelection>>({});

  const [hoursWeekday, setHoursWeekday] = useState(2);
  const [hoursWeekdayCustom, setHoursWeekdayCustom] = useState(false);
  const [hoursWeekend, setHoursWeekend] = useState(4);
  const [hoursWeekendCustom, setHoursWeekendCustom] = useState(false);
  const [preferredTimes, setPreferredTimes] = useState<string[]>([]);
  const [studyDays, setStudyDays] = useState<string[]>(DAY_TOGGLES.map((d) => d.code));
  const [strategy, setStrategy] = useState<PlanStrategy>("SMART_DU");

  const selectedSubjects = useMemo(
    () => (term?.subjects ?? []).filter((s) => subjectState[s.id]?.included),
    [term, subjectState]
  );

  function selectSubject(id: string, patch: Partial<SubjectSelection>) {
    setSubjectState((prev) => ({
      ...prev,
      [id]: {
        included: prev[id]?.included ?? false,
        examDate: prev[id]?.examDate ?? todayIso(),
        examTime: prev[id]?.examTime ?? "",
        preparationLevel: prev[id]?.preparationLevel ?? "BASIC",
        targetLevel: prev[id]?.targetLevel ?? "GOOD_SCORE",
        ...patch,
      },
    }));
  }

  function toggleDay(code: string) {
    setStudyDays((prev) => (prev.includes(code) ? prev.filter((d) => d !== code) : [...prev, code]));
  }

  function toggleTime(t: string) {
    setPreferredTimes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  const canProceedStep1 = Boolean(programId && termId);
  const canProceedStep2 = selectedSubjects.length > 0;
  const canProceedStep3 = hoursWeekday > 0 && hoursWeekend > 0 && studyDays.length > 0;

  function generate() {
    setError(null);
    startTransition(async () => {
      try {
        await createPlanAction({
          programId,
          termId,
          hoursWeekday,
          hoursWeekend,
          preferredTimes,
          studyDays,
          strategy,
          subjects: selectedSubjects.map((s) => ({
            subjectId: s.id,
            examDate: subjectState[s.id].examDate,
            examTime: subjectState[s.id].examTime || null,
            preparationLevel: subjectState[s.id].preparationLevel,
            targetLevel: subjectState[s.id].targetLevel,
          })),
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Couldn't generate your plan. Try again.");
      }
    });
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((n) => (
          <div key={n} className="flex items-center gap-2">
            <StepPill n={n} active={step === n} done={step > n} />
            {n < 4 && <div className={`h-px w-8 ${step > n ? "bg-brand" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-surface p-6 sm:p-8">
        {step === 1 && (
          <div>
            <h2 className="text-lg font-bold text-foreground">Select Course</h2>
            <p className="mt-1 text-sm text-muted">We&apos;ll load the subjects for your programme and semester.</p>

            <div className="mt-5 space-y-4">
              <div>
                <label className="text-xs font-bold text-muted">Programme</label>
                <select
                  value={programId}
                  onChange={(e) => {
                    setProgramId(e.target.value);
                    const next = programs.find((p) => p.id === e.target.value);
                    setTermId(next?.terms[0]?.id ?? "");
                  }}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-muted">Semester</label>
                <select
                  value={termId}
                  onChange={(e) => setTermId(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-accent"
                >
                  {program?.terms.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 className="text-lg font-bold text-foreground">Select Subjects</h2>
            <p className="mt-1 text-sm text-muted">Pick the subjects to plan for, their exam date, and where you stand.</p>

            <div className="mt-5 space-y-3">
              {(term?.subjects ?? []).map((s) => {
                const sel = subjectState[s.id];
                const included = sel?.included ?? false;
                return (
                  <div key={s.id} className={`rounded-xl border p-4 ${included ? "border-brand bg-brand-soft/20" : "border-border"}`}>
                    <label className="flex items-center gap-2.5 font-bold text-foreground">
                      <input
                        type="checkbox"
                        checked={included}
                        onChange={(e) => selectSubject(s.id, { included: e.target.checked })}
                        className="size-4 accent-[var(--brand)]"
                      />
                      {s.name}
                    </label>

                    {included && (
                      <div className="mt-3 space-y-3 pl-6.5">
                        <div>
                          <label className="text-xs font-bold text-muted">Exam date</label>
                          <input
                            type="date"
                            value={sel.examDate}
                            onChange={(e) => selectSubject(s.id, { examDate: e.target.value })}
                            className="mt-1 block rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-accent"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted">Preparation level</label>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {PREP_LEVELS.map((p) => (
                              <button
                                key={p}
                                type="button"
                                onClick={() => selectSubject(s.id, { preparationLevel: p })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                                  sel.preparationLevel === p ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-surface-muted"
                                }`}
                              >
                                {PREP_LABEL[p]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-muted">Target</label>
                          <div className="mt-1 flex flex-wrap gap-2">
                            {TARGET_LEVELS.map((t) => (
                              <button
                                key={t}
                                type="button"
                                onClick={() => selectSubject(s.id, { targetLevel: t })}
                                className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                                  sel.targetLevel === t ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-surface-muted"
                                }`}
                              >
                                {TARGET_LABEL[t]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              {(term?.subjects ?? []).length === 0 && (
                <p className="text-sm text-muted">No subjects found for this programme/semester yet.</p>
              )}
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h2 className="text-lg font-bold text-foreground">How much can you study?</h2>

            <div className="mt-5 space-y-5">
              <div>
                <label className="text-xs font-bold text-muted">Weekdays</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {WEEKDAY_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setHoursWeekday(h);
                        setHoursWeekdayCustom(false);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        !hoursWeekdayCustom && hoursWeekday === h ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-surface-muted"
                      }`}
                    >
                      {h} hr
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHoursWeekdayCustom(true)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${hoursWeekdayCustom ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-surface-muted"}`}
                  >
                    Custom
                  </button>
                  {hoursWeekdayCustom && (
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={hoursWeekday}
                      onChange={(e) => setHoursWeekday(Number(e.target.value))}
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted">Weekends</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {WEEKEND_OPTIONS.map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        setHoursWeekend(h);
                        setHoursWeekendCustom(false);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${
                        !hoursWeekendCustom && hoursWeekend === h ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-surface-muted"
                      }`}
                    >
                      {h} hr
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setHoursWeekendCustom(true)}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-bold ${hoursWeekendCustom ? "border-brand bg-brand text-brand-foreground" : "border-border text-muted hover:bg-surface-muted"}`}
                  >
                    Custom
                  </button>
                  {hoursWeekendCustom && (
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={hoursWeekend}
                      onChange={(e) => setHoursWeekend(Number(e.target.value))}
                      className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-accent"
                    />
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted">Preferred study time</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {TIME_OF_DAY.map((t) => (
                    <label
                      key={t}
                      className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-bold capitalize ${
                        preferredTimes.includes(t) ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:bg-surface-muted"
                      }`}
                    >
                      <input type="checkbox" checked={preferredTimes.includes(t)} onChange={() => toggleTime(t)} className="sr-only" />
                      {t}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted">Study days</label>
                <div className="mt-1.5 flex gap-1.5">
                  {DAY_TOGGLES.map((d, i) => (
                    <button
                      key={`${d.code}-${i}`}
                      type="button"
                      onClick={() => toggleDay(d.code)}
                      className={`flex size-9 items-center justify-center rounded-full text-xs font-bold ${
                        studyDays.includes(d.code) ? "bg-brand text-brand-foreground" : "border border-border text-muted hover:bg-surface-muted"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h2 className="text-lg font-bold text-foreground">What should we prioritize?</h2>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {STRATEGIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setStrategy(s.key)}
                  className={`rounded-xl border p-4 text-left transition ${
                    strategy === s.key ? "border-brand bg-brand-soft/30" : "border-border hover:bg-surface-muted"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-foreground">{s.label}</span>
                    {s.key === "SMART_DU" && (
                      <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-brand-foreground">Recommended</span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted">{s.description}</p>
                </button>
              ))}
            </div>
            {error && <p className="mt-4 text-sm font-semibold text-red-500">{error}</p>}
          </div>
        )}

        <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
          <button
            type="button"
            onClick={() => (step === 1 ? onCancel() : setStep((s) => s - 1))}
            className="flex items-center gap-1 text-sm font-bold text-muted hover:text-foreground"
          >
            <CaretLeft size={14} weight="bold" />
            {step === 1 ? "Cancel" : "Back"}
          </button>

          {step < 4 ? (
            <button
              type="button"
              disabled={(step === 1 && !canProceedStep1) || (step === 2 && !canProceedStep2) || (step === 3 && !canProceedStep3)}
              onClick={() => setStep((s) => s + 1)}
              className="flex items-center gap-1 rounded-lg bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-40"
            >
              Next
              <CaretRight size={14} weight="bold" />
            </button>
          ) : (
            <button
              type="button"
              disabled={isPending}
              onClick={generate}
              className="rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {isPending ? "Generating…" : "Generate My Plan"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
