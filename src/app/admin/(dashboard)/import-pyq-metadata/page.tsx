import { PyqMetadataImport } from "@/components/admin/pyq-metadata-import";

export default function ImportPyqMetadataPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">OCR metadata import</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Attach the complete extracted question-paper text from the OCR JSON files to the matching
        question-paper PDFs already stored in NoteVault. This tool is restricted to administrators.
      </p>
      <PyqMetadataImport />
    </div>
  );
}
