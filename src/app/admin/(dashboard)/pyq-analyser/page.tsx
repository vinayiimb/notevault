export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PyqAnalyserAdminClient } from "@/components/pyq-analyser/pyq-analyser-admin-client";

export default async function AdminPyqAnalyserPage() {
  const [programs, counts] = await Promise.all([
    prisma.program.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        terms: {
          orderBy: { order: "asc" },
          select: { id: true, name: true, subjects: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
        },
      },
    }),
    prisma.question.groupBy({ by: ["subjectId"], _count: { _all: true } }),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">PYQ Analyser</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Upload a question paper (PDF or pasted text). AI splits it into questions and tags each with topics, marks and difficulty.
        Review, then save — questions already asked in an earlier year are merged and counted as repeats. Everything shows on{" "}
        <Link href="/papers/analyser" target="_blank" className="text-accent hover:underline">
          /papers/analyser
        </Link>
        . Edit or delete single questions in the{" "}
        <Link href="/admin/questions" className="text-accent hover:underline">
          Question bank
        </Link>
        .
      </p>
      <div className="mt-6">
        <PyqAnalyserAdminClient
          programs={programs}
          counts={Object.fromEntries(counts.map((c) => [c.subjectId, c._count._all]))}
        />
      </div>
    </div>
  );
}
