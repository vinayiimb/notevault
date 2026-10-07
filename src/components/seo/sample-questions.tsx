import Link from "next/link";
import type { SampleQuestion } from "@/lib/subject-questions";

export function SampleQuestions({ title, items }: { title: string; items: SampleQuestion[] }) {
  if (items.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="mb-3 text-lg font-bold text-foreground">{title}</h2>
      <ul className="space-y-3">
        {items.map((q) => (
          <li key={q.href} className="rounded-xl border border-border bg-surface p-4 text-sm">
            <Link href={q.href} className="font-semibold text-foreground hover:text-accent hover:underline">
              {q.name}
              {q.year ? ` (${q.year})` : ""}
            </Link>
            <p className="mt-1 leading-relaxed text-muted">{q.question}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
