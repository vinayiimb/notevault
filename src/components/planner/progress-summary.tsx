import Link from "next/link";
import type { SerializedPlan, SerializedTask } from "./planner-types";

function pct(done: number, total: number) {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

function countable(tasks: SerializedTask[]) {
  return tasks.filter((t) => t.status !== "RESCHEDULED");
}

export function ProgressSummary({ plan }: { plan: SerializedPlan }) {
  const tasks = countable(plan.tasks);
  const done = tasks.filter((t) => t.status === "DONE");
  const overallPct = pct(done.length, tasks.length);

  const byCategory = (types: SerializedTask["type"][]) => {
    const inCategory = tasks.filter((t) => types.includes(t.type));
    const doneInCategory = inCategory.filter((t) => t.status === "DONE");
    return { done: doneInCategory.length, total: inCategory.length, pct: pct(doneInCategory.length, inCategory.length) };
  };

  const syllabus = byCategory(["LEARN"]);
  const pyqs = byCategory(["SOLVE_PYQS", "PRACTICE", "ATTEMPT_PAPER"]);
  const revision = byCategory(["REVISE"]);
  const mock = byCategory(["MOCK_TEST"]);

  const subjectStats = plan.subjects.map((s) => {
    const subjectTasks = tasks.filter((t) => t.subjectId === s.subjectId);
    const subjectDone = subjectTasks.filter((t) => t.status === "DONE");
    return { ...s, done: subjectDone.length, total: subjectTasks.length, pct: pct(subjectDone.length, subjectTasks.length) };
  });

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <div
              className="grid size-28 shrink-0 place-items-center rounded-full p-2 shadow-inner"
              style={{ background: `conic-gradient(var(--brand) ${overallPct}%, var(--surface-muted) ${overallPct}% 100%)` }}
            >
              <div className="grid size-full place-items-center rounded-full bg-surface text-center shadow-sm">
                <span className="font-mono text-xl font-bold tabular-nums text-foreground">{overallPct}%</span>
              </div>
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-brand">Overall Preparation</span>
              <p className="mt-1 text-sm text-muted">
                {done.length} of {tasks.length} planned tasks completed.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Syllabus", stat: syllabus },
              { label: "PYQs", stat: pyqs },
              { label: "Revision", stat: revision },
              { label: "Mock Papers", stat: mock },
            ].map(({ label, stat }) => (
              <div key={label} className="rounded-xl border border-border/40 bg-surface-muted p-3">
                <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">{label}</span>
                <span className="mt-1 block text-lg font-bold text-foreground">
                  {label === "Mock Papers" ? `${stat.done}/${stat.total}` : `${stat.pct}%`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold uppercase tracking-wide text-muted">Subjects</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {subjectStats.map((s) => (
            <div key={s.subjectId} className="rounded-2xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-foreground">{s.subjectName}</h4>
                <span className="text-sm font-bold text-brand">{s.pct}% Ready</span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
                <div className="h-full rounded-full bg-brand" style={{ width: `${s.pct}%` }} />
              </div>
              <p className="mt-2 text-xs text-muted">
                {s.done}/{s.total} tasks · exam {new Date(s.examDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
              <Link href={`/subjects/${s.subjectId}`} className="mt-3 inline-block text-xs font-bold text-brand hover:underline">
                View Subject →
              </Link>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
