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
import { TermPapersSection } from "@/components/admin/term-papers-section";

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
  const termPapers = await prisma.termPaper.findMany({
    where: { term: { programId: id } },
  });
  if (!program) notFound();

  return (
    <div className="p-8">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted">{levelLabel(program.level)}</p>
          <h1 className="mt-2 text-3xl font-semibold">{program.name}</h1>
        </div>
      </div>

      <form
        action={createTermAction}
        className="mt-8 rounded-2xl border border-accent/20 bg-gradient-to-br from-accent/5 to-transparent p-6"
      >
        <input type="hidden" name="programId" value={program.id} />
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-foreground">Add New Semester</h3>
          <p className="mt-1 text-sm text-muted">Create a new semester for this program</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Semester Name</label>
            <input
              name="name"
              required
              placeholder="e.g. Semester 3"
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-muted uppercase tracking-wide">Order</label>
            <input
              name="order"
              type="number"
              defaultValue={program.terms.length + 1}
              className="rounded-lg border border-border bg-background px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-r from-accent to-accent/80 px-6 py-2.5 text-sm font-semibold text-accent-foreground transition hover:shadow-lg hover:shadow-accent/20 active:scale-95"
          >
            + Add Semester
          </button>
        </div>
      </form>

      {program.terms.length > 0 && (
        <div className="mt-8">
          <TermPapersSection terms={program.terms} papers={termPapers} />
        </div>
      )}

      <div className="mt-10 space-y-6">
        <h2 className="text-lg font-semibold text-foreground">Semesters & Subjects</h2>
        {program.terms.map((term) => (
          <div key={term.id} className="rounded-2xl border border-border bg-gradient-to-br from-surface via-surface to-surface-muted/20 p-5 hover:shadow-md transition">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">{term.name}</h3>
                <p className="mt-1 text-xs text-muted">{term.subjects.length} subject{term.subjects.length === 1 ? "" : "s"}</p>
              </div>
              <form action={deleteTermAction} className="inline shrink-0">
                <input type="hidden" name="id" value={term.id} />
                <input type="hidden" name="programId" value={program.id} />
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 rounded-lg transition border border-red-500/20 hover:border-red-500/50"
                  onClick={(e) => {
                    if (!confirm(`Delete entire semester "${term.name}"? This will also delete all ${term.subjects.length} subject${term.subjects.length === 1 ? "" : "s"}.`)) {
                      e.preventDefault();
                    }
                  }}
                >
                  🗑️ Delete Semester
                </button>
              </form>
            </div>

            <div className="space-y-2 mb-4">
              {term.subjects.length > 0 && (
                <div className="bg-background/50 rounded-lg p-3 space-y-2">
                  {term.subjects.map((subject) => (
                    <div key={subject.id} className="flex items-center justify-between gap-3 group">
                      <Link
                        href={`/admin/subjects/${subject.id}`}
                        className="flex-1 text-sm font-medium text-foreground hover:text-accent transition truncate"
                      >
                        📚 {subject.name}
                      </Link>
                      <form action={deleteSubjectAction} className="inline">
                        <input type="hidden" name="id" value={subject.id} />
                        <input type="hidden" name="programId" value={program.id} />
                        <button
                          type="submit"
                          className="text-xs text-red-500 opacity-0 group-hover:opacity-100 hover:text-red-600 transition font-medium"
                          onClick={(e) => {
                            if (!confirm(`Delete "${subject.name}"?`)) {
                              e.preventDefault();
                            }
                          }}
                        >
                          ✕ Remove
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              {term.subjects.length === 0 && (
                <div className="text-center py-3 text-sm text-muted">No subjects yet</div>
              )}
            </div>

            <form action={createSubjectAction} className="flex gap-2 mt-4 pt-4 border-t border-border/50">
              <input type="hidden" name="termId" value={term.id} />
              <input type="hidden" name="programId" value={program.id} />
              <input
                name="name"
                required
                placeholder="Add new subject..."
                className="flex-1 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent/20"
              />
              <button
                type="submit"
                className="rounded-lg bg-accent/20 text-accent hover:bg-accent/30 px-4 py-2 text-sm font-medium transition"
              >
                + Add
              </button>
            </form>
          </div>
        ))}
        {program.terms.length === 0 && (
          <div className="rounded-xl border-2 border-dashed border-border p-8 text-center">
            <p className="text-sm text-muted">No semesters yet. Create one above to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}
