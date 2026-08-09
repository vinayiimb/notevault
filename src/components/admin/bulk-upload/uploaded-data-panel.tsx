import Link from "next/link";
import { prisma } from "@/lib/prisma";
import type { BulkUploadRowStatus, Prisma, ResourceType } from "@/generated/prisma";

const PAGE_SIZE = 50;

const STATUS_LABEL: Record<BulkUploadRowStatus, string> = {
  VALID: "Valid",
  IMPORTED: "Imported",
  SKIPPED: "Skipped",
  DUPLICATE: "Duplicate",
  UNMATCHED_SUBJECT: "Unmatched subject",
  UNMATCHED_COURSE: "Unmatched course",
  INVALID: "Invalid",
};

const STATUS_TONE: Record<BulkUploadRowStatus, string> = {
  VALID: "text-emerald-600",
  IMPORTED: "text-emerald-600",
  SKIPPED: "text-muted",
  DUPLICATE: "text-amber-600",
  UNMATCHED_SUBJECT: "text-red-500",
  UNMATCHED_COURSE: "text-red-500",
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
  programId?: string;
  termId?: string;
  resourceType?: ResourceType;
  status?: BulkUploadRowStatus;
  batchId?: string;
  year?: string;
  q?: string;
  page?: string;
};

function buildWhere(filters: UploadedDataFilters, includeStatus: boolean): Prisma.BulkUploadRowWhereInput {
  const where: Prisma.BulkUploadRowWhereInput = {};
  if (filters.programId) where.programId = filters.programId;
  if (filters.termId) where.termId = filters.termId;
  if (filters.batchId) where.batchId = filters.batchId;
  if (filters.year) where.yearRaw = { contains: filters.year };
  if (filters.resourceType) {
    // resourceTypeRaw is only stored when the sheet gave one explicitly —
    // a blank cell defaults to PYQ at import time (see resolveRowForImport
    // in src/lib/bulk-upload.ts), so an unset raw value still counts as PYQ.
    where.OR = [
      { resourceTypeRaw: { equals: filters.resourceType, mode: "insensitive" } },
      ...(filters.resourceType === "PYQ" ? [{ resourceTypeRaw: null }] : []),
    ];
  }
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

  const [programs, batches, summaryGroups, rows, totalCount] = await Promise.all([
    prisma.program.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
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
        subject: { select: { name: true } },
        batch: { select: { sourceFileName: true, createdAt: true } },
      },
    }),
    prisma.bulkUploadRow.count({ where: buildWhere(filters, true) }),
  ]);

  const terms = filters.programId
    ? await prisma.term.findMany({ where: { programId: filters.programId }, select: { id: true, name: true }, orderBy: { order: "asc" } })
    : [];

  const summary = Object.fromEntries(summaryGroups.map((g) => [g.status, g._count._all])) as Partial<
    Record<BulkUploadRowStatus, number>
  >;
  const totalRows = summaryGroups.reduce((sum, g) => sum + g._count._all, 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard label="Total rows" value={totalRows} />
        <StatCard label="Imported" value={summary.IMPORTED ?? 0} />
        <StatCard label="Unmatched" value={(summary.UNMATCHED_SUBJECT ?? 0) + (summary.UNMATCHED_COURSE ?? 0)} tone="warn" />
        <StatCard label="Duplicates" value={summary.DUPLICATE ?? 0} tone="warn" />
        <StatCard label="Invalid" value={summary.INVALID ?? 0} tone="warn" />
      </div>

      <form method="get" className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="tab" value="data" />
        <select name="programId" defaultValue={filters.programId ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All courses</option>
          {programs.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select name="termId" defaultValue={filters.termId ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All semesters</option>
          {terms.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select name="resourceType" defaultValue={filters.resourceType ?? ""} className="rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold">
          <option value="">All types</option>
          <option value="PYQ">PYQ</option>
          <option value="NOTES">Notes</option>
        </select>
        <input
          name="year"
          defaultValue={filters.year ?? ""}
          placeholder="Year"
          className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold"
        />
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
              <th className="px-3 py-2">Semester</th>
              <th className="px-3 py-2">Subject</th>
              <th className="px-3 py-2">Resource</th>
              <th className="px-3 py-2">Year</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Uploaded</th>
              <th className="px-3 py-2">Batch</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="px-3 py-2 text-foreground">{row.courseRaw || "—"}</td>
                <td className="px-3 py-2 text-foreground">{row.semesterRaw || "—"}</td>
                <td className="px-3 py-2 text-foreground">{row.subject?.name ?? row.subjectRaw ?? "—"}</td>
                <td className="max-w-[220px] truncate px-3 py-2 text-muted" title={row.fileNameRaw ?? undefined}>
                  {row.fileNameRaw || row.fileUrlRaw || "—"}
                </td>
                <td className="px-3 py-2 text-muted">{row.yearRaw || "—"}</td>
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
