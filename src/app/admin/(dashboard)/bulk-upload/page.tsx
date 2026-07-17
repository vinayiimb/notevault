import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { BulkUploadClient } from "@/components/bulk-upload/bulk-upload-client";

export default async function AdminBulkUploadPage() {
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

  const memoryRows = await prisma.subjectMatchMemory.findMany({
    select: { key: true, subjectId: true },
  });
  const memory = Object.fromEntries(memoryRows.map((r) => [r.key, r.subjectId]));

  const hashRows = await prisma.resource.findMany({
    where: { fileHash: { not: null } },
    select: { fileHash: true },
  });
  const existingHashes = hashRows.map((r) => r.fileHash as string);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Bulk upload</h1>
          <p className="mt-1 text-sm text-muted">
            Drop a .zip of PDFs (e.g. a year&apos;s worth of question papers). Each file
            gets matched to a subject automatically where the filename has a clear hint
            &mdash; fix, or create a new subject on the spot, then upload everything at
            once. Manual corrections are remembered for next time.
          </p>
        </div>
        <Link
          href="/admin/batches"
          className="shrink-0 rounded-lg border border-border px-4 py-2 text-sm font-medium transition hover:bg-surface-muted"
        >
          Past upload batches →
        </Link>
      </div>
      <div className="mt-6">
        <BulkUploadClient programs={data} memory={memory} existingHashes={existingHashes} />
      </div>
    </div>
  );
}
