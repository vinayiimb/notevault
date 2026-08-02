import { ExamKitClient } from "@/components/exam-kit/exam-kit-client";

export default function ExamKitPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <div className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight">Turn notes into exam practice</h1>
        <p className="mt-2 text-base leading-7 text-muted">
          Build recall drills, concept practice, and written-answer exercises from material you already trust.
        </p>
      </div>
      <div className="mt-7">
        <ExamKitClient />
      </div>
    </div>
  );
}
