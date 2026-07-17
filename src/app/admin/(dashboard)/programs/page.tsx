import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createProgramAction, deleteProgramAction } from "@/lib/actions";
import { levelLabel } from "@/lib/utils";

export default async function AdminProgramsPage() {
  const programs = await prisma.program.findMany({
    include: { terms: { include: { subjects: true } } },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Programs</h1>

      <form
        action={createProgramAction}
        className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Name</label>
          <input
            name="name"
            required
            placeholder="e.g. B.Com (Hons)"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Level</label>
          <select
            name="level"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          >
            <option value="COLLEGE">College</option>
            <option value="SCHOOL">Class 12</option>
          </select>
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Summary (optional)</label>
          <input
            name="summary"
            placeholder="Short description"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Add program
        </button>
      </form>

      <ul className="mt-6 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {programs.map((program) => {
          const subjectCount = program.terms.reduce((n, t) => n + t.subjects.length, 0);
          return (
            <li key={program.id} className="flex items-center justify-between gap-4 p-4">
              <Link href={`/admin/programs/${program.id}`} className="min-w-0">
                <p className="font-medium">{program.name}</p>
                <p className="text-xs text-muted">
                  {levelLabel(program.level)} · {program.terms.length} terms · {subjectCount}{" "}
                  subjects
                </p>
              </Link>
              <form action={deleteProgramAction}>
                <input type="hidden" name="id" value={program.id} />
                <button type="submit" className="text-sm text-red-500 hover:underline">
                  Delete
                </button>
              </form>
            </li>
          );
        })}
        {programs.length === 0 && (
          <li className="p-4 text-sm text-muted">No programs yet. Add one above.</li>
        )}
      </ul>
    </div>
  );
}
