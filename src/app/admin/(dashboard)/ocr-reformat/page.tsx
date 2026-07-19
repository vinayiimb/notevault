import { OcrReformatRunner } from "@/components/admin/ocr-reformat-runner";

export default function OcrReformatPage() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-semibold">OCR paper design pass</h1>
      <p className="mt-1 max-w-3xl text-sm leading-6 text-muted">
        Run a complete local formatting pass over the 188 imported question papers. This is a presentation
        pass, not an answer generator: source order, questions, subparts, marks,
        equations, instructions, and metadata stay in the paper.
      </p>
      <OcrReformatRunner />
    </div>
  );
}
