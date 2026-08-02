import { FeedbackForm } from "@/components/feedback-form";

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
        We would love to{" "}
        <span className="bg-yellow-soft px-1">hear from you</span>
      </h1>
      <p className="mt-3 text-base leading-7 text-muted">
        Found a bug, have an idea, or just want to tell us how it&apos;s going? Drop it below —
        every message reaches our team.
      </p>

      <div className="mt-8">
        <FeedbackForm />
      </div>
    </div>
  );
}
