import { prisma } from "@/lib/prisma";
import { FailedUploadsClient } from "@/components/failed-uploads/failed-uploads-client";
import { CopyableTitleList } from "@/components/failed-uploads/copyable-title-list";
import { CsvDeploy } from "@/components/failed-uploads/csv-deploy";

export default async function FailedUploadsPage() {
  const [rows, existingHashes, programs] = await Promise.all([
    prisma.failedUpload.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.resource.findMany({ where: { fileHash: { not: null } }, select: { fileHash: true } }),
    prisma.program.findMany({
      orderBy: { name: "asc" },
      include: {
        terms: {
          orderBy: { order: "asc" },
          include: { subjects: { orderBy: { name: "asc" }, select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const hashSet = new Set(existingHashes.map((r) => r.fileHash));
  const data = rows.map((r) => ({
    id: r.id,
    fileName: r.fileName,
    title: r.title,
    type: r.type,
    year: r.year,
    reason: r.reason,
    fileUrl: r.fileUrl,
    fileSize: r.fileSize,
    createdAt: r.createdAt.toLocaleString(),
    isDuplicate: r.fileHash ? hashSet.has(r.fileHash) : false,
  }));

  const programData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    level: p.level,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name, subjects: t.subjects })),
  }));

  const titles = [...new Set(rows.map((r) => r.title))].sort((a, b) => a.localeCompare(b));

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Failed uploads</h1>
      <p className="mt-1 text-sm text-muted">
        Papers that couldn&apos;t be uploaded — no subject match, or an upload error. The
        original file is kept here so nothing is lost; pick the right subject and hit
        &quot;Deploy&quot; to publish it directly, no need to re-upload the file.
      </p>

      <CopyableTitleList titles={titles} />
      <CsvDeploy />

      <FailedUploadsClient rows={data} programs={programData} />
    </div>
  );
}
