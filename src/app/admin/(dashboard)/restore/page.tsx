import { prisma } from "@/lib/prisma";
import { AdminRestoreClient } from "@/components/restore/admin-restore-client";

export default async function AdminRestorePage() {
  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: {
      terms: {
        orderBy: { order: "asc" },
        include: {
          subjects: {
            orderBy: { name: "asc" },
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  const data = programs.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    terms: p.terms.map((t) => ({
      id: t.id,
      name: t.name,
      subjects: t.subjects,
    })),
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Restore</h1>
      <p className="mt-1 text-sm text-muted">
        Upload a worn, scanned, or handwritten PDF, clean it up, then save it straight
        to a subject.
      </p>
      <div className="mt-6">
        <AdminRestoreClient programs={data} />
      </div>
    </div>
  );
}
