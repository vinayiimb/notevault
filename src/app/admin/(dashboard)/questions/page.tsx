export const dynamic = "force-static";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 100;

export default async function AdminQuestionsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const questions = await prisma.question.findMany({
    where: query ? { questionText: { contains: query, mode: "insensitive" } } : undefined,
    include: { subject: { include: { term: { include: { program: true } } } } },
    orderBy: { createdAt: "desc" },
    take: PAGE_SIZE,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Question bank</h1>
      <p className="mt-1 text-sm text-muted">
        Browse and edit individual PYQ questions — OCR review, topics, difficulty, and rich answer content
        blocks (LaTeX, tables, diagrams, charts, images, embedded PDFs, practice questions).
      </p>

      <form className="mt-5">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Search question text…"
          className="w-full max-w-md rounded-lg border border-border bg-surface px-3 py-2 text-sm focus:border-accent focus:outline-none"
        />
      </form>

      <ul className="mt-5 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
        {questions.map((q) => (
          <li key={q.id}>
            <Link href={`/admin/questions/${q.id}`} className="flex items-start justify-between gap-4 p-3 transition hover:bg-surface-muted">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{q.questionText}</p>
                <p className="mt-1 text-xs text-muted">
                  {q.subject.term.program.name} · {q.subject.name}
                  {q.questionNumber ? ` · Q${q.questionNumber}` : ""}
                  {q.difficulty ? ` · ${q.difficulty.toLowerCase()}` : ""}
                </p>
              </div>
              {q.isRepeated && (
                <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs text-accent">
                  repeated ×{q.repeatCount}
                </span>
              )}
            </Link>
          </li>
        ))}
        {questions.length === 0 && <li className="p-3 text-sm text-muted">No questions found.</li>}
      </ul>
      {questions.length === PAGE_SIZE && (
        <p className="mt-3 text-xs text-muted">Showing the {PAGE_SIZE} most recent matches — refine your search to narrow this down.</p>
      )}
    </div>
  );
}
