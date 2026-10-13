export const dynamic = "force-dynamic";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PyqAnalyserAdminClient } from "@/components/pyq-analyser/pyq-analyser-admin-client";

export default async function AdminPyqAnalyserPage() {
  // Question counts keyed by UPC, so the catalog picker can show which
  // subjects already have questions.
  const grouped = await prisma.question.groupBy({ by: ["subjectId"], _count: { _all: true } });
  const subjects = await prisma.subject.findMany({
    where: { id: { in: grouped.map((g) => g.subjectId) }, upc: { not: null } },
    select: { id: true, upc: true },
  });
  const upcOf = new Map(subjects.map((s) => [s.id, s.upc!]));
  const counts: Record<string, number> = {};
  for (const g of grouped) {
    const upc = upcOf.get(g.subjectId);
    if (upc) counts[upc] = (counts[upc] ?? 0) + g._count._all;
  }

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
        <PyqAnalyserAdminClient counts={counts} />
      </div>
    </div>
  );
}
