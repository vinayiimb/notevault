export const dynamic = "force-static";
import type { Metadata } from "next";
import Link from "next/link";
import { Brain, Calculator } from "@phosphor-icons/react/dist/ssr";

export const metadata: Metadata = {
  title: "Study Tools",
  description: "Turn your DU notes and PYQs into quizzes, flashcards, and exam practice on DU PYQ Online.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">Study tools</h1>
      <p className="mt-2 text-muted">Turn your notes into study material.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:max-w-sm">
        <Link
          href="/tools/exam-kit"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 transition hover:border-accent"
        >
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Brain size={22} weight="bold" />
          </span>
          <div>
            <h2 className="text-lg font-medium">Exam Kit</h2>
            <p className="mt-1 text-sm text-muted">
              Paste your notes and generate flashcards, an MCQ quiz, fill-in-the-blank
              drills, and theory-paper practice: concept maps, essay skeletons, and a
              devil&apos;s advocate debate mode.
            </p>
          </div>
        </Link>
        <Link
          href="/tools/marks-calculator"
          className="flex flex-col gap-4 rounded-xl border border-border bg-surface p-6 transition hover:border-accent"
        >
          <span className="flex size-11 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <Calculator size={22} weight="bold" />
          </span>
          <div>
            <h2 className="text-lg font-medium">Marks & CGPA Calculator</h2>
            <p className="mt-1 text-sm text-muted">
              Calculate your internal marks, theory targets, and overall CGPA. Import your marksheet data using AI.
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
}
