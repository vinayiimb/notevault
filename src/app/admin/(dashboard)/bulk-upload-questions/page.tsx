import Link from "next/link";
import { QuestionCsvUploadPanel } from "@/components/admin/question-csv-upload-panel";

export default function BulkUploadQuestionsPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">Bulk upload questions</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Import many practice questions at once from a CSV or Excel file — one row per question.
        Separate from the paper-catalog{" "}
        <Link href="/admin/bulk-upload" className="text-accent hover:underline">
          Bulk Upload
        </Link>
        , which imports PYQ paper files, not questions.
      </p>

      <div className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold text-foreground">File format</h2>
        <p className="mt-1 text-sm text-muted">
          Six columns, header row required. <code>SubjectId</code>, <code>Question</code> and{" "}
          <code>Answer</code> are required on every row; the rest are optional.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[600px] text-xs">
            <thead className="text-muted">
              <tr>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">SubjectId</th>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">Question</th>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">Answer</th>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">Marks</th>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">Years</th>
                <th className="border-b border-border px-2 py-1.5 text-left font-medium">RepeatCount</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr>
                <td className="px-2 py-1.5 font-mono">clx4k9p2e...</td>
                <td className="px-2 py-1.5">Explain price elasticity of demand.</td>
                <td className="px-2 py-1.5">Price elasticity measures...</td>
                <td className="px-2 py-1.5">10</td>
                <td className="px-2 py-1.5">2021,2023</td>
                <td className="px-2 py-1.5">2</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted">
          Find a subject&apos;s exact ID on the{" "}
          <Link href="/admin/subject-lookup" className="text-accent hover:underline">
            Subject lookup
          </Link>{" "}
          page — a row with an ID that doesn&apos;t match a real subject is rejected, not
          auto-created.
        </p>
      </div>

      <div className="mt-6">
        <QuestionCsvUploadPanel />
      </div>
    </div>
  );
}
