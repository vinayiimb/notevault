import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BatchDetailClient } from "@/components/batches/batch-detail-client";

export default async function AdminBatchDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const batch = await prisma.uploadBatch.findUnique({
    where: { id },
    include: {
      resources: {
        orderBy: { createdAt: "asc" },
        include: { subject: { select: { id: true, name: true } } },
      },
    },
  });
  if (!batch) notFound();

  const programs = await prisma.program.findMany({
    orderBy: { name: "asc" },
    include: {
      terms: {
        orderBy: { order: "asc" },
        include: { subjects: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
      },
    },
  });
  const programData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name, subjects: t.subjects })),
  }));

  const rows = batch.resources.map((r) => ({
    id: r.id,
    title: r.title,
    type: r.type,
    year: r.year,
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    fileUrl: r.fileUrl,
    fileName: r.fileName,
  }));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Batch — {batch.createdAt.toLocaleString()}</h1>
      <p className="mt-1 text-sm text-muted">
        {rows.length} file{rows.length === 1 ? "" : "s"} uploaded together. Fix any mistake below
        and hit Save — no re-upload needed.
      </p>

      <BatchDetailClient rows={rows} programs={programData} />
    </div>
  );
}
