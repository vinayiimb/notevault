import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function AdminBatchesPage() {
  const batches = await prisma.uploadBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { resources: true } } },
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Upload batches</h1>
      <p className="mt-1 text-sm text-muted">
        Every &quot;Upload N files&quot; click from Bulk Upload shows up here as one batch —
        open one to review or fix a mistake (wrong year, subject, etc.) without re-uploading.
      </p>

      {batches.length === 0 ? (
        <p className="mt-8 text-sm text-muted">No batches yet — upload something from Bulk Upload.</p>
      ) : (
        <div className="mt-6 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {batches.map((b) => (
            <Link
              key={b.id}
              href={`/admin/batches/${b.id}`}
              className="flex items-center justify-between gap-4 p-4 transition hover:bg-surface-muted"
            >
              <div>
                <p className="font-medium">{b.createdAt.toLocaleString()}</p>
                <p className="text-xs text-muted">{b._count.resources} file{b._count.resources === 1 ? "" : "s"}</p>
              </div>
              <span className="text-sm text-accent">Review →</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
