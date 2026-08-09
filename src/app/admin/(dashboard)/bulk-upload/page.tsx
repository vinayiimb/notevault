import { FileArchive } from "@phosphor-icons/react/dist/ssr";
import { SpreadsheetImport } from "@/components/admin/bulk-upload/spreadsheet-import";

export const dynamic = "force-dynamic";

export default function BulkUploadPage() {
  return (
    <div className="space-y-8 p-6 sm:p-8">
      <div className="border-b border-border pb-6">
        <div className="flex items-center gap-2 text-sm font-bold text-accent">
          <FileArchive size={20} weight="bold" />
          <span>Bulk Upload</span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-foreground">
          Import papers from a spreadsheet
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Hand over a CSV or Excel sheet of course/semester/subject rows, each pointing at a Drive
          folder of papers, and NoteVault matches them against the existing catalogue and imports
          every PDF straight onto the live subject pages.
        </p>
      </div>

      <SpreadsheetImport />
    </div>
  );
}
