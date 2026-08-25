import Link from "next/link";
import { FileArchive } from "@phosphor-icons/react/dist/ssr";
import { FreshUploadPanel } from "@/components/admin/bulk-upload/fresh-upload-panel";
import { UploadedDataPanel, type UploadedDataFilters } from "@/components/admin/bulk-upload/uploaded-data-panel";
import type { BulkUploadRowStatus } from "@prisma/client";

export const dynamic = "force-dynamic";
// Safety margin for validateBulkUploadAction/commitBulkUploadRowsAction on
// a large sheet — should rarely matter now that validate does one batched
// dedupe query instead of one per row, but a generous ceiling here is cheap
// insurance against the "unexpected response" failure mode a timeout causes.
export const maxDuration = 60;

type SearchParams = Record<string, string | string[] | undefined>;

function str(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return typeof value === "string" && value ? value : undefined;
}

export default async function BulkUploadPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const tab = str(params, "tab") === "data" ? "data" : "fresh";

  const filters: UploadedDataFilters = {
    course: str(params, "course"),
    yearRange: str(params, "yearRange"),
    status: str(params, "status") as BulkUploadRowStatus | undefined,
    batchId: str(params, "batchId"),
    q: str(params, "q"),
    page: str(params, "page"),
  };

  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <FileArchive size={20} weight="bold" />
          <span>Bulk Upload</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">Bulk Upload</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Import Full Archive catalog entries from a spreadsheet — one row per paper — and audit everything
          that&apos;s ever been imported this way.
        </p>
      </div>

      <div className="flex gap-2 border-b border-border">
        <Link
          href="/admin/bulk-upload?tab=fresh"
          className={`border-b-2 px-1 pb-3 text-sm font-bold transition ${
            tab === "fresh" ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Fresh Upload
        </Link>
        <Link
          href="/admin/bulk-upload?tab=data"
          className={`border-b-2 px-1 pb-3 text-sm font-bold transition ${
            tab === "data" ? "border-accent text-accent" : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Uploaded Data
        </Link>
      </div>

      {tab === "fresh" ? <FreshUploadPanel /> : <UploadedDataPanel filters={filters} />}
    </div>
  );
}
