import Link from "next/link";
import { notFound } from "next/navigation";
import { GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { getProgramsByLevel } from "@/lib/data";
import { levelLabel } from "@/lib/utils";
import { CourseSemesterJump } from "@/components/browse/course-semester-jump";

// School (Class 12) is out of scope for now — a separate site is planned for it later.
const LEVEL_MAP: Record<string, "SCHOOL" | "COLLEGE"> = {
  college: "COLLEGE",
};

export default async function BrowseLevelPage({
  params,
}: {
  params: Promise<{ level: string }>;
}) {
  const { level } = await params;
  const enumLevel = LEVEL_MAP[level];
  if (!enumLevel) notFound();

  const programs = await getProgramsByLevel(enumLevel);
  const jumpData = programs.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    terms: p.terms.map((t) => ({ id: t.id, name: t.name })),
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">{levelLabel(enumLevel)}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        Previous year questions, notes &amp; answer keys
      </h1>
      <p className="mt-2 text-sm text-muted">
        Pick your course and semester for a quick jump, or browse every course below.
      </p>

      {programs.length > 0 && (
        <div className="mt-6 max-w-2xl">
          <CourseSemesterJump programs={jumpData} />
        </div>
      )}

      <h2 className="mt-12 text-sm font-semibold uppercase tracking-wide text-muted">
        Browse all courses
      </h2>

      {programs.length === 0 ? (
        <p className="mt-4 text-sm text-muted">No programs added yet. Check back soon.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {programs.map((program) => {
            const subjectCount = program.terms.reduce((n, t) => n + t.subjects.length, 0);
            return (
              <Link
                key={program.id}
                href={`/programs/${program.slug}`}
                className="flex flex-col gap-3 rounded-xl border border-border bg-surface p-5 transition hover:border-accent"
              >
                <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
                  <GraduationCap size={20} weight="bold" />
                </span>
                <div>
                  <h2 className="font-medium">{program.name}</h2>
                  {program.summary && (
                    <p className="mt-1 text-sm text-muted">{program.summary}</p>
                  )}
                </div>
                <p className="mt-auto text-xs text-muted">
                  {program.terms.length} term{program.terms.length === 1 ? "" : "s"} ·{" "}
                  {subjectCount} subject{subjectCount === 1 ? "" : "s"}
                </p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
