import { prisma } from "@/lib/prisma";
import { UnsortedSubjectsClient } from "@/components/unsorted/unsorted-subjects-client";

export default async function AdminUnsortedPage() {
  const holding = await prisma.program.findFirst({
    where: { name: "Unsorted (Pending Categorization)" },
    include: { terms: { include: { subjects: { orderBy: { name: "asc" } } } } },
  });

  const subjects = (holding?.terms.flatMap((t) => t.subjects) ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
  }));

  // Real courses only — excludes the holding pool itself as a destination.
  const programs = await prisma.program.findMany({
    where: { id: { not: holding?.id ?? "" } },
    orderBy: { name: "asc" },
    include: {
      terms: {
        orderBy: { order: "asc" },
        include: { subjects: { select: { id: true } } },
      },
    },
  });
  const programData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name })),
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Unsorted subjects</h1>
      <p className="mt-1 text-sm text-muted">
        {subjects.length} subject{subjects.length === 1 ? "" : "s"} imported from the master
        list, not yet assigned to a real course + semester. Search, select the ones you
        recognize, pick where they belong, and move them in one go.
      </p>

      <UnsortedSubjectsClient subjects={subjects} programs={programData} />
    </div>
  );
}
