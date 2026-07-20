import Link from "next/link";
import { ArrowsMerge, CheckCircle, MagnifyingGlass, WarningCircle } from "@phosphor-icons/react/dist/ssr";
import { mergeSubjectsAction } from "@/lib/actions";
import { prisma } from "@/lib/prisma";
import { findSubjectIssues } from "@/lib/subject-quality";

export default async function SubjectIssuesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view = "all" } = await searchParams;
  const subjects = await prisma.subject.findMany({
    where: { term: { program: { name: { not: "Unsorted (Pending Categorization)" } } } },
    include: {
      term: { include: { program: { select: { id: true, name: true } } } },
      _count: { select: { resources: true, questions: true } },
      notes: { select: { id: true } },
      analysis: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  const issues = findSubjectIssues(subjects);
  const exactCount = issues.filter((issue) => issue.kind === "duplicate").length;
  const similarCount = issues.filter((issue) => issue.kind === "similar").length;
  const visible = issues.filter((issue) => view === "all" || issue.kind === view);

  return (
    <main className="mx-auto max-w-6xl p-5 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Subject data quality</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted">
            Review likely duplicate subjects within the same course and semester. Nothing is merged automatically.
          </p>
        </div>
        <div className="flex gap-3 text-sm">
          <span className="rounded-lg bg-red-50 px-3 py-2 font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">{exactCount} duplicate</span>
          <span className="rounded-lg bg-yellow-50 px-3 py-2 font-semibold text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200">{similarCount} similar</span>
        </div>
      </div>

      <nav className="mt-7 flex gap-1 border-b border-border" aria-label="Issue filters">
        {[
          ["all", "All issues", issues.length],
          ["duplicate", "Duplicates", exactCount],
          ["similar", "Similar names", similarCount],
        ].map(([key, label, count]) => (
          <Link
            key={String(key)}
            href={`/admin/subject-issues?view=${key}`}
            aria-current={view === key ? "page" : undefined}
            className={`border-b-2 px-3 py-3 text-sm font-semibold ${view === key ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"}`}
          >
            {label} <span className="ml-1 font-mono text-xs">{count}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="mt-8 flex min-h-64 flex-col items-center justify-center rounded-xl border border-border bg-surface p-8 text-center">
          <CheckCircle size={30} weight="fill" className="text-success" />
          <h2 className="mt-3 font-semibold">No matching issues</h2>
          <p className="mt-1 text-sm text-muted">This part of the subject catalog looks clean.</p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-surface">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead className="bg-surface-muted/60 text-xs text-muted">
                <tr>
                  <th className="px-5 py-3 font-semibold">Issue</th>
                  <th className="px-4 py-3 font-semibold">Course / semester</th>
                  <th className="px-4 py-3 font-semibold">Suggested subject to keep</th>
                  <th className="px-4 py-3 font-semibold">Suggested subject to merge</th>
                  <th className="px-5 py-3 text-right font-semibold">Review</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {visible.map((issue) => (
                  <tr key={`${issue.left.id}-${issue.right.id}`} className="align-top hover:bg-surface-muted/35">
                    <td className="px-5 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${issue.kind === "duplicate" ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-yellow-50 text-yellow-800 dark:bg-yellow-950/30 dark:text-yellow-200"}`}>
                        <WarningCircle size={14} weight="fill" />
                        {issue.kind === "duplicate" ? "Duplicate" : `${Math.round(issue.confidence * 100)}% similar`}
                      </span>
                      <p className="mt-2 max-w-44 text-xs leading-5 text-muted">{issue.reason}</p>
                    </td>
                    <td className="px-4 py-4 text-muted">
                      <p className="font-medium text-foreground">{issue.left.term.program.name}</p>
                      <p className="mt-1 text-xs">{issue.left.term.name}</p>
                    </td>
                    <SubjectCell subject={issue.keep} label="Keep" />
                    <SubjectCell subject={issue.merge} label="Merge" />
                    <td className="px-5 py-4">
                      <div className="flex justify-end gap-2">
                        <Link href={`/admin/subjects/${issue.merge.id}`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:border-accent hover:text-accent">
                          <MagnifyingGlass size={14} weight="bold" /> Inspect
                        </Link>
                        <form action={mergeSubjectsAction}>
                          <input type="hidden" name="sourceId" value={issue.merge.id} />
                          <input type="hidden" name="targetId" value={issue.keep.id} />
                          <button type="submit" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-accent-foreground hover:bg-accent-hover">
                            <ArrowsMerge size={14} weight="bold" /> Merge
                          </button>
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="mt-4 text-xs leading-5 text-muted">The suggested survivor is the subject with more PDFs, questions, notes, or saved analysis. Inspect both before merging.</p>
    </main>
  );
}

function SubjectCell({ subject, label }: { subject: ReturnType<typeof findSubjectIssues>[number]["keep"]; label: string }) {
  return (
    <td className="px-4 py-4">
      <Link href={`/admin/subjects/${subject.id}`} className="font-semibold text-foreground hover:text-accent hover:underline">{subject.name}</Link>
      <p className="mt-1 text-xs text-muted">{label} · {subject._count.resources} files · {subject._count.questions} questions</p>
    </td>
  );
}
