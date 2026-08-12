import { prisma } from "@/lib/prisma";
import duQuestionBankRows from "@/data/du-question-bank-full-mapped.json";
import { DuQuestionBankImportPanel } from "@/components/admin/du-question-bank/du-question-bank-import-panel";

export default async function DuQuestionBankAdminPage() {
  const initialCount = await prisma.duQuestionBankPaper.count().catch(() => 0);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">DU Question Bank Import</h1>
        <p className="mt-1 text-sm text-muted">
          Bulk-imports the full DU Question Paper Bank scrape into its own standalone table
          (separate from the Full Archive / Bulk Upload catalog), which powers the public{" "}
          <code>/pyp</code> page.
        </p>
      </div>

      <DuQuestionBankImportPanel initialCount={initialCount} totalInFile={duQuestionBankRows.length} />
    </div>
  );
}
