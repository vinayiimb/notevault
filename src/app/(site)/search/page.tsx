import Link from "next/link";
import { Notebook } from "@phosphor-icons/react/dist/ssr";
import { searchSubjects } from "@/lib/data";
import { levelLabel } from "@/lib/utils";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const results = await searchSubjects(q);

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {q ? `Results for "${q}"` : "Search"}
      </h1>

      {q && results.length === 0 && (
        <p className="mt-6 text-sm text-muted">
          No subjects matched. Try a different keyword, or browse{" "}
          <Link href="/browse/college" className="text-accent">
            College
          </Link>{" "}
          and{" "}
          <Link href="/browse/school" className="text-accent">
            Class 12
          </Link>{" "}
          directly.
        </p>
      )}

      {results.length > 0 && (
        <ul className="mt-6 flex flex-col divide-y divide-border rounded-xl border border-border bg-surface">
          {results.map((subject) => (
            <li key={subject.id}>
              <Link
                href={`/subjects/${subject.id}`}
                className="flex items-center gap-3 p-4 transition hover:bg-surface-muted"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <Notebook size={18} weight="bold" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium">{subject.name}</p>
                  <p className="truncate text-xs text-muted">
                    {levelLabel(subject.term.program.level)} · {subject.term.program.name} ·{" "}
                    {subject.term.name}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
