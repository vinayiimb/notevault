import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SyncDriveFiles } from "@/components/exam-sessions/sync-drive-files";
import { RenameDriveSubject } from "@/components/exam-sessions/rename-drive-subject";

export default async function AdminSessionLinkPage({
  params,
}: {
  params: Promise<{ id: string; linkId: string }>;
}) {
  const { id, linkId } = await params;
  const link = await prisma.sessionProgramLink.findUnique({
    where: { id: linkId },
    include: {
      session: true,
      program: true,
      driveFiles: { include: { driveSubject: true }, orderBy: { fileName: "asc" } },
    },
  });
  if (!link || link.sessionId !== id) notFound();

  const bySubject = new Map<string, { name: string; slug: string | null; files: typeof link.driveFiles }>();
  for (const file of link.driveFiles) {
    const key = file.driveSubjectId ?? "__none__";
    const name = file.driveSubject?.name ?? file.fileName;
    if (!bySubject.has(key)) bySubject.set(key, { name, slug: file.driveSubject?.slug ?? null, files: [] });
    bySubject.get(key)!.files.push(file);
  }
  const subjectGroups = [...bySubject.entries()].sort((a, b) => a[1].name.localeCompare(b[1].name));

  return (
    <div className="p-8">
      <p className="text-sm text-muted">
        <Link href="/admin/exam-sessions" className="hover:text-accent">
          Exam sessions
        </Link>{" "}
        ·{" "}
        <Link href={`/admin/exam-sessions/${link.sessionId}`} className="hover:text-accent">
          {link.session.label}
        </Link>
      </p>
      <h1 className="text-2xl font-semibold">{link.program.name}</h1>
      <a
        href={link.driveUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 inline-block text-sm text-accent hover:underline"
      >
        {link.driveUrl}
      </a>

      <section className="mt-6 rounded-xl border border-border bg-surface p-5">
        <h2 className="font-medium">Sync PDFs from Drive</h2>
        <p className="mt-1 text-sm text-muted">
          Lists every PDF inside this folder and derives a subject straight from each filename (e.g.
          &ldquo;Corporate Accounting 3319.pdf&rdquo; → subject &ldquo;Corporate Accounting&rdquo;).
          Re-syncing next year reuses the same subject even if the filename&rsquo;s capitalization or
          wording changes slightly — nothing is downloaded, only the file name and a link back to Drive
          are stored.
        </p>
        <div className="mt-4">
          <SyncDriveFiles linkId={link.id} />
        </div>
      </section>

      {subjectGroups.length > 0 && (
        <section className="mt-6">
          <h2 className="text-sm font-medium text-muted">
            {subjectGroups.length} subject{subjectGroups.length === 1 ? "" : "s"} ·{" "}
            {link.driveFiles.length} file{link.driveFiles.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-3 flex flex-col gap-3">
            {subjectGroups.map(([key, group]) => (
              <li key={key} className="rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{group.name}</p>
                  {group.slug && (
                    <RenameDriveSubject id={link.driveFiles.find((f) => f.driveSubjectId === key)!.driveSubjectId!} name={group.name} />
                  )}
                </div>
                <ul className="mt-2 flex flex-col divide-y divide-border">
                  {group.files.map((file) => (
                    <li key={file.id} className="flex items-center justify-between gap-3 py-1.5">
                      <a
                        href={file.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate text-xs text-foreground hover:text-accent"
                      >
                        {file.fileName}
                      </a>
                      {file.year && <span className="shrink-0 text-xs text-muted">{file.year}</span>}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
