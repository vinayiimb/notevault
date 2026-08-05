"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarPlus, X } from "@phosphor-icons/react";
import { addExamDateAction, deleteExamDateAction, getExamDatesAction } from "@/lib/student-actions";

export interface ExamCountdownItem {
  id: string;
  subjectName: string;
  examDate: string; // ISO date string
  examTime: string | null;
}

interface ExamCountdownCardProps {
  subjects: Array<{ id: string; name: string }>;
}

function daysRemaining(iso: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function ExamCountdownCard({ subjects }: ExamCountdownCardProps) {
  // Personal per-student data — fetched client-side via server action since
  // the dashboard page itself is statically rendered and can't carry it.
  const [exams, setExams] = useState<ExamCountdownItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    getExamDatesAction().then((rows) => {
      setExams(rows);
      setLoaded(true);
      if (rows.length === 0) setFormOpen(true);
    });
  }, []);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const rows = await addExamDateAction(formData);
      setExams(rows);
      setFormOpen(false);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const formData = new FormData();
      formData.set("id", id);
      const rows = await deleteExamDateAction(formData);
      setExams(rows);
    });
  }

  if (!loaded) {
    return (
      <section className="space-y-4">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
          EXAM COUNTDOWN
        </h3>
        <div className="h-28 rounded-[16px] bg-white/60 dark:bg-[#1A1D24]/60 animate-pulse" />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase tracking-[0.06em] text-[#8C95A6] dark:text-gray-400">
          EXAM COUNTDOWN
        </h3>
        {exams.length > 0 && (
          <button
            type="button"
            onClick={() => setFormOpen((v) => !v)}
            className="text-xs font-bold text-[#3168FF] hover:underline"
          >
            {formOpen ? "Close" : "+ Add exam"}
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
        {exams.map((exam) => {
          const days = daysRemaining(exam.examDate);
          return (
            <div
              key={exam.id}
              className="group relative flex flex-col items-center justify-center rounded-[16px] bg-white dark:bg-[#1A1D24] py-7 px-3 text-center shadow-[0_2px_10px_rgba(0,0,0,0.025)] dark:shadow-none hover:shadow-[0_6px_18px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200"
            >
              <button
                type="button"
                onClick={() => remove(exam.id)}
                title="Remove"
                className="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full text-gray-300 opacity-0 hover:text-red-500 group-hover:opacity-100 transition-opacity"
              >
                <X size={12} weight="bold" />
              </button>
              <span
                className={`text-3xl font-extrabold ${
                  days <= 3 ? "text-[#FF4D4D]" : days <= 10 ? "text-[#FF7527]" : "text-[#3168FF]"
                }`}
              >
                {days >= 0 ? days : 0}
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {days === 0 ? "today" : days === 1 ? "day left" : "days left"}
              </span>
              <span className="mt-2 text-[13px] font-extrabold text-gray-800 dark:text-gray-200 line-clamp-2">
                {exam.subjectName}
              </span>
              <span className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                {new Date(exam.examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                {exam.examTime ? ` · ${exam.examTime}` : ""}
              </span>
            </div>
          );
        })}

        {exams.length > 0 && !formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-gray-200 dark:border-gray-700 py-7 px-3 text-center text-gray-400 hover:text-[#3168FF] hover:border-[#3168FF] transition-colors"
          >
            <CalendarPlus size={26} weight="bold" />
            <span className="text-[12px] font-bold">Add exam</span>
          </button>
        )}
      </div>

      {formOpen && (
        <form
          onSubmit={submit}
          className="flex flex-col gap-3 rounded-[16px] bg-white dark:bg-[#1A1D24] p-5 shadow-[0_2px_10px_rgba(0,0,0,0.025)] dark:shadow-none sm:flex-row sm:items-end"
        >
          <div className="flex-1 min-w-0">
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Subject</label>
            <input
              name="subjectName"
              list="exam-countdown-subjects"
              required
              placeholder="e.g. Financial Management"
              className="mt-1 w-full min-h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:border-[#3168FF] focus:outline-none"
            />
            <datalist id="exam-countdown-subjects">
              {subjects.map((s) => (
                <option key={s.id} value={s.name} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Date</label>
            <input
              name="examDate"
              type="date"
              required
              className="mt-1 w-full min-h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:border-[#3168FF] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Time (optional)</label>
            <input
              name="examTime"
              type="text"
              placeholder="9:30 AM"
              className="mt-1 w-full min-h-10 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 text-sm focus:border-[#3168FF] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-10 shrink-0 rounded-lg bg-[#3168FF] px-5 text-sm font-bold text-white hover:bg-[#2554d9] disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </form>
      )}
    </section>
  );
}
