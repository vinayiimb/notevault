import Link from "next/link";
import { notFound } from "next/navigation";
import { CaretRight, GraduationCap } from "@phosphor-icons/react/dist/ssr";
import { getSessionLinkWithSubjects } from "@/lib/data";

export default async function ExamSessionCoursePage({
  params,
}: {
  params: Promise<{ id: string; linkId: string }>;
}) {
  const { id, linkId } = await params;
  const link = await getSessionLinkWithSubjects(linkId);
  if (!link || link.sessionId !== id) notFound();

  const bySubject = new Map<string, { id: string; name: string; count: number }>();
  for (const file of link.driveFiles) {
    if (!file.driveSubjectId || !file.driveSubject) continue;
    const existing = bySubject.get(file.driveSubjectId);
    if (existing) existing.count += 1;
    else bySubject.set(file.driveSubjectId, { id: file.driveSubjectId, name: file.driveSubject.name, count: 1 });
  }
  const subjects = [...bySubject.values()].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <p className="text-sm text-muted">
        <Link href="/exam-sessions" className="hover:text-foreground">
          Question papers
        </Link>{" "}
        ·{" "}
        <Link href={`/exam-sessions/${link.sessionId}`} className="hover:text-foreground">
          {link.session.label}
        </Link>
      </p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">
        {link.program.name}
        {link.variantLabel && ` (${link.variantLabel})`}
      </h1>

      {subjects.length === 0 ? (
        <div className="mt-8 rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted">
            Subjects haven&rsquo;t been loaded for this course yet — check back soon.
          </p>
          <a
            href={link.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-block text-sm text-accent hover:underline"
          >
            Open the full Drive folder instead
          </a>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm text-muted">
            {subjects.length} subject{subjects.length === 1 ? "" : "s"} — pick yours.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
            <ul className="divide-y divide-border">
              {subjects.map((subject) => (
                <li key={subject.id}>
                  <Link
                    href={`/exam-sessions/${link.sessionId}/${link.id}/${subject.id}`}
                    className="flex items-center justify-between gap-4 p-4 transition hover:bg-accent-soft/30"
                  >
                    <span className="flex items-center gap-2.5 font-medium">
                      <GraduationCap size={18} weight="bold" className="text-accent" />
                      {subject.name}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted">
                      {subject.count} paper{subject.count === 1 ? "" : "s"}
                      <CaretRight size={14} weight="bold" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
