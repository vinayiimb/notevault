import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { BulkUploadRowStatus, Prisma } from "@/generated/prisma";

const PAGE_SIZE = 50;

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

export type UploadedDataFilters = {
  course?: string;
  yearRange?: string;
  status?: BulkUploadRowStatus;
  batchId?: string;
  q?: string;
  page?: string;
};

function buildWhere(filters: UploadedDataFilters, includeStatus: boolean): Prisma.BulkUploadRowWhereInput {
  const where: Prisma.BulkUploadRowWhereInput = {};
  if (filters.course) where.courseRaw = filters.course;
  if (filters.yearRange) where.yearRangeRaw = filters.yearRange;
  if (filters.batchId) where.batchId = filters.batchId;
  if (filters.q) where.subjectRaw = { contains: filters.q, mode: "insensitive" };
  if (includeStatus && filters.status) where.status = filters.status;
  return where;
}

function qs(filters: UploadedDataFilters, overrides: Partial<UploadedDataFilters>) {
  const merged = { ...filters, ...overrides };
  const params = new URLSearchParams({ tab: "data" });
  for (const [key, value] of Object.entries(merged)) {
    if (value) params.set(key, value);
  }
  return `/admin/bulk-upload?${params.toString()}`;
}

export async function UploadedDataPanel({ filters }: { filters: UploadedDataFilters }) {
  const page = Math.max(1, Number(filters.page) || 1);

  const [courses, yearRanges, batches, summaryGroups, rows, totalCount] = await Promise.all([
    prisma.bulkUploadRow
      .findMany({ distinct: ["courseRaw"], select: { courseRaw: true }, orderBy: { courseRaw: "asc" } })
      .then((rs) => rs.map((r) => r.courseRaw).filter(Boolean)),
    prisma.bulkUploadRow
      .findMany({ distinct: ["yearRangeRaw"], select: { yearRangeRaw: true }, orderBy: { yearRangeRaw: "desc" } })
      .then((rs) => rs.map((r) => r.yearRangeRaw).filter((v): v is string => !!v)),
    prisma.uploadBatch.findMany({
      where: { sourceFileName: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, sourceFileName: true, createdAt: true },
    }),
    prisma.bulkUploadRow.groupBy({
      by: ["status"],
      where: buildWhere(filters, false),
      _count: { _all: true },
    }),
    prisma.bulkUploadRow.findMany({
      where: buildWhere(filters, true),
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        catalogPaperUpload: { select: { id: true } },
        batch: { select: { sourceFileName: true, createdAt: true } },
      },
    }),
    prisma.bulkUploadRow.count({ where: buildWhere(filters, true) }),
  ]);

  const summary = Object.fromEntries(summaryGroups.map((g) => [g.status, g._count._all])) as Partial<
    Record<BulkUploadRowStatus, number>
  >;
  const totalRows = summaryGroups.reduce((sum, g) => sum + g._count._all, 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Total rows" value={totalRows} />
        <StatCard label="Imported" value={summary.IMPORTED ?? 0} />
        <StatCard label="Duplicates" value={summary.DUPLICATE ?? 0} tone="warn" />
        <StatCard label="Invalid" value={summary.INVALID ?? 0} tone="warn" />
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="tab" value="data" />
        <select name="course" defaultValue={filters.course ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All courses</option>
          {courses.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select name="yearRange" defaultValue={filters.yearRange ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All year ranges</option>
          {yearRanges.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select name="batchId" defaultValue={filters.batchId ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.sourceFileName} — {b.createdAt.toLocaleDateString()}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={filters.status ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABEL) as BulkUploadRowStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </select>
        <input
          name="q"
          defaultValue={filters.q ?? ""}
          placeholder="Search subject…"
          className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
        />
        <button type="submit" className="rounded-lg bg-accent px-3 py-2 text-xs font-bold text-accent-foreground hover:bg-accent-hover">
          Filter
        </button>
        {Object.values(filters).some(Boolean) && (
          <Link href="/admin/bulk-upload?tab=data" className="text-xs font-medium text-muted underline-offset-2 hover:underline">
            Clear filters
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-xs">
          <thead className="bg-surface-muted text-muted">
            <tr>
              <th className="px-3 py-2">Course</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Year range</th>
              <th className="px-3 py-2">Semester</th>
              <th className="px-3 py-2">File</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2">Batch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-foreground">{row.courseRaw || "—"}</td>
                <td className="px-3 py-2 text-foreground">{row.subjectRaw || "—"}</td>
                <td className="px-3 py-2 text-muted">{row.yearRangeRaw || "—"}</td>
                <td className="px-3 py-2 text-muted">{row.semesterRaw || "—"}</td>
                <td className="max-w-[220px] truncate px-3 py-2 text-muted" title={row.fileNameRaw ?? undefined}>
                  {row.fileNameRaw || row.fileUrlRaw || "—"}
                </td>
                <td className={`px-3 py-2 font-semibold ${STATUS_TONE[row.status]}`}>{STATUS_LABEL[row.status]}</td>
                <td className="px-3 py-2 text-muted">{row.createdAt.toLocaleDateString()}</td>
                <td className="px-3 py-2">
                  <Link href={`/admin/bulk-upload/${row.batchId}`} className="text-accent underline-offset-2 hover:underline">
                    {row.batch.sourceFileName ?? "View batch"}
                  </Link>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted">
                  No uploaded rows match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-muted">
          <span>
            Page {page} of {totalPages} ({totalCount} rows)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link href={qs(filters, { page: String(page - 1) })} className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-surface-muted">
                Previous
              </Link>
            )}
            {page < totalPages && (
              <Link href={qs(filters, { page: String(page + 1) })} className="rounded-lg border border-border px-3 py-1.5 font-semibold hover:bg-surface-muted">
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
