import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { similarity } from "@/lib/subject-quality";
import { MergeDriveSubjects } from "@/components/exam-sessions/merge-drive-subjects";

export default async function AdminDriveSubjectsPage() {
  const subjects = await prisma.driveSubject.findMany({
    include: {
      program: true,
      files: { include: { link: { include: { session: true } } } },
    },
    orderBy: [{ program: { name: "asc" } }, { name: "asc" }],
  });

  const rows = subjects.map((s) => {
    const sessionLabels = new Set(s.files.map((f) => f.link.session.label));
    const years = [...new Set(s.files.map((f) => f.year).filter((y): y is number => y != null))].sort(
      (a, b) => b - a
    );
    return {
      id: s.id,
      name: s.name,
      programId: s.programId,
      programName: s.program.name,
      fileCount: s.files.length,
      sessionCount: sessionLabels.size,
      years,
    };
  });

  // Flag same-program subjects with near-identical names as likely
  // duplicates from slightly different filename wordings across years —
  // exactly the kind of thing that should be merged before batching.
  type Row = (typeof rows)[number];
  const byProgram = new Map<string, Row[]>();
  for (const row of rows) {
    if (!byProgram.has(row.programId)) byProgram.set(row.programId, []);
    byProgram.get(row.programId)!.push(row);
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

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href="/admin/exam-sessions" className="hover:text-accent">
          Exam sessions
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">Drive subjects</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted">
        Every subject derived from a synced Drive filename, across every course and every session. Use this
        to spot the same subject spelled two different ways before grouping papers into batches —{" "}
        {rows.length} subject{rows.length === 1 ? "" : "s"} · {totalFiles} file{totalFiles === 1 ? "" : "s"}{" "}
        total.
      </p>

      {duplicates.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-500/40 bg-amber-500/5 p-5">
          <h2 className="font-medium text-amber-600 dark:text-amber-400">
            {duplicates.length} possible duplicate{duplicates.length === 1 ? "" : "s"}
          </h2>
          <p className="mt-1 text-sm text-muted">
            Same course, very similar names — likely the same subject from a slightly different filename.
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

      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead className="bg-surface-muted/55 text-xs text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold sm:px-6">Course</th>
                <th scope="col" className="px-4 py-3 font-semibold">Subject</th>
                <th scope="col" className="w-24 px-4 py-3 text-right font-semibold">Sessions</th>
                <th scope="col" className="w-20 px-4 py-3 text-right font-semibold">Files</th>
                <th scope="col" className="w-40 px-5 py-3 text-right font-semibold sm:px-6">Years</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-accent-soft/30">
                  <td className="px-5 py-3 align-top text-xs text-muted sm:px-6">{row.programName}</td>
                  <th scope="row" className="px-4 py-3 align-top font-medium text-foreground">{row.name}</th>
                  <td className="px-4 py-3 text-right align-top">{row.sessionCount}</td>
                  <td className="px-4 py-3 text-right align-top">{row.fileCount}</td>
                  <td className="px-5 py-3 text-right align-top text-xs text-muted sm:px-6">
                    {row.years.join(", ") || "—"}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-sm text-muted">
                    No subjects yet — sync a course link&rsquo;s Drive folder first.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
