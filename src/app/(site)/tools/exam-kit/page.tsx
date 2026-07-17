import { ExamKitClient } from "@/components/exam-kit/exam-kit-client";

export default function ExamKitPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Exam Kit</h1>
      <p className="mt-2 text-muted">
        Paste your notes (or upload a PDF with selectable text) to generate study
        material grounded in your own material.
      </p>
      <div className="mt-8">
        <ExamKitClient />
      </div>
    </div>
  );
}
