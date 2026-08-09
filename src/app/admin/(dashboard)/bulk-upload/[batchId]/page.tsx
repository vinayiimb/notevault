import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "@phosphor-icons/react/dist/ssr";
import { prisma } from "@/lib/prisma";
import type { BulkUploadRowStatus } from "@/generated/prisma";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<BulkUploadRowStatus, string> = {
  VALID: "Valid",
  IMPORTED: "Imported",
  SKIPPED: "Skipped",
  DUPLICATE: "Duplicate",
  INVALID: "Invalid",
};

const STATUS_TONE: Record<BulkUploadRowStatus, string> = {
  VALID: "text-emerald-600",
  IMPORTED: "text-emerald-600",
  SKIPPED: "text-muted",
  DUPLICATE: "text-amber-600",
  INVALID: "text-red-500",
};

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "warn" && value > 0 ? "border-amber-500/40 bg-amber-500/5" : "border-border bg-surface"}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default async function BulkUploadBatchPage({ params }: { params: Promise<{ batchId: string }> }) {
  const { batchId } = await params;

  const batch = await prisma.uploadBatch.findUnique({
    where: { id: batchId },
    select: { id: true, sourceFileName: true, createdAt: true },
  });
  if (!batch) notFound();

  const [rows, summaryGroups] = await Promise.all([
    prisma.bulkUploadRow.findMany({
      where: { batchId },
      orderBy: { rowNumber: "asc" },
    }),
    prisma.bulkUploadRow.groupBy({ by: ["status"], where: { batchId }, _count: { _all: true } }),
  ]);

  const summary = Object.fromEntries(summaryGroups.map((g) => [g.status, g._count._all])) as Partial<
    Record<BulkUploadRowStatus, number>
  >;

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <Link
          href="/admin/bulk-upload?tab=data"
          className="flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to Uploaded Data
        </Link>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground">
          {batch.sourceFileName ?? "Bulk upload batch"}
        </h1>
        <p className="mt-1 text-sm text-muted">Uploaded {batch.createdAt.toLocaleString()} — {rows.length} rows</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {(Object.keys(STATUS_LABEL) as BulkUploadRowStatus[]).map((s) => (
          <StatCard key={s} label={STATUS_LABEL[s]} value={summary[s] ?? 0} tone={s === "VALID" || s === "IMPORTED" || s === "SKIPPED" ? undefined : "warn"} />
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted text-muted">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Year range</th>
              <th className="px-3 py-2">Semester</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Message</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-muted">{row.rowNumber}</td>
                <td className="px-3 py-2 text-foreground">{row.courseRaw || "—"}</td>
                <td className="px-3 py-2 text-foreground">{row.subjectRaw || "—"}</td>
                <td className="px-3 py-2 text-muted">{row.yearRangeRaw || "—"}</td>
                <td className="px-3 py-2 text-muted">{row.semesterRaw || "—"}</td>
                <td className="max-w-[240px] truncate px-3 py-2 text-muted" title={row.fileNameRaw ?? undefined}>
                  {row.fileNameRaw || row.fileUrlRaw || "—"}
                </td>
                <td className={`px-3 py-2 font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</td>
                <td className="px-3 py-2 text-muted">{row.message || "—"}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  This batch has no rows.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
