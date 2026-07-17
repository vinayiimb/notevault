import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSubjectAction,
  createTermAction,
  deleteSubjectAction,
  deleteTermAction,
} from "@/lib/actions";
import { levelLabel } from "@/lib/utils";

export default async function AdminProgramDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const program = await prisma.program.findUnique({
    where: { id },
    include: {
      terms: { orderBy: { order: "asc" }, include: { subjects: { orderBy: { name: "asc" } } } },
    },
  });
  if (!program) notFound();

  return (
    <div className="p-8">
      <p className="text-sm text-muted">{levelLabel(program.level)}</p>
      <h1 className="text-2xl font-semibold">{program.name}</h1>

      <form
        action={createTermAction}
        className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-surface p-4 sm:flex-row sm:items-end"
      >
        <input type="hidden" name="programId" value={program.id} />
        <div className="flex flex-1 flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Term name</label>
          <input
            name="name"
            required
            placeholder="e.g. Semester 3"
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium text-muted">Order</label>
          <input
            name="order"
            type="number"
            defaultValue={program.terms.length + 1}
            className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-accent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-foreground transition hover:opacity-90"
        >
          Add term
        </button>
      </form>

      <div className="mt-8 flex flex-col gap-6">
        {program.terms.map((term) => (
          <div key={term.id} className="rounded-xl border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{term.name}</h2>
              <form action={deleteTermAction}>
                <input type="hidden" name="id" value={term.id} />
                <input type="hidden" name="programId" value={program.id} />
                <button type="submit" className="text-sm text-red-500 hover:underline">
                  Delete term
                </button>
              </form>
            </div>

            <ul className="mt-3 flex flex-col divide-y divide-border">
              {term.subjects.map((subject) => (
                <li key={subject.id} className="flex items-center justify-between gap-4 py-2">
                  <Link href={`/admin/subjects/${subject.id}`} className="text-sm hover:text-accent">
                    {subject.name}
                  </Link>
                  <form action={deleteSubjectAction}>
                    <input type="hidden" name="id" value={subject.id} />
                    <input type="hidden" name="programId" value={program.id} />
                    <button type="submit" className="text-xs text-red-500 hover:underline">
                      Delete
                    </button>
                  </form>
                </li>
              ))}
              {term.subjects.length === 0 && (
                <li className="py-2 text-sm text-muted">No subjects yet.</li>
              )}
            </ul>

            <form action={createSubjectAction} className="mt-3 flex gap-2">
              <input type="hidden" name="termId" value={term.id} />
              <input type="hidden" name="programId" value={program.id} />
              <input
                name="name"
                required
                placeholder="New subject name"
                className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg border border-border px-3 py-1.5 text-sm transition hover:bg-surface-muted"
              >
                Add subject
              </button>
            </form>
          </div>
        ))}
        {program.terms.length === 0 && (
          <p className="text-sm text-muted">Add a term to start adding subjects.</p>
        )}
      </div>
    </div>
  );
}
