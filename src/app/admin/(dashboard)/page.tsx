import Link from "next/link";
import {
  ClockCounterClockwise,
  FileArchive,
  Gear,
  GraduationCap,
  WarningCircle,
} from "@phosphor-icons/react/dist/ssr";
import { getStats } from "@/lib/data";
import { prisma } from "@/lib/prisma";

export default async function AdminOverviewPage() {
  const [stats, failedCount, batchCount] = await Promise.all([
    getStats(),
    prisma.failedUpload.count(),
    prisma.uploadBatch.count(),
  ]);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Overview</h1>
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Programs" value={stats.programs} />
        <StatCard label="Subjects" value={stats.subjects} />
        <StatCard label="Files uploaded" value={stats.resources} />
        <StatCard label="Bank questions" value={stats.questions} />
      </div>

      <h2 className="mt-10 text-sm font-semibold uppercase tracking-wide text-muted">
        Quick actions
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ActionCard
          href="/admin/programs"
          icon={<GraduationCap size={20} weight="bold" />}
          title="Manage programs"
          description="Edit programs, semesters, and subjects."
        />
        <ActionCard
          href="/admin/bulk-upload"
          icon={<FileArchive size={20} weight="bold" />}
          title="Bulk upload"
          description="Upload a batch of PDFs from a zip file."
        />
        <ActionCard
          href="/admin/batches"
          icon={<ClockCounterClockwise size={20} weight="bold" />}
          title="Upload batches"
          description={`Review or fix a past upload.${batchCount > 0 ? ` ${batchCount} batch${batchCount === 1 ? "" : "es"} so far.` : ""}`}
        />
        <ActionCard
          href="/admin/failed-uploads"
          icon={<WarningCircle size={20} weight="bold" />}
          title="Failed uploads"
          description={
            failedCount > 0
              ? `${failedCount} file${failedCount === 1 ? "" : "s"} waiting to be fixed.`
              : "Nothing waiting — all clear."
          }
          badge={failedCount > 0 ? failedCount : undefined}
        />
        <ActionCard
          href="/admin/settings"
          icon={<Gear size={20} weight="bold" />}
          title="Site settings"
          description="Homepage text, hero image, currency icon."
        />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-2 font-mono text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ActionCard({
  href,
  icon,
  title,
  description,
  badge,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: number;
}) {
  return (
    <Link
      href={href}
      className="relative flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
    >
      {badge !== undefined && (
        <span className="absolute right-4 top-4 flex size-6 items-center justify-center rounded-full bg-red-500 text-xs font-semibold text-white">
          {badge}
        </span>
      )}
      <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
        {icon}
      </span>
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
    </Link>
  );
}
