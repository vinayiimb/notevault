import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { similarity } from "@/lib/subject-quality";
import { MergeDriveSubjects } from "@/components/exam-sessions/merge-drive-subjects";
import { SubjectCoverageExplorer } from "@/components/exam-sessions/subject-coverage-explorer";

export default async function AdminDriveSubjectsPage() {
  const [sessions, subjects] = await Promise.all([
    prisma.examSession.findMany({ orderBy: { order: "desc" }, select: { order: true, label: true } }),
    prisma.driveSubject.findMany({
      include: {
        program: true,
        files: { include: { link: { include: { session: true } } } },
      },
      orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  const rows = subjects.map((s) => {
    const sessionOrders = [...new Set(s.files.map((f) => f.link.session.order))];
    return {
      id: s.id,
      name: s.name,
      programName: s.program.name,
      fileCount: s.files.length,
      sessionOrders,
    };
  });

  // Flag same-program subjects with near-identical names as likely
  // duplicates from slightly different filename wordings — a starting point
  // for manual review, never auto-merged (many near-identical DU paper
  // titles, e.g. "History of India V" vs "VIII", are genuinely different
  // papers, not typos).
  type Row = (typeof rows)[number];
  const byProgram = new Map<string, Row[]>();
  for (const row of rows) {
    if (!byProgram.has(row.programName)) byProgram.set(row.programName, []);
    byProgram.get(row.programName)!.push(row);
  }
  const duplicates: { a: Row; b: Row; score: number }[] = [];
  for (const group of byProgram.values()) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const score = similarity(group[i].name, group[j].name);
        if (score >= 0.82) duplicates.push({ a: group[i], b: group[j], score });
      }
    }
  }
  duplicates.sort((x, y) => y.score - x.score);

  const totalFiles = rows.reduce((sum, r) => sum + r.fileCount, 0);
  const everyYearCount = rows.filter((r) => r.sessionOrders.length === sessions.length).length;

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href="/admin/exam-sessions" className="hover:text-accent">
          Exam sessions
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Drive subjects</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Every subject derived from a synced Drive filename, across every course and every session — sorted
        by how many years it shows up in, so the subjects that recur every year float to the top and don&rsquo;t
        need a student to check each session separately. {rows.length} subject{rows.length === 1 ? "" : "s"} ·{" "}
        {totalFiles} file{totalFiles === 1 ? "" : "s"} · {everyYearCount} present in all {sessions.length} years.
      </p>

      {duplicates.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 className="font-medium text-amber-600 dark:text-amber-400">
            {duplicates.length} possible duplicate{duplicates.length === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Same course, very similar names — review before merging, since some are genuinely different
            papers (different paper numbers/years) rather than a spelling variant.
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {duplicates.map(({ a, b, score }) => (
              <li
                key={`${a.id}-${b.id}`}
                className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface p-3 text-sm"
              >
                <span className="text-xs text-muted">{a.programName}</span>
                <span className="font-medium">{a.name}</span>
                <span className="text-xs text-muted">({a.fileCount} files)</span>
                <span className="text-muted">vs</span>
                <span className="font-medium">{b.name}</span>
                <span className="text-xs text-muted">({b.fileCount} files)</span>
                <span className="ml-auto shrink-0 text-xs text-muted">{Math.round(score * 100)}% match</span>
                <MergeDriveSubjects
                  a={{ id: a.id, name: a.name, fileCount: a.fileCount }}
                  b={{ id: b.id, name: b.name, fileCount: b.fileCount }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      <SubjectCoverageExplorer sessions={sessions} rows={rows} />
    </div>
  );
}
